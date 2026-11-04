/**
 * Checkpoint builder, arc caps calculator, and flow conservation checker.
 * Erasable TypeScript only, zero dependencies, BigInt arithmetic.
 * Field names strictly follow contracts/afterhours/src/checkpoint.rs.
 */

import { cityRoot } from "./roots.ts";
import { flowsFromEvents } from "./step.ts";
import type { ArcFile, CityState, SimEvent } from "./types.ts";

export interface ItemFlow {
  produced: string;
  consumed_recipe: string;
  consumed_pop: string;
  sourced: string;
  sunk: string;
  trade_to_players: string;
  trade_from_players: string;
}

export interface CoinFlow {
  sourced: string;
  sunk: string;
  trade_to_players: string;
  trade_from_players: string;
}

export interface PlayerDelta {
  account: string;
  token_id: string;
  delta_in: string;
  delta_out: string;
}

export interface Checkpoint {
  city_id: string;
  from_step: number;
  to_step: number;
  new_state_root: string;
  new_city_root: string;
  stage: number;
  items: Record<string, ItemFlow>;
  coin: CoinFlow;
  player_deltas: PlayerDelta[];
  executed_order_ids: string[];
}

export interface ArcCapsResult {
  arc_id: string;
  produce_cap_per_step: Record<string, string>;
  consume_cap_per_step: Record<string, string>;
  source_cap_per_step: Record<string, string>;
  sink_cap_per_step: Record<string, string>;
  coin_source_cap_per_step: string;
  coin_sink_cap_per_step: string;
}

export interface BuildCheckpointParams {
  prev: CityState;
  next: CityState;
  events: SimEvent[];
  stateRoot: string;
}

/**
 * Builds a Checkpoint matching the Rust struct shape for window prev.step..next.step.
 */
export function buildCheckpoint(params: BuildCheckpointParams): Checkpoint {
  const { prev, next, events, stateRoot } = params;
  const flows = flowsFromEvents(events);

  // Collect all known item ids from next totals and prev totals
  const allItemIds = new Set<string>([
    ...Object.keys(prev.totals.items),
    ...Object.keys(next.totals.items),
    ...Object.keys(flows),
  ]);
  const sortedItemIds = Array.from(allItemIds).sort();

  const items: Record<string, ItemFlow> = {};
  for (const itemId of sortedItemIds) {
    const f = flows[itemId];
    items[itemId] = {
      produced: (f?.produced ?? 0n).toString(),
      consumed_recipe: (f?.consumed_recipe ?? 0n).toString(),
      consumed_pop: (f?.consumed_pop ?? 0n).toString(),
      sourced: "0",
      sunk: (f?.sunk ?? 0n).toString(),
      trade_to_players: "0",
      trade_from_players: "0",
    };
  }

  const coin: CoinFlow = {
    sourced: "0",
    sunk: "0",
    trade_to_players: "0",
    trade_from_players: "0",
  };

  return {
    city_id: next.city_id,
    from_step: prev.step,
    to_step: next.step,
    new_state_root: stateRoot,
    new_city_root: cityRoot(next),
    stage: next.stage,
    items,
    coin,
    player_deltas: [],
    executed_order_ids: [],
  };
}

/**
 * Computes register_arc arguments with safe upper bounds derived from the arc at its last stage:
 * 1. produce_cap_per_step:
 *    At the last stage, each sector has at most `max_businesses_per_sector` businesses.
 *    Each business running recipe `r` produces `max_per_run_per_business * outputs[item]`.
 *    Summing over all recipes producing that item gives a safe upper bound on single-step production.
 * 2. consume_cap_per_step:
 *    Combines maximum recipe input consumption + maximum citizen consumption.
 *    - Recipe input: max businesses per sector * max_per_run_per_business * inputs[item], summed over recipes.
 *    - Citizen consumption: population bounded by last stage's `min_population` * 2 (or starting pop * 2),
 *      multiplied by per_capita_milli / 1000 for each need that can consume the item (primary or alt).
 * 3. source_cap_per_step / sink_cap_per_step:
 *    Generously bounded at 10,000 units per item per step for future disaster/windfall/trade events.
 * 4. coin_source_cap_per_step / coin_sink_cap_per_step:
 *    Generously bounded at 1,000,000 coin per step for external capital injection and sinks.
 */
export function arcCaps(arc: ArcFile): ArcCapsResult {
  const lastStage = arc.stages[arc.stages.length - 1];
  const maxBizPerSector = lastStage.max_businesses_per_sector;

  // Headroom for population: 2x the last stage's min_population (or starting pop if larger)
  const basePop = lastStage.min_population > arc.citizens.start_population
    ? lastStage.min_population
    : arc.citizens.start_population;
  const popCap = basePop * 2n;

  const produce_cap_per_step: Record<string, string> = {};
  const consume_cap_per_step: Record<string, string> = {};
  const source_cap_per_step: Record<string, string> = {};
  const sink_cap_per_step: Record<string, string> = {};

  const sortedItems = [...arc.items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  for (const item of sortedItems) {
    const itemId = item.id;

    // 1. Production cap
    let maxProd = 0n;
    for (const recipe of arc.recipes) {
      const outQty = recipe.outputs[itemId] ?? 0n;
      if (outQty > 0n) {
        maxProd += maxBizPerSector * recipe.max_per_run_per_business * outQty;
      }
    }
    produce_cap_per_step[itemId] = maxProd.toString();

    // 2. Recipe consumption
    let maxRecipeCons = 0n;
    for (const recipe of arc.recipes) {
      const inQty = recipe.inputs[itemId] ?? 0n;
      if (inQty > 0n) {
        maxRecipeCons += maxBizPerSector * recipe.max_per_run_per_business * inQty;
      }
    }

    // Citizen population consumption
    let maxPopCons = 0n;
    for (const need of arc.citizens.needs) {
      if (need.item === itemId || (need.alt && need.alt.includes(itemId))) {
        // Ceiling division: (popCap * milli + 999) / 1000
        const demand = (popCap * need.per_capita_milli + 999n) / 1000n;
        maxPopCons += demand;
      }
    }

    const totalCons = maxRecipeCons + maxPopCons;
    consume_cap_per_step[itemId] = totalCons.toString();

    // 3. Source & sink item caps: generous constant bound (10,000 units/step)
    source_cap_per_step[itemId] = "10000";
    sink_cap_per_step[itemId] = "10000";
  }

  // 4. Coin caps: generous constant bound (1,000,000 coin/step)
  return {
    arc_id: arc.id,
    produce_cap_per_step,
    consume_cap_per_step,
    source_cap_per_step,
    sink_cap_per_step,
    coin_source_cap_per_step: "1000000",
    coin_sink_cap_per_step: "1000000",
  };
}

/**
 * Pure TypeScript mirror of the smart contract conservation arithmetic (checkpoint.rs lines 244-274).
 * Returns the resulting totals if additions >= deductions for all items and coin.
 * Throws an Error with 'CONSERVATION_UNDERFLOW' otherwise.
 */
export function checkConservation(
  prevTotals: { items: Record<string, bigint>; coin: bigint },
  cp: Checkpoint
): { items: Record<string, bigint>; coin: bigint } {
  const newTotalsItems: Record<string, bigint> = { ...prevTotals.items };

  for (const [itemId, flow] of Object.entries(cp.items)) {
    const oldTotal = prevTotals.items[itemId] ?? 0n;
    let additions = oldTotal;
    additions += BigInt(flow.produced);
    additions += BigInt(flow.sourced);
    additions += BigInt(flow.trade_from_players);

    let deductions = BigInt(flow.consumed_recipe);
    deductions += BigInt(flow.consumed_pop);
    deductions += BigInt(flow.sunk);
    deductions += BigInt(flow.trade_to_players);

    if (additions < deductions) {
      throw new Error(`CONSERVATION_UNDERFLOW: item ${itemId} additions ${additions} < deductions ${deductions}`);
    }
    newTotalsItems[itemId] = additions - deductions;
  }

  let coinAdditions = prevTotals.coin;
  coinAdditions += BigInt(cp.coin.sourced);
  coinAdditions += BigInt(cp.coin.trade_from_players);

  let coinDeductions = BigInt(cp.coin.sunk);
  coinDeductions += BigInt(cp.coin.trade_to_players);

  if (coinAdditions < coinDeductions) {
    throw new Error(`CONSERVATION_UNDERFLOW: coin additions ${coinAdditions} < deductions ${coinDeductions}`);
  }
  const newTotalCoin = coinAdditions - coinDeductions;

  return { items: newTotalsItems, coin: newTotalCoin };
}
