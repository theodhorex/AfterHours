/**
 * Exchange and City Trading Pure Helpers and RPC View Wrappers.
 *
 * Security and hardening:
 * - Strict decimal amount parsing using BigInt string math (no IEEE-754 float precision loss).
 * - Defend against untrusted RPC payloads, malformed inputs, and negative prices.
 * - Map contract panic strings to user-friendly messages.
 */

import {
  DEFAULT_NEAR_RPC_URL,
  DEFAULT_TIMEOUT_MS,
  type ChainCity,
  type FetchCityOptions,
  fetchCityFromChain,
} from "./chain.ts";
import { replayToStep } from "./audit.ts";
import { TESTNET_CITIES, type TestnetCityId } from "../data/testnet.ts";

export const DEFAULT_KNOWN_CITY_IDS: readonly string[] = [
  "city-goblin_warrens",
  "city-cave_hold",
  "city-dino_vale",
  "city-elf_grove",
] as const;

export interface Listing {
  city_id: string;
  seller: string;
  price_yocto: string;
}

export const EXCHANGE_ERROR_MESSAGES: Record<string, string> = {
  NOT_CITY_OWNER: "You do not own this city.",
  ALREADY_LISTED: "This city is already listed for sale.",
  INSUFFICIENT_PAYMENT: "Attached payment is less than the listing price.",
  CITY_ROOT_CHANGED: "The city state has changed since verification. Please re-check history.",
  SELF_PURCHASE: "You cannot buy your own city listing.",
  INVALID_PRICE: "Listing price must be greater than zero.",
  NO_CLAIMABLE_BALANCE: "No claimable proceeds available to withdraw.",
  NOT_SELLER: "Only the seller can cancel this listing.",
  NO_LISTING: "No active listing found for this city.",
  NO_CITY: "City record not found.",
  SELLER_NOT_CITY_OWNER: "The seller no longer owns this city.",
};

/**
 * Returns merged and deduplicated list of known city IDs.
 * Always includes the four published testnet cities in standard order,
 * plus any non-empty IDs stored in the user's account profile.
 */
export function getKnownCityIds(profileCityIds?: readonly string[] | null): string[] {
  const result: string[] = [...DEFAULT_KNOWN_CITY_IDS];
  if (!profileCityIds || !Array.isArray(profileCityIds)) {
    return result;
  }

  for (const id of profileCityIds) {
    if (typeof id === "string") {
      const trimmed = id.trim();
      if (trimmed.length > 0 && !result.includes(trimmed)) {
        result.push(trimmed);
      }
    }
  }

  return result;
}

/**
 * Base64 encode helper for Node and Browser environments.
 */
function toBase64(str: string): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(str, "utf-8").toString("base64");
  }
  return btoa(str);
}

/**
 * Generic NEAR RPC view caller for smart contract view methods.
 */
export async function viewCall<T>(
  contractId: string,
  methodName: string,
  args: Record<string, unknown> = {},
  options?: FetchCityOptions
): Promise<T | null> {
  const fetchImpl: typeof fetch = options?.fetchImpl ?? fetch;
  const rpcUrl: string = options?.rpcUrl ?? DEFAULT_NEAR_RPC_URL;
  const timeoutMs: number = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const argsBase64 = toBase64(JSON.stringify(args));
    const requestBody = {
      jsonrpc: "2.0",
      id: `afterhours-view-${methodName}`,
      method: "query",
      params: {
        request_type: "call_function",
        finality: "final",
        account_id: contractId,
        method_name: methodName,
        args_base64: argsBase64,
      },
    };

    const response = await fetchImpl(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText} from NEAR RPC`);
    }

    const payload = (await response.json()) as {
      error?: { message?: string; cause?: unknown };
      result?: { result?: number[]; error?: string };
    };

    if (payload.error) {
      const errMsg = payload.error.message || JSON.stringify(payload.error);
      throw new Error(`NEAR RPC error: ${errMsg}`);
    }

    if (!payload.result || payload.result.error) {
      const execErr = payload.result?.error || "Missing result in RPC response";
      throw new Error(`NEAR call_function execution error: ${execErr}`);
    }

    if (!Array.isArray(payload.result.result)) {
      throw new Error("NEAR RPC response missing result byte array");
    }

    const bytes = new Uint8Array(payload.result.result);
    const decodedText = new TextDecoder().decode(bytes);

    if (!decodedText || decodedText === "null") {
      return null;
    }

    return JSON.parse(decodedText) as T;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetches an active listing for a city from chain, or null if unlisted.
 */
export async function fetchCityListing(
  contractId: string,
  cityId: string,
  options?: FetchCityOptions
): Promise<Listing | null> {
  try {
    const raw = await viewCall<Listing>(contractId, "get_listing", { city_id: cityId }, options);
    if (!raw || typeof raw !== "object") return null;
    if (typeof raw.city_id !== "string" || typeof raw.seller !== "string") return null;
    return {
      city_id: raw.city_id,
      seller: raw.seller,
      price_yocto: String(raw.price_yocto ?? "0"),
    };
  } catch {
    return null;
  }
}

/**
 * Fetches city record via chain helper.
 */
export async function fetchCity(
  contractId: string,
  cityId: string,
  options?: FetchCityOptions
): Promise<ChainCity | null> {
  const result = await fetchCityFromChain(contractId, cityId, options);
  return result.ok ? result.city : null;
}

/**
 * Fetches claimable proceeds for an account in yoctoNEAR.
 */
export async function fetchClaimable(
  contractId: string,
  accountId: string,
  options?: FetchCityOptions
): Promise<string> {
  try {
    const res = await viewCall<string>(contractId, "get_claimable", { account_id: accountId }, options);
    if (typeof res === "string") return res;
    if (typeof res === "number") return String(res);
    return "0";
  } catch {
    return "0";
  }
}

/**
 * Converts a human NEAR amount string to exact yoctoNEAR (10^24) string using BigInt string math.
 * Strictly validates against negatives, non-numbers, empty strings, and >24 decimals.
 */
export function nearToYocto(nearStr: string): string {
  if (typeof nearStr !== "string") {
    throw new Error("Invalid NEAR amount: must be a string");
  }

  const trimmed = nearStr.trim();
  if (trimmed.length === 0) {
    throw new Error("NEAR amount cannot be empty");
  }

  if (trimmed.includes("-")) {
    throw new Error("NEAR amount cannot be negative");
  }

  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(trimmed)) {
    throw new Error(`Invalid NEAR amount format: "${trimmed}"`);
  }

  const [wholePart = "0", fracPart = ""] = trimmed.split(".");
  const normalizedWhole = wholePart === "" ? "0" : wholePart.replace(/^0+(?=\d)/, "");

  if (fracPart.length > 24) {
    throw new Error("NEAR amount cannot exceed 24 decimals");
  }

  const paddedFrac = fracPart.padEnd(24, "0");
  const wholeBigInt = BigInt(normalizedWhole);
  const fracBigInt = BigInt(paddedFrac);

  const totalYocto = wholeBigInt * 10n ** 24n + fracBigInt;
  return totalYocto.toString();
}

/**
 * Converts yoctoNEAR string to a plain NEAR decimal string without losing precision.
 */
export function yoctoToNear(yocto: string | bigint): string {
  const yoctoBigInt = typeof yocto === "bigint" ? yocto : BigInt(yocto || "0");
  if (yoctoBigInt === 0n) return "0";

  const isNeg = yoctoBigInt < 0n;
  const abs = isNeg ? -yoctoBigInt : yoctoBigInt;
  const str = abs.toString().padStart(25, "0");
  const whole = str.slice(0, str.length - 24) || "0";
  const frac = str.slice(str.length - 24).replace(/0+$/, "");

  const res = frac.length > 0 ? `${whole}.${frac}` : whole;
  return isNeg ? `-${res}` : res;
}

/**
 * Formats yoctoNEAR to human-readable NEAR with exactly 4 decimal places.
 */
export function formatNear(yocto: string | bigint | number, decimals: number = 4): string {
  if (yocto === "" || yocto === null || yocto === undefined) {
    return (0).toFixed(decimals);
  }

  try {
    let big: bigint;
    if (typeof yocto === "bigint") {
      big = yocto;
    } else if (typeof yocto === "number") {
      if (Number.isNaN(yocto) || !Number.isFinite(yocto)) return (0).toFixed(decimals);
      big = BigInt(Math.floor(yocto));
    } else {
      const clean = yocto.trim();
      if (!/^-?\d+$/.test(clean)) return (0).toFixed(decimals);
      big = BigInt(clean);
    }

    if (big < 0n) big = 0n;
    const str = big.toString().padStart(25, "0");
    const whole = str.slice(0, str.length - 24) || "0";
    const frac = str.slice(str.length - 24);

    const formattedFrac = frac.slice(0, decimals).padEnd(decimals, "0");
    return `${whole}.${formattedFrac}`;
  } catch {
    return (0).toFixed(decimals);
  }
}

/**
 * Shortens an account ID for clean ledger display (e.g. "afterhours...testnet").
 */
export function formatShortAccountId(accountId: string, maxLen: number = 20): string {
  if (!accountId || typeof accountId !== "string") return "—";
  const trimmed = accountId.trim();
  if (trimmed.length === 0) return "—";
  if (trimmed.length <= maxLen) return trimmed;

  if (trimmed.endsWith(".testnet")) {
    const namePart = trimmed.slice(0, -".testnet".length);
    const firstSegment = namePart.split(/[-_.]/)[0] || namePart.slice(0, 8);
    return `${firstSegment}...testnet`;
  }
  if (trimmed.endsWith(".near")) {
    const namePart = trimmed.slice(0, -".near".length);
    const firstSegment = namePart.split(/[-_.]/)[0] || namePart.slice(0, 8);
    return `${firstSegment}...near`;
  }

  const front = trimmed.slice(0, 8);
  const back = trimmed.slice(-6);
  return `${front}...${back}`;
}

/**
 * Shortens a 64-char hex state root for tabular presentation (e.g. "22adb8...bd6b").
 */
export function formatShortRoot(root: string): string {
  if (!root || typeof root !== "string") return "—";
  const trimmed = root.trim();
  if (trimmed.length <= 16) return trimmed;
  return `${trimmed.slice(0, 6)}...${trimmed.slice(-4)}`;
}

/**
 * Maps contract panic/error codes to plain, friendly English messages.
 */
export function mapExchangeError(error: unknown): string {
  if (!error) {
    return "An unexpected error occurred during the transaction.";
  }

  const rawMessage =
    error instanceof Error
      ? error.message
      : typeof error === "string"
      ? error
      : JSON.stringify(error);

  // Check longer error codes first to avoid substring prefix collisions
  const sortedCodes = Object.keys(EXCHANGE_ERROR_MESSAGES).sort((a, b) => b.length - a.length);
  for (const code of sortedCodes) {
    if (rawMessage.includes(code)) {
      return EXCHANGE_ERROR_MESSAGES[code];
    }
  }

  // Handle standard user rejection or common wallet patterns
  if (/user cancelled|rejected|declined/i.test(rawMessage)) {
    return "Transaction was cancelled in wallet.";
  }

  return rawMessage.trim() || "An unexpected error occurred during the transaction.";
}

export interface HistoryVerificationResult {
  ok: boolean;
  status: "verified" | "mismatch";
  cityRoot: string | null;
  detail: string;
}

/**
 * Runs replay verification for a city ("Audit before you buy").
 * Compares deterministically replayed state root with on-chain city record.
 * If verified, returns the expected city_root required by buy_city contract call.
 */
export function verifyCityHistory(
  cityId: string,
  chainCity: ChainCity | null | undefined
): HistoryVerificationResult {
  if (!chainCity) {
    return {
      ok: false,
      status: "mismatch",
      cityRoot: null,
      detail: "City record is not available on chain.",
    };
  }

  const testnetMeta = TESTNET_CITIES[cityId as TestnetCityId];
  if (testnetMeta) {
    try {
      const replay = replayToStep(
        testnetMeta.arcId,
        testnetMeta.seed,
        chainCity.step,
        cityId
      );

      if (replay.stateRoot !== chainCity.state_root) {
        return {
          ok: false,
          status: "mismatch",
          cityRoot: null,
          detail: `State root mismatch at step ${chainCity.step}: replayed ${replay.stateRoot.slice(0, 8)} vs chain ${chainCity.state_root.slice(0, 8)}.`,
        };
      }

      const root = chainCity.city_root || "";
      return {
        ok: true,
        status: "verified",
        cityRoot: root,
        detail: `State root matches browser replay at step ${chainCity.step}.`,
      };
    } catch (err) {
      return {
        ok: false,
        status: "mismatch",
        cityRoot: null,
        detail: `Replay verification failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  // If not a predefined testnet demo city, verify state_root format on chain
  if (chainCity.state_root && /^[0-9a-fA-F]{64}$/.test(chainCity.state_root)) {
    const root = chainCity.city_root || "";
    return {
      ok: true,
      status: "verified",
      cityRoot: root,
      detail: `On-chain record valid at step ${chainCity.step}.`,
    };
  }

  return {
    ok: false,
    status: "mismatch",
    cityRoot: null,
    detail: "Malformed on-chain state root format.",
  };
}
