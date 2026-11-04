/**
 * Simulation replay and checkpoint verifier.
 * Erasable TypeScript only, zero dependencies.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { parseArc } from "../../sim/src/arc.ts";
import { genesis } from "../../sim/src/genesis.ts";
import { parsePricingRules } from "../../sim/src/pricing.ts";
import { parseGrowthRules } from "../../sim/src/growth.ts";
import { step } from "../../sim/src/step.ts";
import { cityRoot, nextStateRoot, eventRoot, genesisPrevRoot, sectorRoot } from "../../sim/src/roots.ts";
import { buildCheckpoint } from "../../sim/src/checkpoint.ts";
import type { Checkpoint } from "../../sim/src/checkpoint.ts";
import type { SimEvent } from "../../sim/src/types.ts";
import type { PlayerOrder } from "../../sim/src/orders.ts";

export interface VerifyOptions {
  arcId: string;
  seed: string;
  cityId: string;
  checkpoints: Checkpoint[];
  /** Player orders per step (the replay needs the same orders the operator executed). */
  orders?: Record<number, PlayerOrder[]>;
  dataDir?: string;
}

export interface VerifyResult {
  success: boolean;
  count: number;
  lines: string[];
  finalLine: string;
  error?: string;
}

export interface RulesHashResult {
  pricing: string;
  growth: string;
  arc?: string;
  combined: string;
}

/**
 * Computes SHA-256 of the three simulation rule files (pricing, growth, arc).
 */
export function computeRulesHash(arcId?: string, dataDir?: string): RulesHashResult {
  const dir = dataDir ?? join(process.cwd(), "data");
  const pricingRaw = readFileSync(join(dir, "pricing.rules.json"));
  const growthRaw = readFileSync(join(dir, "growth.rules.json"));

  const pricingHash = createHash("sha256").update(pricingRaw).digest("hex");
  const growthHash = createHash("sha256").update(growthRaw).digest("hex");

  let arcHash: string | undefined;
  if (arcId) {
    const arcRaw = readFileSync(join(dir, "arcs", `${arcId}.json`));
    arcHash = createHash("sha256").update(arcRaw).digest("hex");
  }

  const combinedHasher = createHash("sha256");
  combinedHasher.update(pricingHash);
  combinedHasher.update(growthHash);
  if (arcHash) {
    combinedHasher.update(arcHash);
  }
  const combined = combinedHasher.digest("hex");

  return {
    pricing: pricingHash,
    growth: growthHash,
    arc: arcHash,
    combined,
  };
}

function toBig(v: unknown, field: string): bigint | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v === "bigint") return v;
  if (typeof v === "string" && /^-?[0-9]+$/.test(v)) return BigInt(v);
  if (typeof v === "number" && Number.isInteger(v)) return BigInt(v);
  throw new TypeError(`orders file: field '${field}' must be an integer or decimal string`);
}

/**
 * Parses an orders file: an array of `{ step, orders: [...] }`, with amounts as decimal strings.
 */
export function parseOrdersFile(json: unknown): Record<number, PlayerOrder[]> {
  if (!Array.isArray(json)) throw new TypeError("orders file must be an array of { step, orders }");
  const out: Record<number, PlayerOrder[]> = {};
  for (const entry of json) {
    if (typeof entry !== "object" || entry === null) throw new TypeError("orders file: each entry must be an object");
    const e = entry as Record<string, unknown>;
    if (typeof e.step !== "number" || !Number.isInteger(e.step) || e.step < 1) throw new TypeError("orders file: 'step' must be a positive integer");
    if (!Array.isArray(e.orders)) throw new TypeError("orders file: 'orders' must be an array");
    const list: PlayerOrder[] = [];
    for (const o of e.orders as Record<string, unknown>[]) {
      if (typeof o.order_id !== "string" || typeof o.account !== "string") throw new TypeError("orders file: order_id and account must be strings");
      if (o.kind !== "buy" && o.kind !== "sell" && o.kind !== "invest") throw new TypeError("orders file: kind must be buy, sell or invest");
      list.push({
        order_id: o.order_id,
        account: o.account,
        kind: o.kind,
        item: typeof o.item === "string" ? o.item : undefined,
        qty: toBig(o.qty, "qty"),
        limit_price: toBig(o.limit_price, "limit_price"),
        business_id: typeof o.business_id === "string" ? o.business_id : undefined,
        amount: toBig(o.amount, "amount"),
      });
    }
    out[e.step] = [...(out[e.step] ?? []), ...list];
  }
  return out;
}

/**
 * Replays simulation from genesis and verifies each checkpoint against replayed roots and flows.
 */
export function verifyCheckpoints(options: VerifyOptions): VerifyResult {
  const { arcId, seed, cityId, checkpoints, dataDir, orders } = options;
  const executedIds = new Set<string>();
  const dir = dataDir ?? join(process.cwd(), "data");

  if (!Array.isArray(checkpoints) || checkpoints.length === 0) {
    const msg = "FAILED: no checkpoints provided (missing window at step 0)";
    return { success: false, count: 0, lines: [], finalLine: msg, error: msg };
  }

  // Load rules
  const arcJson = JSON.parse(readFileSync(join(dir, "arcs", `${arcId}.json`), "utf-8"));
  const arc = parseArc(arcJson);
  const pricingRaw = readFileSync(join(dir, "pricing.rules.json"), "utf-8");
  const pricing = parsePricingRules(pricingRaw);
  const growthRaw = JSON.parse(readFileSync(join(dir, "growth.rules.json"), "utf-8"));
  const growth = parseGrowthRules(growthRaw);
  const ctx = { arc, pricing, growth };

  let currState = genesis(arc, cityId, seed);
  let currPrevRoot = genesisPrevRoot(cityId, seed);
  let verifiedCount = 0;
  const lines: string[] = [];

  for (let i = 0; i < checkpoints.length; i++) {
    const cp = checkpoints[i];

    // Continuity check
    if (cp.from_step !== currState.step) {
      lines.push("MISMATCH");
      const msg = `FAILED: missing window: expected from_step ${currState.step}, got ${cp.from_step} at checkpoint ${i} (first differing step: ${currState.step})`;
      return { success: false, count: verifiedCount, lines, finalLine: msg, error: msg };
    }

    if (cp.to_step <= cp.from_step) {
      lines.push("MISMATCH");
      const msg = `FAILED: invalid window: to_step ${cp.to_step} <= from_step ${cp.from_step} at checkpoint ${i} (first differing step: ${cp.from_step})`;
      return { success: false, count: verifiedCount, lines, finalLine: msg, error: msg };
    }

    const windowPrevState = currState;
    const windowEvents: SimEvent[] = [];
    let lastStateRoot = currPrevRoot;

    // Replay step by step
    for (let s = cp.from_step + 1; s <= cp.to_step; s++) {
      const res = step(currState, { ...ctx, orders: orders?.[s] ?? [], executedIds });
      for (const ev of res.events) if (ev.event === "order_accepted") executedIds.add(ev.order_id as string);
      currState = res.state;
      windowEvents.push(...res.events);

      const eRoot = eventRoot(res.events);
      const cRoot = cityRoot(currState);
      lastStateRoot = nextStateRoot(currPrevRoot, currState.step, eRoot, cRoot);
      currPrevRoot = lastStateRoot;
    }

    const expectedCp = buildCheckpoint({
      prev: windowPrevState,
      next: currState,
      events: windowEvents,
      stateRoot: lastStateRoot,
    });

    // 1. Verify stage
    if (cp.stage !== expectedCp.stage) {
      lines.push("MISMATCH");
      const msg = `FAILED: stage mismatch at step ${cp.to_step} (expected ${expectedCp.stage}, got ${cp.stage}, first differing step: ${cp.to_step})`;
      return { success: false, count: verifiedCount, lines, finalLine: msg, error: msg };
    }

    // 2. Verify state root
    if (cp.new_state_root !== expectedCp.new_state_root) {
      lines.push("MISMATCH");
      const msg = `FAILED: new_state_root mismatch at step ${cp.to_step} (expected ${expectedCp.new_state_root}, got ${cp.new_state_root}, first differing step: ${cp.to_step})`;
      return { success: false, count: verifiedCount, lines, finalLine: msg, error: msg };
    }

    // 3. Verify city root
    if (cp.new_city_root !== expectedCp.new_city_root) {
      lines.push("MISMATCH");
      let sectorDiffMsg = "";
      const cpSectorRoots = (cp as unknown as { sector_roots?: string[] }).sector_roots;
      if (Array.isArray(cpSectorRoots) && cpSectorRoots.length === 6) {
        const differingSectors: number[] = [];
        for (let secIdx = 0; secIdx < 6; secIdx++) {
          const expectedSectorRoot = sectorRoot(currState.sectors[secIdx]);
          if (cpSectorRoots[secIdx] !== expectedSectorRoot) {
            differingSectors.push(secIdx);
          }
        }
        sectorDiffMsg = `, differing sector roots: [${differingSectors.join(", ")}]`;
      } else {
        const activeSectors: number[] = [];
        for (let secIdx = 0; secIdx < 6; secIdx++) {
          if (sectorRoot(windowPrevState.sectors[secIdx]) !== sectorRoot(currState.sectors[secIdx])) {
            activeSectors.push(secIdx);
          }
        }
        sectorDiffMsg = `, replayed active sector roots in window: [${activeSectors.join(", ")}]`;
      }
      const msg = `FAILED: new_city_root mismatch at step ${cp.to_step} (expected ${expectedCp.new_city_root}, got ${cp.new_city_root}, first differing step: ${cp.to_step}${sectorDiffMsg})`;
      return { success: false, count: verifiedCount, lines, finalLine: msg, error: msg };
    }

    // 4. Verify item flows
    for (const [itemId, expFlow] of Object.entries(expectedCp.items)) {
      const actFlow = cp.items?.[itemId];
      if (!actFlow) {
        lines.push("MISMATCH");
        const msg = `FAILED: missing item ${itemId} at step ${cp.to_step} (first differing step: ${cp.to_step})`;
        return { success: false, count: verifiedCount, lines, finalLine: msg, error: msg };
      }
      if (actFlow.produced !== expFlow.produced) {
        lines.push("MISMATCH");
        const msg = `FAILED: produced amount mismatch for item ${itemId} at step ${cp.to_step} (expected ${expFlow.produced}, got ${actFlow.produced}, first differing step: ${cp.to_step})`;
        return { success: false, count: verifiedCount, lines, finalLine: msg, error: msg };
      }
      if (actFlow.consumed_recipe !== expFlow.consumed_recipe) {
        lines.push("MISMATCH");
        const msg = `FAILED: consumed_recipe mismatch for item ${itemId} at step ${cp.to_step} (expected ${expFlow.consumed_recipe}, got ${actFlow.consumed_recipe}, first differing step: ${cp.to_step})`;
        return { success: false, count: verifiedCount, lines, finalLine: msg, error: msg };
      }
      if (actFlow.consumed_pop !== expFlow.consumed_pop) {
        lines.push("MISMATCH");
        const msg = `FAILED: consumed_pop mismatch for item ${itemId} at step ${cp.to_step} (expected ${expFlow.consumed_pop}, got ${actFlow.consumed_pop}, first differing step: ${cp.to_step})`;
        return { success: false, count: verifiedCount, lines, finalLine: msg, error: msg };
      }
      if (
        actFlow.sourced !== expFlow.sourced ||
        actFlow.sunk !== expFlow.sunk ||
        actFlow.trade_to_players !== expFlow.trade_to_players ||
        actFlow.trade_from_players !== expFlow.trade_from_players
      ) {
        lines.push("MISMATCH");
        const msg = `FAILED: item flow mismatch for item ${itemId} at step ${cp.to_step} (first differing step: ${cp.to_step})`;
        return { success: false, count: verifiedCount, lines, finalLine: msg, error: msg };
      }
    }

    // 5. Verify coin flow
    if (
      cp.coin?.sourced !== expectedCp.coin.sourced ||
      cp.coin?.sunk !== expectedCp.coin.sunk ||
      cp.coin?.trade_to_players !== expectedCp.coin.trade_to_players ||
      cp.coin?.trade_from_players !== expectedCp.coin.trade_from_players
    ) {
      lines.push("MISMATCH");
      const msg = `FAILED: coin flow mismatch at step ${cp.to_step} (first differing step: ${cp.to_step})`;
      return { success: false, count: verifiedCount, lines, finalLine: msg, error: msg };
    }

    lines.push("OK");
    verifiedCount++;
  }

  const finalLine = `VERIFIED: ${verifiedCount} checkpoints match the replay`;
  return {
    success: true,
    count: verifiedCount,
    lines,
    finalLine,
  };
}
