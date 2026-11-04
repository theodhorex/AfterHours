/**
 * Pure Agent Library & Leaderboard Management.
 * Zero external dependencies, pure BigInt math compatibility, no node:fs.
 */

import { parseAgent, type Agent } from "../../../../packages/rules/src/schema.ts";
import { backtestAgent } from "../../../../packages/rules/src/backtest.ts";
import {
  getArc,
  getPricingRules,
  getGrowthRules,
} from "./sim-adapter.ts";

export interface LeaderboardEntry {
  id: string;
  name: string;
  arcId: string;
  seed: string;
  steps: number;
  startCoin: bigint;
  score: bigint;
  trades: number;
  stateRoot: string;
  agentHash: string;
  agentJson?: string;
}

export interface SerializedLeaderboardEntry {
  id: string;
  name: string;
  arcId: string;
  seed: string;
  steps: number;
  startCoin: string;
  score: string;
  trades: number;
  stateRoot: string;
  agentHash: string;
  agentJson?: string;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

export const LEADERBOARD_STORAGE_KEY = "afterearth:agents:leaderboard";
export const MAX_LEADERBOARD_ENTRIES = 20;

export const PRESET_AGENTS: Record<string, string> = {
  "bread-trader": JSON.stringify(
    {
      version: 1,
      name: "Bread Trader",
      rules: [
        {
          id: "buy_bread_low",
          when: [
            { kind: "price", item: "bread", op: "lte", value: "38" },
            { kind: "coin", op: "gte", value: "200" },
          ],
          do: { kind: "buy", item: "bread", qty: "10", max_price: "42" },
          cooldown: 2,
        },
        {
          id: "sell_bread_high",
          when: [
            { kind: "holding", item: "bread", op: "gte", value: "10" },
            { kind: "price", item: "bread", op: "gte", value: "32" },
          ],
          do: { kind: "sell", item: "bread", qty: "10", min_price: "28" },
          cooldown: 2,
        },
      ],
    },
    null,
    2
  ),
  "grain-hoarder": JSON.stringify(
    {
      version: 1,
      name: "Grain Hoarder",
      rules: [
        {
          id: "hoard_grain",
          when: [
            { kind: "coin", op: "gte", value: "100" },
            { kind: "holding", item: "grain", op: "lt", value: "150" },
          ],
          do: { kind: "buy", item: "grain", qty: "15", max_price: "20" },
          cooldown: 1,
        },
      ],
    },
    null,
    2
  ),
  "crystal-flipper": JSON.stringify(
    {
      version: 1,
      name: "Crystal Flipper",
      rules: [
        {
          id: "buy_crystal_dip",
          when: [
            { kind: "price", item: "crystal", op: "lte", value: "80" },
            { kind: "coin", op: "gte", value: "400" },
          ],
          do: { kind: "buy", item: "crystal", qty: "5", max_price: "90" },
          cooldown: 3,
        },
        {
          id: "sell_crystal_peak",
          when: [
            { kind: "holding", item: "crystal", op: "gte", value: "5" },
            { kind: "price", item: "crystal", op: "gte", value: "110" },
          ],
          do: { kind: "sell", item: "crystal", qty: "5", min_price: "100" },
          cooldown: 3,
        },
      ],
    },
    null,
    2
  ),
  idle: JSON.stringify(
    {
      version: 1,
      name: "Idle Agent",
      rules: [],
    },
    null,
    2
  ),
};

function canonicalizeJson(val: unknown): unknown {
  if (val === null || typeof val !== "object") {
    return val;
  }
  if (Array.isArray(val)) {
    return val.map(canonicalizeJson);
  }
  const obj = val as Record<string, unknown>;
  const sortedKeys = Object.keys(obj).sort();
  const res: Record<string, unknown> = {};
  for (const k of sortedKeys) {
    res[k] = canonicalizeJson(obj[k]);
  }
  return res;
}

export function canonicalJsonString(val: unknown): string {
  return JSON.stringify(canonicalizeJson(val));
}

export async function sha256Hex(content: string): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle?.digest) {
    const enc = new TextEncoder();
    const buf = await crypto.subtle.digest("SHA-256", enc.encode(content));
    const arr = Array.from(new Uint8Array(buf));
    return arr.map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  let h = 0n;
  for (let i = 0; i < content.length; i++) {
    h = (h * 31n + BigInt(content.charCodeAt(i))) & 0xffffffffffffffffn;
  }
  return h.toString(16).padStart(64, "0");
}

export interface RunAgentBacktestOptions {
  arcId: string;
  seed: string;
  agentJson: string;
  steps: number;
  startCoin: bigint;
  cityId?: string;
}

export type BacktestRunResult =
  | { ok: true; entry: LeaderboardEntry }
  | { ok: false; errors: string[] };

/**
 * Runs in-browser agent backtest with friendly, non-throwing error handling.
 */
export async function runAgentBacktest(
  options: RunAgentBacktestOptions
): Promise<BacktestRunResult> {
  const errors: string[] = [];

  if (options.steps <= 0 || !Number.isInteger(options.steps) || options.steps > 400) {
    errors.push("Steps must be an integer between 1 and 400");
  }

  if (options.startCoin < 0n) {
    errors.push("Start coin must be non-negative");
  }

  let arc;
  try {
    arc = getArc(options.arcId);
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }

  let parsedRaw: unknown;
  try {
    parsedRaw = JSON.parse(options.agentJson);
  } catch (err) {
    errors.push(`Invalid JSON: ${err instanceof Error ? err.message : String(err)}`);
  }

  let agent: Agent | undefined;
  if (arc && parsedRaw !== undefined && errors.length === 0) {
    try {
      agent = parseAgent(parsedRaw, arc);
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  if (errors.length > 0 || !arc || !agent) {
    return { ok: false, errors };
  }

  try {
    const canonical = canonicalJsonString(parsedRaw);
    const agentHash = await sha256Hex(canonical);
    const pricing = getPricingRules();
    const growth = getGrowthRules();
    const cityId = options.cityId ?? `${options.arcId}_alpha`;

    const backtestRes = backtestAgent({
      arc,
      pricing,
      growth,
      seed: options.seed,
      cityId,
      agent,
      startCoin: options.startCoin,
      steps: options.steps,
    });

    const id = `${agentHash.slice(0, 12)}_${options.arcId}_${options.seed}_${options.steps}_${options.startCoin.toString()}`;

    const entry: LeaderboardEntry = {
      id,
      name: agent.name,
      arcId: options.arcId,
      seed: options.seed,
      steps: options.steps,
      startCoin: options.startCoin,
      score: backtestRes.score,
      trades: backtestRes.trades,
      stateRoot: backtestRes.stateRoot,
      agentHash,
      agentJson: options.agentJson,
    };

    return { ok: true, entry };
  } catch (err) {
    return {
      ok: false,
      errors: [err instanceof Error ? err.message : String(err)],
    };
  }
}

export interface VerifyEntryResult {
  verified: boolean;
  scoreMatches: boolean;
  rootMatches: boolean;
}

/**
 * Re-runs simulation on the same seed to independently verify score and root.
 */
export async function verifyEntry(
  entry: LeaderboardEntry,
  agentJson: string
): Promise<VerifyEntryResult> {
  try {
    const arc = getArc(entry.arcId);
    const parsedRaw = JSON.parse(agentJson);
    const agent = parseAgent(parsedRaw, arc);
    const canonical = canonicalJsonString(parsedRaw);
    const hash = await sha256Hex(canonical);

    const pricing = getPricingRules();
    const growth = getGrowthRules();
    const cityId = `${entry.arcId}_alpha`;

    const res = backtestAgent({
      arc,
      pricing,
      growth,
      seed: entry.seed,
      cityId,
      agent,
      startCoin: entry.startCoin,
      steps: entry.steps,
    });

    const scoreMatches = res.score === entry.score;
    const rootMatches = res.stateRoot === entry.stateRoot;
    const hashMatches = !entry.agentHash || hash === entry.agentHash;
    const verified = scoreMatches && rootMatches && hashMatches;

    return { verified, scoreMatches, rootMatches };
  } catch {
    return { verified: false, scoreMatches: false, rootMatches: false };
  }
}

/**
 * Ranks leaderboard entries: score descending, fewer trades, then name alphabetically.
 */
export function rankEntries(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return [...entries].sort((a, b) => {
    if (a.score !== b.score) {
      return a.score > b.score ? -1 : 1;
    }
    if (a.trades !== b.trades) {
      return a.trades - b.trades;
    }
    const nameCmp = a.name.localeCompare(b.name);
    if (nameCmp !== 0) {
      return nameCmp;
    }
    return a.id.localeCompare(b.id);
  });
}

export function serializeEntry(entry: LeaderboardEntry): SerializedLeaderboardEntry {
  return {
    ...entry,
    startCoin: entry.startCoin.toString(),
    score: entry.score.toString(),
  };
}

export function deserializeEntry(s: SerializedLeaderboardEntry): LeaderboardEntry {
  return {
    ...s,
    startCoin: BigInt(s.startCoin),
    score: BigInt(s.score),
  };
}

/**
 * Loads leaderboard from local storage safely without throwing.
 */
export function loadLeaderboard(
  storage?: StorageLike,
  key: string = LEADERBOARD_STORAGE_KEY
): LeaderboardEntry[] {
  try {
    const s = storage ?? (typeof window !== "undefined" ? window.localStorage : undefined);
    if (!s) return [];
    const raw = s.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => deserializeEntry(item as SerializedLeaderboardEntry))
      .slice(0, MAX_LEADERBOARD_ENTRIES);
  } catch {
    return [];
  }
}

/**
 * Saves leaderboard to local storage safely, capped at 20 entries.
 */
export function saveLeaderboard(
  entries: LeaderboardEntry[],
  storage?: StorageLike,
  key: string = LEADERBOARD_STORAGE_KEY
): void {
  try {
    const s = storage ?? (typeof window !== "undefined" ? window.localStorage : undefined);
    if (!s) return;
    const capped = entries.slice(0, MAX_LEADERBOARD_ENTRIES);
    const serialized = capped.map(serializeEntry);
    s.setItem(key, JSON.stringify(serialized));
  } catch {
    // Storage quota or sandboxed access failure: catch gracefully
  }
}
