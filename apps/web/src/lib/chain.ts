/**
 * Pure NEAR RPC chain client and verification comparison helpers.
 * Browser-friendly, zero external dependencies, handles untrusted RPC payloads defensively.
 */

export const DEFAULT_NEAR_RPC_URL = "https://rpc.testnet.near.org";
export const DEFAULT_TIMEOUT_MS = 8000;

export interface ChainCity {
  city_id: string;
  step: number;
  state_root: string;
  city_root?: string;
  stage?: number;
  arc_id?: string;
  server_id?: string;
  owner?: string;
  [key: string]: unknown;
}

export interface FetchCityOptions {
  rpcUrl?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export type FetchCityParam = typeof fetch | FetchCityOptions;

export interface ChainFetchResult {
  ok: boolean;
  city: ChainCity | null;
  error?: string;
}

export interface CompareResult {
  ok: boolean;
  reason: string;
}

/**
 * Base64 encode an ASCII or UTF-8 string across Browser and Node runtimes.
 */
function toBase64(str: string): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(str, "utf-8").toString("base64");
  }
  return btoa(str);
}

/**
 * Validates untrusted RPC payload shape before treating as ChainCity.
 */
function validateChainCity(raw: unknown): { ok: true; city: ChainCity } | { ok: false; error: string } {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, error: "Malformed on-chain response: expected JSON object" };
  }

  const record = raw as Record<string, unknown>;

  if (typeof record.city_id !== "string" || record.city_id.length === 0) {
    return { ok: false, error: "Malformed on-chain city record: missing or invalid city_id" };
  }

  const rawStep = record.step;
  const stepNum = typeof rawStep === "number" ? rawStep : Number(rawStep);
  if (Number.isNaN(stepNum) || stepNum < 0) {
    return { ok: false, error: "Malformed on-chain city record: invalid step number" };
  }

  if (typeof record.state_root !== "string" || record.state_root.length === 0) {
    return { ok: false, error: "Malformed on-chain city record: missing or invalid state_root" };
  }

  const city: ChainCity = {
    ...record,
    city_id: record.city_id,
    step: stepNum,
    state_root: record.state_root,
  };

  return { ok: true, city };
}

/**
 * Fetches a city record from NEAR via call_function query on get_city.
 * Never throws into UI; returns clear error messages for network, timeout, RPC, or HTTP errors.
 */
export async function fetchCityFromChain(
  contract: string,
  cityId: string,
  fetchImplOrOptions?: FetchCityParam,
  rpcUrlOverride?: string
): Promise<ChainFetchResult> {
  let fetchImpl: typeof fetch = fetch;
  let rpcUrl: string = rpcUrlOverride ?? DEFAULT_NEAR_RPC_URL;
  let timeoutMs: number = DEFAULT_TIMEOUT_MS;

  if (typeof fetchImplOrOptions === "function") {
    fetchImpl = fetchImplOrOptions;
  } else if (fetchImplOrOptions && typeof fetchImplOrOptions === "object") {
    if (fetchImplOrOptions.fetchImpl) fetchImpl = fetchImplOrOptions.fetchImpl;
    if (fetchImplOrOptions.rpcUrl) rpcUrl = fetchImplOrOptions.rpcUrl;
    if (typeof fetchImplOrOptions.timeoutMs === "number") timeoutMs = fetchImplOrOptions.timeoutMs;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const argsBase64 = toBase64(JSON.stringify({ city_id: cityId }));
    const requestBody = {
      jsonrpc: "2.0",
      id: "afterhours-audit",
      method: "query",
      params: {
        request_type: "call_function",
        finality: "final",
        account_id: contract,
        method_name: "get_city",
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
      return {
        ok: false,
        city: null,
        error: `HTTP ${response.status} ${response.statusText} from NEAR RPC at ${rpcUrl}`,
      };
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch (parseErr) {
      return {
        ok: false,
        city: null,
        error: `Invalid JSON response from NEAR RPC: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`,
      };
    }

    if (typeof payload !== "object" || payload === null) {
      return { ok: false, city: null, error: "NEAR RPC returned empty or non-object response" };
    }

    const json = payload as Record<string, unknown>;

    if (json.error) {
      const errObj = json.error as Record<string, unknown>;
      const errMsg =
        typeof errObj.message === "string"
          ? errObj.message
          : typeof errObj.cause === "object" && errObj.cause !== null
          ? JSON.stringify(errObj.cause)
          : JSON.stringify(errObj);
      return { ok: false, city: null, error: `NEAR RPC error: ${errMsg}` };
    }

    const resultObj = json.result as Record<string, unknown> | undefined;
    if (!resultObj) {
      return { ok: false, city: null, error: "NEAR RPC response missing result object" };
    }

    if (resultObj.error) {
      return { ok: false, city: null, error: `NEAR call_function execution error: ${String(resultObj.error)}` };
    }

    if (!Array.isArray(resultObj.result)) {
      return { ok: false, city: null, error: "NEAR RPC response missing result byte array" };
    }

    const bytes = new Uint8Array(resultObj.result as number[]);
    const decodedText = new TextDecoder().decode(bytes);

    let parsedCity: unknown;
    try {
      parsedCity = JSON.parse(decodedText);
    } catch {
      return { ok: false, city: null, error: `Failed to decode city JSON from bytes: ${decodedText.slice(0, 100)}` };
    }

    if (parsedCity === null) {
      return {
        ok: false,
        city: null,
        error: `City "${cityId}" not found on chain (contract returned null)`,
      };
    }

    const validated = validateChainCity(parsedCity);
    if (!validated.ok) {
      return { ok: false, city: null, error: validated.error };
    }

    return { ok: true, city: validated.city };
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      return {
        ok: false,
        city: null,
        error: `NEAR RPC request timed out after ${Math.round(timeoutMs / 1000)}s`,
      };
    }
    return {
      ok: false,
      city: null,
      error: `Network error querying NEAR RPC: ${err instanceof Error ? err.message : String(err)}`,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Compares browser replay root and step against on-chain city record.
 */
export function compareToChain(
  replayRoot: string,
  replayStep: number,
  chainCity: ChainCity | null | undefined
): CompareResult {
  if (!chainCity) {
    return {
      ok: false,
      reason: `MISMATCH: on-chain city record is null (expected step ${replayStep})`,
    };
  }

  if (chainCity.step !== replayStep) {
    return {
      ok: false,
      reason: `MISMATCH: step mismatch at step ${replayStep}: expected step ${replayStep}, got step ${chainCity.step} on chain`,
    };
  }

  if (chainCity.state_root !== replayRoot) {
    return {
      ok: false,
      reason: `MISMATCH at step ${replayStep}: state_root expected ${replayRoot}, got ${chainCity.state_root} on chain`,
    };
  }

  return {
    ok: true,
    reason: `VERIFIED: browser replay root matches NEAR testnet at step ${replayStep}`,
  };
}
