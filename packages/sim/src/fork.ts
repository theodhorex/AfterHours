/**
 * City fork operations and validation for AfterHours.
 * Creates an independent fork of a city state from a parent checkpoint.
 * Erasable TypeScript syntax only, zero external dependencies.
 */

import { leaf, toHex } from "./hash.ts";
import { cityRoot, eventRoot, nextStateRoot } from "./roots.ts";
import type { CityState, SectorState, SimEvent } from "./types.ts";

/**
 * Computes previous state root for a forked city per specification:
 * prevRoot = leaf({ fork_of: parentStateRoot, city_id: newCityId })
 * Returns a 64-character lowercase hex string.
 */
export function forkPrevRoot(parentStateRoot: string, newCityId: string): string {
  return toHex(leaf({ fork_of: parentStateRoot, city_id: newCityId }));
}

export interface ForkResult {
  state: CityState;
  prevRoot: string;
}

/**
 * Creates an independent fork of a CityState from a parent state root:
 * - Returns a deep copy of the state with city_id = newCityId and step kept.
 * - Computes prevRoot = forkPrevRoot(parentStateRoot, newCityId).
 * - Totals stay consistent; business ids, recipes, and inventories are preserved.
 * - Parent state is never mutated.
 */
export function forkCity(
  state: CityState,
  newCityId: string,
  parentStateRoot: string
): ForkResult {
  const sectors = state.sectors.map((sec) => ({
    idx: sec.idx,
    kind: sec.kind,
    owner: sec.owner,
    arc_origin: sec.arc_origin,
    rules: [...sec.rules],
    businesses: sec.businesses.map((b) => ({
      id: b.id,
      recipe: b.recipe,
      open: b.open,
      coin: b.coin,
      inventory: { ...b.inventory },
      insolvent_steps: b.insolvent_steps,
    })),
  })) as [SectorState, SectorState, SectorState, SectorState, SectorState, SectorState];

  const newState: CityState = {
    city_id: newCityId,
    arc_id: state.arc_id,
    step: state.step,
    world_seed: state.world_seed,
    stage: state.stage,
    sectors,
    citizens: { ...state.citizens },
    market: {
      price: { ...state.market.price },
      demand_ema: { ...state.market.demand_ema },
    },
    treasury: state.treasury,
    totals: {
      items: { ...state.totals.items },
      coin: state.totals.coin,
    },
  };

  const prevRoot = forkPrevRoot(parentStateRoot, newCityId);
  return { state: newState, prevRoot };
}

/**
 * Verifies that the first state root of a fork was correctly computed
 * from the parent checkpoint root.
 */
export function verifyFork(
  parentStateRoot: string,
  forkStateRoot: string,
  forkState: CityState,
  events: SimEvent[]
): boolean {
  const prevRoot = forkPrevRoot(parentStateRoot, forkState.city_id);
  const eRoot = eventRoot(events);
  const cRoot = cityRoot(forkState);
  const expectedRoot = nextStateRoot(prevRoot, forkState.step, eRoot, cRoot);
  return expectedRoot === forkStateRoot;
}
