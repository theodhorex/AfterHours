/**
 * Adapter module connecting the web interface to the real simulation engine.
 * Single boundary file for sim interaction, isolating parallel changes (e.g. ctx.growth).
 * Zero external dependencies, pure BigInt math compatibility.
 */

import {
  parseArc,
  parsePricingRules,
  parseGrowthRules,
  genesis,
  step,
  cityRoot,
  eventRoot,
  nextStateRoot,
  genesisPrevRoot,
  buildCheckpoint,
} from "../../../../packages/sim/src/index.ts";
import type {
  ArcFile,
  CityState,
  SimEvent,
} from "../../../../packages/sim/src/types.ts";
import type { Checkpoint } from "../../../../packages/sim/src/checkpoint.ts";
import type { PricingRules } from "../../../../packages/sim/src/pricing.ts";
import type { GrowthRules } from "../../../../packages/sim/src/growth.ts";

import goblinWarrensJson from "../../../../data/arcs/goblin_warrens.json" with { type: "json" };
import caveHoldJson from "../../../../data/arcs/cave_hold.json" with { type: "json" };
import dinoValeJson from "../../../../data/arcs/dino_vale.json" with { type: "json" };
import elfGroveJson from "../../../../data/arcs/elf_grove.json" with { type: "json" };
import pricingRulesJson from "../../../../data/pricing.rules.json" with { type: "json" };
import growthRulesJson from "../../../../data/growth.rules.json" with { type: "json" };

export interface SimContext {
  arc: ArcFile;
  pricing: PricingRules;
  growth?: GrowthRules;
}

export interface WorldInstance {
  arcId: string;
  seed: string;
  arc: ArcFile;
  pricing: PricingRules;
  growth?: GrowthRules;
  state: CityState;
  events: SimEvent[];
  stateRoot: string;
  prevPrices?: Record<string, bigint>;
  checkpoints: Checkpoint[];
  windowStartState: CityState;
  windowEvents: SimEvent[];
}

const PARSED_PRICING: PricingRules = parsePricingRules(pricingRulesJson);
const PARSED_GROWTH: GrowthRules = parseGrowthRules(growthRulesJson);

const PARSED_ARCS: Record<string, ArcFile> = {
  goblin_warrens: parseArc(goblinWarrensJson),
  cave_hold: parseArc(caveHoldJson),
  dino_vale: parseArc(dinoValeJson),
  elf_grove: parseArc(elfGroveJson),
};

export const AVAILABLE_ARCS = Object.keys(PARSED_ARCS) as [string, ...string[]];

/**
 * Retrieve parsed Arc definition by ID.
 */
export function getArc(arcId: string): ArcFile {
  const arc = PARSED_ARCS[arcId];
  if (!arc) {
    throw new Error(
      `Unknown arc id '${arcId}'. Available arcs: ${Object.keys(PARSED_ARCS).join(", ")}`
    );
  }
  return arc;
}

/**
 * Retrieve active pricing rules.
 */
export function getPricingRules(): PricingRules {
  return PARSED_PRICING;
}

/**
 * Retrieve active growth rules.
 */
export function getGrowthRules(): GrowthRules {
  return PARSED_GROWTH;
}

/**
 * Creates a brand-new simulation world from arc ID and seed at step 0 (genesis).
 */
export function createWorld(
  arcId: string,
  seed: string,
  cityId?: string,
  growth?: GrowthRules
): WorldInstance {
  const arc = getArc(arcId);
  const pricing = getPricingRules();
  const actualGrowth = growth ?? getGrowthRules();
  const actualCityId = cityId ?? `${arcId}_alpha`;

  const state = genesis(arc, actualCityId, seed);
  const stateRoot = genesisPrevRoot(actualCityId, seed);

  return {
    arcId,
    seed,
    arc,
    pricing,
    growth: actualGrowth,
    state,
    events: [],
    stateRoot,
    prevPrices: { ...state.market.price },
    checkpoints: [],
    windowStartState: state,
    windowEvents: [],
  };
}

/**
 * Advance the simulation world by N steps.
 * Returns a new WorldInstance immutably with updated state, events, and root.
 */
export function advanceWorld(world: WorldInstance, steps: number): WorldInstance {
  if (steps <= 0) return world;

  const prevPrices = { ...world.state.market.price };
  const growth = world.growth ?? getGrowthRules();
  const ctx = {
    arc: world.arc,
    pricing: world.pricing,
    growth,
  };

  let currState = world.state;
  let currRoot = world.stateRoot;
  let windowStart = world.windowStartState ?? world.state;
  let windowEvents = [...(world.windowEvents ?? [])];
  const checkpoints = [...(world.checkpoints ?? [])];
  const stepRunEvents: SimEvent[] = [];

  for (let i = 0; i < steps; i++) {
    const res = step(currState, ctx);
    currState = res.state;
    stepRunEvents.push(...res.events);
    windowEvents.push(...res.events);

    const eRoot = eventRoot(res.events);
    const cRoot = cityRoot(currState);
    currRoot = nextStateRoot(currRoot, currState.step, eRoot, cRoot);

    if (currState.step % 40 === 0) {
      const cp = buildCheckpoint({
        prev: windowStart,
        next: currState,
        events: windowEvents,
        stateRoot: currRoot,
      });
      checkpoints.push(cp);
      windowStart = currState;
      windowEvents = [];
    }
  }

  return {
    ...world,
    state: currState,
    events: stepRunEvents,
    stateRoot: currRoot,
    prevPrices,
    checkpoints,
    windowStartState: windowStart,
    windowEvents,
  };
}
