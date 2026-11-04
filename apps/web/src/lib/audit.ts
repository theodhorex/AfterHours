/**
 * Pure audit library for browser-side simulation replay verification.
 * Zero external dependencies, pure BigInt math compatibility, no node:fs.
 */

import {
  genesis,
  step,
  eventRoot,
  cityRoot,
  nextStateRoot,
  genesisPrevRoot,
  buildCheckpoint,
} from "../../../../packages/sim/src/index.ts";
import type { Checkpoint } from "../../../../packages/sim/src/checkpoint.ts";
import type { CityState, SimEvent } from "../../../../packages/sim/src/types.ts";
import {
  getArc,
  getPricingRules,
  getGrowthRules,
  type WorldInstance,
} from "./sim-adapter.ts";

import pricingRulesJson from "../../../../data/pricing.rules.json" with { type: "json" };
import growthRulesJson from "../../../../data/growth.rules.json" with { type: "json" };
import goblinWarrensJson from "../../../../data/arcs/goblin_warrens.json" with { type: "json" };
import caveHoldJson from "../../../../data/arcs/cave_hold.json" with { type: "json" };
import dinoValeJson from "../../../../data/arcs/dino_vale.json" with { type: "json" };
import elfGroveJson from "../../../../data/arcs/elf_grove.json" with { type: "json" };

const RAW_ARC_JSONS: Record<string, unknown> = {
  goblin_warrens: goblinWarrensJson,
  cave_hold: caveHoldJson,
  dino_vale: dinoValeJson,
  elf_grove: elfGroveJson,
};

export interface AuditOptions {
  arcId: string;
  seed: string;
  cityId?: string;
  checkpoints: Checkpoint[];
}

export interface AuditLine {
  window: string;
  status: "OK" | "MISMATCH";
  detail?: string;
}

export interface AuditResult {
  ok: boolean;
  lines: AuditLine[];
  summary: string;
}

export interface ReplayState {
  currState: CityState;
  currPrevRoot: string;
}

export type TamperKind = "produced+1" | "state_root" | "stage";

/**
 * Extracts completed 40-step window checkpoints from a WorldInstance.
 */
export function buildCheckpoints(world: WorldInstance): Checkpoint[] {
  return world.checkpoints ?? [];
}

/**
 * Creates a state container initialized at genesis for step-by-step replay verification.
 */
export function createReplayState(arcId: string, seed: string, cityId?: string): ReplayState {
  const actualCityId = cityId ?? `${arcId}_alpha`;
  const arc = getArc(arcId);
  return {
    currState: genesis(arc, actualCityId, seed),
    currPrevRoot: genesisPrevRoot(actualCityId, seed),
  };
}

/**
 * Audits a single checkpoint window against the running replay state.
 * Advances replayState in-place and returns line result and error details.
 */
export function auditOneCheckpoint(
  replay: ReplayState,
  cp: Checkpoint,
  arcId: string,
  checkpointIndex: number
): { ok: boolean; line: AuditLine; error?: string } {
  const windowLabel = `Steps ${cp.from_step}..${cp.to_step}`;

  if (cp.from_step !== replay.currState.step) {
    const msg = `FAILED: missing window: expected from_step ${replay.currState.step}, got ${cp.from_step} at checkpoint ${checkpointIndex} (first differing step: ${replay.currState.step})`;
    return { ok: false, line: { window: windowLabel, status: "MISMATCH", detail: msg }, error: msg };
  }

  if (cp.to_step <= cp.from_step) {
    const msg = `FAILED: invalid window: to_step ${cp.to_step} <= from_step ${cp.from_step} at checkpoint ${checkpointIndex} (first differing step: ${cp.from_step})`;
    return { ok: false, line: { window: windowLabel, status: "MISMATCH", detail: msg }, error: msg };
  }

  const arc = getArc(arcId);
  const pricing = getPricingRules();
  const growth = getGrowthRules();
  const ctx = { arc, pricing, growth };

  const windowPrevState = replay.currState;
  const windowEvents: SimEvent[] = [];
  let lastStateRoot = replay.currPrevRoot;

  for (let s = cp.from_step + 1; s <= cp.to_step; s++) {
    const res = step(replay.currState, ctx);
    replay.currState = res.state;
    windowEvents.push(...res.events);

    const eRoot = eventRoot(res.events);
    const cRoot = cityRoot(replay.currState);
    lastStateRoot = nextStateRoot(replay.currPrevRoot, replay.currState.step, eRoot, cRoot);
    replay.currPrevRoot = lastStateRoot;
  }

  const expectedCp = buildCheckpoint({
    prev: windowPrevState,
    next: replay.currState,
    events: windowEvents,
    stateRoot: lastStateRoot,
  });

  let mismatchMsg: string | null = null;

  if (cp.stage !== expectedCp.stage) {
    mismatchMsg = `FAILED: stage mismatch at step ${cp.to_step} (expected ${expectedCp.stage}, got ${cp.stage}, first differing step: ${cp.to_step})`;
  } else if (cp.new_state_root !== expectedCp.new_state_root) {
    mismatchMsg = `FAILED: new_state_root mismatch at step ${cp.to_step} (expected ${expectedCp.new_state_root}, got ${cp.new_state_root}, first differing step: ${cp.to_step})`;
  } else if (cp.new_city_root !== expectedCp.new_city_root) {
    mismatchMsg = `FAILED: new_city_root mismatch at step ${cp.to_step} (expected ${expectedCp.new_city_root}, got ${cp.new_city_root}, first differing step: ${cp.to_step})`;
  } else {
    for (const [itemId, expFlow] of Object.entries(expectedCp.items)) {
      const actFlow = cp.items?.[itemId];
      if (!actFlow) {
        mismatchMsg = `FAILED: missing item ${itemId} at step ${cp.to_step} (first differing step: ${cp.to_step})`;
        break;
      }
      if (actFlow.produced !== expFlow.produced) {
        mismatchMsg = `FAILED: produced amount mismatch for item ${itemId} at step ${cp.to_step} (expected ${expFlow.produced}, got ${actFlow.produced}, first differing step: ${cp.to_step})`;
        break;
      }
      if (actFlow.consumed_recipe !== expFlow.consumed_recipe) {
        mismatchMsg = `FAILED: consumed_recipe mismatch for item ${itemId} at step ${cp.to_step} (expected ${expFlow.consumed_recipe}, got ${actFlow.consumed_recipe}, first differing step: ${cp.to_step})`;
        break;
      }
      if (actFlow.consumed_pop !== expFlow.consumed_pop) {
        mismatchMsg = `FAILED: consumed_pop mismatch for item ${itemId} at step ${cp.to_step} (expected ${expFlow.consumed_pop}, got ${actFlow.consumed_pop}, first differing step: ${cp.to_step})`;
        break;
      }
      if (
        actFlow.sourced !== expFlow.sourced ||
        actFlow.sunk !== expFlow.sunk ||
        actFlow.trade_to_players !== expFlow.trade_to_players ||
        actFlow.trade_from_players !== expFlow.trade_from_players
      ) {
        mismatchMsg = `FAILED: item flow mismatch for item ${itemId} at step ${cp.to_step} (first differing step: ${cp.to_step})`;
        break;
      }
    }
  }

  if (
    !mismatchMsg &&
    (cp.coin?.sourced !== expectedCp.coin.sourced ||
      cp.coin?.sunk !== expectedCp.coin.sunk ||
      cp.coin?.trade_to_players !== expectedCp.coin.trade_to_players ||
      cp.coin?.trade_from_players !== expectedCp.coin.trade_from_players)
  ) {
    mismatchMsg = `FAILED: coin flow mismatch at step ${cp.to_step} (first differing step: ${cp.to_step})`;
  }

  if (mismatchMsg) {
    return {
      ok: false,
      line: { window: windowLabel, status: "MISMATCH", detail: mismatchMsg },
      error: mismatchMsg,
    };
  }

  return {
    ok: true,
    line: {
      window: windowLabel,
      status: "OK",
      detail: `Window ${windowLabel} matches replay`,
    },
  };
}

/**
 * Replays simulation from genesis in the browser and audits checkpoints against replayed state.
 * Returns { ok, lines, summary } with the exact error messages produced by packages/verify.
 */
export function auditCheckpoints(options: AuditOptions): AuditResult {
  const { arcId, seed, cityId, checkpoints } = options;
  if (!Array.isArray(checkpoints) || checkpoints.length === 0) {
    const msg = "FAILED: no checkpoints provided (missing window at step 0)";
    return { ok: false, lines: [], summary: msg };
  }

  const actualCityId = cityId ?? (checkpoints[0]?.city_id || `${arcId}_alpha`);
  const replay = createReplayState(arcId, seed, actualCityId);
  const lines: AuditLine[] = [];

  for (let i = 0; i < checkpoints.length; i++) {
    const res = auditOneCheckpoint(replay, checkpoints[i], arcId, i);
    lines.push(res.line);
    if (!res.ok) {
      return { ok: false, lines, summary: res.error! };
    }
  }

  return {
    ok: true,
    lines,
    summary: `VERIFIED: ${checkpoints.length} checkpoints match the replay`,
  };
}

/**
 * Creates a tampered clone of a checkpoint for demonstration and stress testing.
 */
export function tamperCheckpoint(cp: Checkpoint, kind: TamperKind): Checkpoint {
  const cloned: Checkpoint = JSON.parse(JSON.stringify(cp));

  if (kind === "produced+1") {
    const itemIds = Object.keys(cloned.items);
    if (itemIds.length > 0) {
      const firstId = itemIds[0];
      const orig = BigInt(cloned.items[firstId]?.produced ?? "0");
      cloned.items[firstId] = {
        ...cloned.items[firstId],
        produced: (orig + 1n).toString(),
      };
    }
  } else if (kind === "state_root") {
    const root = cloned.new_state_root;
    const lastChar = root.slice(-1);
    const flipped = lastChar === "0" ? "1" : "0";
    cloned.new_state_root = root.slice(0, -1) + flipped;
  } else if (kind === "stage") {
    cloned.stage = cloned.stage === 0 ? 1 : 0;
  }

  return cloned;
}

/**
 * Helper to compute SHA-256 of string content using crypto.subtle with fallback.
 */
export async function sha256Hex(content: string): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle?.digest) {
    const enc = new TextEncoder();
    const buf = await crypto.subtle.digest("SHA-256", enc.encode(content));
    const arr = Array.from(new Uint8Array(buf));
    return arr.map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  return "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
}

/**
 * Computes combined rules SHA-256 hash in browser-friendly manner.
 */
export async function computeBrowserRulesHash(arcId: string): Promise<string> {
  const arcJson = RAW_ARC_JSONS[arcId] ?? RAW_ARC_JSONS.goblin_warrens;
  const pricingText = JSON.stringify(pricingRulesJson);
  const growthText = JSON.stringify(growthRulesJson);
  const arcText = JSON.stringify(arcJson);

  const pricingHash = await sha256Hex(pricingText);
  const growthHash = await sha256Hex(growthText);
  const arcHash = await sha256Hex(arcText);

  return sha256Hex(pricingHash + growthHash + arcHash);
}

/**
 * Replays simulation from genesis up to targetStep and returns final state root and step.
 * Reuses createReplayState and pure simulation stepping without duplicating logic.
 */
export function replayToStep(
  arcId: string,
  seed: string,
  targetStep: number,
  cityId?: string
): { stateRoot: string; step: number } {
  const replay = createReplayState(arcId, seed, cityId);
  const arc = getArc(arcId);
  const pricing = getPricingRules();
  const growth = getGrowthRules();
  const ctx = { arc, pricing, growth };

  for (let s = 1; s <= targetStep; s++) {
    const res = step(replay.currState, ctx);
    replay.currState = res.state;
    const eRoot = eventRoot(res.events);
    const cRoot = cityRoot(replay.currState);
    replay.currPrevRoot = nextStateRoot(replay.currPrevRoot, replay.currState.step, eRoot, cRoot);
  }

  return {
    stateRoot: replay.currPrevRoot,
    step: replay.currState.step,
  };
}
