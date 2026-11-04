/**
 * Step runner for multi-step simulation.
 * Erasable TypeScript only, zero external dependencies.
 */

import { genesisPrevRoot, nextStateRoot, cityRoot, eventRoot } from "./roots.ts";
import { step } from "./step.ts";
import type { ArcFile, CityState, SimEvent } from "./types.ts";
import type { PricingRules } from "./pricing.ts";
import type { GrowthRules } from "./growth.ts";

export interface RunStepsResult {
  state: CityState;
  events: SimEvent[];
  roots: string[];
}

export function runSteps(
  state: CityState,
  n: number,
  ctx: { arc: ArcFile; pricing: PricingRules; growth: GrowthRules },
  prevRoot?: string
): RunStepsResult {
  let currState = state;
  let currPrevRoot = prevRoot ?? genesisPrevRoot(state.city_id, state.world_seed);
  const allEvents: SimEvent[] = [];
  const roots: string[] = [];

  for (let i = 0; i < n; i++) {
    const res = step(currState, ctx);
    currState = res.state;
    allEvents.push(...res.events);

    const eRoot = eventRoot(res.events);
    const cRoot = cityRoot(currState);
    const sRoot = nextStateRoot(currPrevRoot, currState.step, eRoot, cRoot);
    roots.push(sRoot);
    currPrevRoot = sRoot;
  }

  return { state: currState, events: allEvents, roots };
}
