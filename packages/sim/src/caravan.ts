/**
 * Inter-city caravan trade engine for AfterHours simulation.
 * Pure functions, immutable state updates, conservation-safe.
 * BigInt arithmetic only, zero external dependencies, erasable TypeScript.
 */

import { arcCaps, type CoinFlow, type ItemFlow } from "./checkpoint.ts";
import type { ArcFile, Business, CityState, SectorState } from "./types.ts";

export interface CaravanPlan {
  qty: bigint;
  unitPrice: bigint;
  coin: bigint;
}

export type CaravanContext = { arc: ArcFile } | ArcFile;

export interface CaravanFlows {
  items: Record<string, ItemFlow>;
  coin: CoinFlow;
}

export interface ApplyCaravanResult {
  a: CityState;
  b: CityState;
  flowsA: CaravanFlows;
  flowsB: CaravanFlows;
}

function getArc(ctx: CaravanContext): ArcFile {
  return "arc" in ctx ? ctx.arc : ctx;
}

function emptyItemFlow(): ItemFlow {
  return {
    produced: "0",
    consumed_recipe: "0",
    consumed_pop: "0",
    sourced: "0",
    sunk: "0",
    trade_to_players: "0",
    trade_from_players: "0",
  };
}

function emptyCoinFlow(): CoinFlow {
  return {
    sourced: "0",
    sunk: "0",
    trade_to_players: "0",
    trade_from_players: "0",
  };
}

function cloneCityState(state: CityState): CityState {
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

  return {
    city_id: state.city_id,
    arc_id: state.arc_id,
    step: state.step,
    world_seed: state.world_seed,
    stage: state.stage,
    sectors,
    citizens: {
      population: state.citizens.population,
      satisfaction_bps: state.citizens.satisfaction_bps,
      purse: state.citizens.purse,
    },
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
}

/**
 * Pure planner: plans a trade moving item from seller city A to buyer city B.
 * Returns null when trade is not sensible:
 * - unknown item in either city
 * - price spread not positive for the seller (priceB <= priceA)
 * - seller has no surplus inventory
 * - buyer cannot afford even 1 unit
 * - maxQty <= 0
 * Bounded by maxQty, seller surplus, buyer coin, and both cities' arc caps.
 */
export function planCaravan(
  a: CityState,
  b: CityState,
  ctxA: CaravanContext,
  ctxB: CaravanContext,
  item: string,
  maxQty: bigint
): CaravanPlan | null {
  if (maxQty <= 0n) return null;

  const priceA = a.market?.price?.[item];
  const priceB = b.market?.price?.[item];
  if (priceA === undefined || priceB === undefined || priceA <= 0n || priceB <= 0n) {
    return null;
  }

  // Price spread must be positive for the seller
  if (priceB <= priceA) {
    return null;
  }

  // Midpoint price (integer arithmetic)
  const unitPrice = (priceA + priceB) / 2n;
  if (unitPrice <= 0n) return null;

  // Seller physical surplus
  let physicalSurplus = 0n;
  for (const sec of a.sectors) {
    for (const biz of sec.businesses) {
      physicalSurplus += biz.inventory[item] ?? 0n;
    }
  }
  const totalsSurplus = a.totals.items[item] ?? 0n;
  const aSurplus = physicalSurplus < totalsSurplus ? physicalSurplus : totalsSurplus;
  if (aSurplus <= 0n) return null;

  // Buyer available coin: treasury first, plus purse
  const bTreasury = b.treasury > 0n ? b.treasury : 0n;
  const bPurse = b.citizens.purse > 0n ? b.citizens.purse : 0n;
  const bCoin = bTreasury + bPurse;
  if (bCoin < unitPrice) return null;

  // Arc caps
  const arcA = getArc(ctxA);
  const arcB = getArc(ctxB);
  const capsA = arcCaps(arcA);
  const capsB = arcCaps(arcB);

  const sinkCapA = BigInt(capsA.sink_cap_per_step[item] ?? "0");
  const sourceCapB = BigInt(capsB.source_cap_per_step[item] ?? "0");
  const coinSourceCapA = BigInt(capsA.coin_source_cap_per_step);
  const coinSinkCapB = BigInt(capsB.coin_sink_cap_per_step);

  let qty = maxQty;
  if (aSurplus < qty) qty = aSurplus;
  if (sinkCapA < qty) qty = sinkCapA;
  if (sourceCapB < qty) qty = sourceCapB;

  const maxByCoin = bCoin / unitPrice;
  if (maxByCoin < qty) qty = maxByCoin;

  const maxByCoinCapA = coinSourceCapA / unitPrice;
  if (maxByCoinCapA < qty) qty = maxByCoinCapA;

  const maxByCoinCapB = coinSinkCapB / unitPrice;
  if (maxByCoinCapB < qty) qty = maxByCoinCapB;

  if (qty <= 0n) return null;

  const coin = qty * unitPrice;
  return { qty, unitPrice, coin };
}

/**
 * Apply: executes a caravan trade immutably between city A and city B.
 * Takes inventory from A's businesses deterministically in sorted business-id order.
 * Adds inventory to B's first sector (first business in sorted business-id order).
 * Updates coin and state totals consistently.
 * Returns new immutable states and checkpoint-compliant flow records.
 */
export function applyCaravan(
  a: CityState,
  b: CityState,
  plan: CaravanPlan,
  item: string
): ApplyCaravanResult {
  const nextA = cloneCityState(a);
  const nextB = cloneCityState(b);

  if (plan.qty > 0n) {
    // 1. Take inventory from A's businesses in sorted business-id order
    const allBusinessesA = nextA.sectors
      .flatMap((s) => s.businesses)
      .sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));

    let remaining = plan.qty;
    for (const biz of allBusinessesA) {
      const stock = biz.inventory[item] ?? 0n;
      if (stock <= 0n) continue;

      const take = remaining < stock ? remaining : stock;
      biz.inventory[item] = stock - take;
      if (biz.inventory[item] === 0n) {
        delete biz.inventory[item];
      }
      remaining -= take;
      if (remaining === 0n) break;
    }

    if (remaining > 0n) {
      throw new RangeError(`INSUFFICIENT_INVENTORY: lacking ${remaining} units of ${item}`);
    }

    // 2. Add inventory to B's first sector (sorted business-id order)
    const sector0 = nextB.sectors[0];
    const sortedSector0 = [...sector0.businesses].sort((x, y) =>
      x.id < y.id ? -1 : x.id > y.id ? 1 : 0
    );
    if (sortedSector0.length === 0) {
      throw new Error("NO_BUSINESS_IN_FIRST_SECTOR");
    }
    const targetBiz = sortedSector0[0];
    targetBiz.inventory[item] = (targetBiz.inventory[item] ?? 0n) + plan.qty;
  }

  // 3. Update coin balances
  if (plan.coin > 0n) {
    // A receives coin into treasury
    nextA.treasury += plan.coin;

    // B pays coin from treasury first, then purse
    const fromTreasury = nextB.treasury >= plan.coin ? plan.coin : nextB.treasury;
    const fromPurse = plan.coin - fromTreasury;
    if (nextB.citizens.purse < fromPurse) {
      throw new RangeError("INSUFFICIENT_COIN: buyer lacks coin for caravan");
    }
    nextB.treasury -= fromTreasury;
    nextB.citizens.purse -= fromPurse;
  }

  // 4. Update city totals
  nextA.totals.items[item] = (nextA.totals.items[item] ?? 0n) - plan.qty;
  nextA.totals.coin = nextA.totals.coin + plan.coin;

  nextB.totals.items[item] = (nextB.totals.items[item] ?? 0n) + plan.qty;
  nextB.totals.coin = nextB.totals.coin - plan.coin;

  // 5. Construct flow records
  const flowsA: CaravanFlows = {
    items: {
      [item]: {
        ...emptyItemFlow(),
        sunk: plan.qty.toString(),
      },
    },
    coin: {
      ...emptyCoinFlow(),
      sourced: plan.coin.toString(),
    },
  };

  const flowsB: CaravanFlows = {
    items: {
      [item]: {
        ...emptyItemFlow(),
        sourced: plan.qty.toString(),
      },
    },
    coin: {
      ...emptyCoinFlow(),
      sunk: plan.coin.toString(),
    },
  };

  return { a: nextA, b: nextB, flowsA, flowsB };
}
