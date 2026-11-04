/**
 * Growth, closure, auction, entrepreneur entry, population and stage rules.
 * Erasable TypeScript only, zero external dependencies, BigInt arithmetic.
 */

import type { ArcFile, ArcRecipe, Business, CityState, SimEvent } from "./types.ts";

export interface GrowthRules {
  version: number;
  note?: string;
  idle_close_steps: number;
  entry_price_premium_bps: bigint;
  entry_min_margin_bps: bigint;
  entry_purse_reserve: bigint;
  growth_min_satisfaction_bps: bigint;
  growth_bps: bigint;
  shrink_max_satisfaction_bps: bigint;
  shrink_bps: bigint;
  min_population: bigint;
  stage_min_satisfaction_bps: bigint;
  /** Share (bps) of a business's coin above its reserve paid to citizens each step. */
  dividend_bps: bigint;
  /** Working capital a business keeps, as bps of arc.genesis.coin_per_business. */
  dividend_reserve_bps: bigint;
  /** Open, profitable businesses below this coin level (bps of coin_per_business) are topped up from the purse. */
  topup_floor_bps: bigint;
  /** A business stops producing when its stock of an output reaches this many full runs of that output. */
  stock_cap_runs: number;
}

function parseNumberField(obj: Record<string, unknown>, field: string, min?: number, max?: number): number {
  const val = obj[field];
  if (typeof val !== "number" || !Number.isInteger(val)) {
    throw new TypeError(`Field '${field}' must be an integer number, got ${typeof val}`);
  }
  if (min !== undefined && val < min) throw new RangeError(`Field '${field}' must be >= ${min}, got ${val}`);
  if (max !== undefined && val > max) throw new RangeError(`Field '${field}' must be <= ${max}, got ${val}`);
  return val;
}

function parseBigIntField(obj: Record<string, unknown>, field: string, min?: bigint, max?: bigint): bigint {
  const val = obj[field];
  let b: bigint;
  if (typeof val === "bigint") {
    b = val;
  } else if (typeof val === "number") {
    if (!Number.isInteger(val)) throw new TypeError(`Field '${field}' must be an integer, got ${val}`);
    b = BigInt(val);
  } else {
    throw new TypeError(`Field '${field}' must be a number or bigint, got ${typeof val}`);
  }
  if (min !== undefined && b < min) throw new RangeError(`Field '${field}' must be >= ${min}, got ${b}`);
  if (max !== undefined && b > max) throw new RangeError(`Field '${field}' must be <= ${max}, got ${b}`);
  return b;
}

/**
 * Validates and parses growth rules JSON into a strongly-typed GrowthRules record.
 */
export function parseGrowthRules(json: unknown): GrowthRules {
  let raw: unknown = json;
  if (typeof json === "string") {
    try {
      raw = JSON.parse(json);
    } catch (err) {
      throw new TypeError(`Failed to parse growth rules JSON: ${err}`);
    }
  }

  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new TypeError("Growth rules must be a JSON object");
  }

  const obj = raw as Record<string, unknown>;

  const version = parseNumberField(obj, "version", 0);
  const note = typeof obj.note === "string" ? obj.note : undefined;

  const idle_close_steps = parseNumberField(obj, "idle_close_steps", 1);
  const entry_price_premium_bps = parseBigIntField(obj, "entry_price_premium_bps");
  const entry_min_margin_bps = parseBigIntField(obj, "entry_min_margin_bps");
  const entry_purse_reserve = parseBigIntField(obj, "entry_purse_reserve", 0n);
  const growth_min_satisfaction_bps = parseBigIntField(obj, "growth_min_satisfaction_bps", 0n, 10000n);
  const growth_bps = parseBigIntField(obj, "growth_bps", 0n);
  const shrink_max_satisfaction_bps = parseBigIntField(obj, "shrink_max_satisfaction_bps", 0n, 10000n);
  const shrink_bps = parseBigIntField(obj, "shrink_bps", 0n);
  const min_population = parseBigIntField(obj, "min_population", 1n);
  const stage_min_satisfaction_bps = parseBigIntField(obj, "stage_min_satisfaction_bps", 0n, 10000n);
  const dividend_bps = parseBigIntField(obj, "dividend_bps", 0n, 10000n);
  const dividend_reserve_bps = parseBigIntField(obj, "dividend_reserve_bps", 0n);
  const topup_floor_bps = parseBigIntField(obj, "topup_floor_bps", 0n);
  const stock_cap_runs = parseNumberField(obj, "stock_cap_runs", 1);

  return {
    version,
    note,
    idle_close_steps,
    entry_price_premium_bps,
    entry_min_margin_bps,
    entry_purse_reserve,
    growth_min_satisfaction_bps,
    growth_bps,
    shrink_max_satisfaction_bps,
    shrink_bps,
    min_population,
    stage_min_satisfaction_bps,
    dividend_bps,
    dividend_reserve_bps,
    topup_floor_bps,
    stock_cap_runs,
  };
}

/**
 * Phase 6 closure and auction per Rule 2.
 * Increments insolvent_steps for open businesses that ran 0 production runs,
 * resets to 0 for runs > 0. Closes when insolvent_steps >= idle_close_steps.
 * Auctions closing inventory to other open businesses that use it as input.
 */
export function processClosuresAndAuctions(
  nextState: CityState,
  allBusinesses: Business[],
  recipeMap: Map<string, ArcRecipe>,
  productionRunsMap: Map<string, bigint>,
  idleCloseSteps: number,
  events: SimEvent[]
): void {
  for (const b of allBusinesses) {
    if (!b.open) continue;

    const runs = productionRunsMap.get(b.id) ?? 0n;
    if (runs === 0n) {
      b.insolvent_steps += 1;
    } else {
      b.insolvent_steps = 0;
    }

    if (b.insolvent_steps >= idleCloseSteps) {
      b.open = false;
      events.push({
        event: "business_closed",
        city_id: nextState.city_id,
        step: nextState.step,
        business_id: b.id,
        business: b.id,
        recipe: b.recipe,
        coin: b.coin.toString(),
      });

      // Auction inventory of b
      const itemKeys = Object.keys(b.inventory).sort();
      for (const item of itemKeys) {
        let closingQty = b.inventory[item] ?? 0n;
        if (closingQty <= 0n) continue;

        const price = nextState.market.price[item];
        if (price === undefined || price <= 0n) continue;

        for (const buyer of allBusinesses) {
          if (!buyer.open || buyer.id === b.id) continue;
          const buyerRecipe = recipeMap.get(buyer.recipe);
          if (!buyerRecipe || buyerRecipe.inputs[item] === undefined) continue;

          const needed = buyerRecipe.inputs[item];
          const target = buyerRecipe.max_per_run_per_business * needed;
          const currentInv = buyer.inventory[item] ?? 0n;
          if (currentInv >= target) continue;

          const desired = target - currentInv;
          const maxAffordable = buyer.coin / price;
          if (maxAffordable <= 0n) continue;

          let take = closingQty < desired ? closingQty : desired;
          if (maxAffordable < take) take = maxAffordable;

          if (take > 0n) {
            const cost = take * price;
            buyer.coin -= cost;
            b.coin += cost;
            buyer.inventory[item] = currentInv + take;
            closingQty -= take;
            b.inventory[item] = closingQty;
            if (closingQty === 0n) {
              delete b.inventory[item];
              break;
            }
          }
        }
      }
    }
  }
}

/**
 * Phase 6 entrepreneur entry per Rule 3.
 * At most one qualifying business opened per step per city, funded from citizen purse.
 */
export function processEntrepreneurEntry(
  nextState: CityState,
  arc: ArcFile,
  growth: GrowthRules,
  events: SimEvent[]
): void {
  const requiredPurse = arc.genesis.coin_per_business + growth.entry_purse_reserve;
  if (nextState.citizens.purse < requiredPurse) {
    return;
  }

  const stageDef = arc.stages[nextState.stage];
  const maxPerSector = stageDef.max_businesses_per_sector;

  let bestRecipe: ArcRecipe | null = null;
  let bestMargin: bigint | null = null;

  for (const recipe of arc.recipes) {
    // Closed businesses are ruins and do not use a slot, so the city can rebuild.
    const sectorCount = BigInt(nextState.sectors[recipe.sector].businesses.filter((b) => b.open).length);
    if (sectorCount >= maxPerSector) {
      continue;
    }

    const outputEntries = Object.entries(recipe.outputs);
    if (outputEntries.length === 0) continue;
    const mainOutput = outputEntries[0][0];
    const itemDef = arc.items.find((it) => it.id === mainOutput);
    if (!itemDef) continue;

    const currentPrice = nextState.market.price[mainOutput] ?? itemDef.base_price;
    const price_premium_bps = ((currentPrice - itemDef.base_price) * 10000n) / itemDef.base_price;
    if (price_premium_bps < growth.entry_price_premium_bps) {
      continue;
    }

    let outputValue = 0n;
    for (const [item, qty] of outputEntries) {
      const p = nextState.market.price[item] ?? 0n;
      outputValue += qty * p;
    }

    let inputCost = 0n;
    for (const [item, qty] of Object.entries(recipe.inputs)) {
      const p = nextState.market.price[item] ?? 0n;
      inputCost += qty * p;
    }

    const denom = inputCost + recipe.wage;
    if (denom <= 0n) continue;

    const margin_bps = ((outputValue - inputCost - recipe.wage) * 10000n) / denom;
    if (margin_bps < growth.entry_min_margin_bps) {
      continue;
    }

    if (bestRecipe === null || bestMargin === null) {
      bestRecipe = recipe;
      bestMargin = margin_bps;
    } else if (margin_bps > bestMargin) {
      bestRecipe = recipe;
      bestMargin = margin_bps;
    } else if (margin_bps === bestMargin) {
      if (recipe.id < bestRecipe.id) {
        bestRecipe = recipe;
        bestMargin = margin_bps;
      }
    }
  }

  if (bestRecipe) {
    const existingIds = new Set<string>();
    for (const sec of nextState.sectors) {
      for (const b of sec.businesses) {
        if (b.recipe === bestRecipe.id) {
          existingIds.add(b.id);
        }
      }
    }
    let n = 0;
    while (existingIds.has(`${bestRecipe.id}-${n}`)) {
      n++;
    }

    const newBiz: Business = {
      id: `${bestRecipe.id}-${n}`,
      recipe: bestRecipe.id,
      open: true,
      coin: arc.genesis.coin_per_business,
      inventory: {},
      insolvent_steps: 0,
    };

    nextState.citizens.purse -= arc.genesis.coin_per_business;
    nextState.sectors[bestRecipe.sector].businesses.push(newBiz);
    nextState.sectors[bestRecipe.sector].businesses.sort((a, b) =>
      a.id < b.id ? -1 : a.id > b.id ? 1 : 0
    );

    events.push({
      event: "business_opened",
      city_id: nextState.city_id,
      step: nextState.step,
      business_id: newBiz.id,
      business: newBiz.id,
      recipe: newBiz.recipe,
      sector: bestRecipe.sector,
      coin: newBiz.coin.toString(),
    });
  }
}

/**
 * Phase 7 population growth and shrink per Rule 4.
 */
export function processPopulation(
  nextState: CityState,
  growth: GrowthRules,
  events: SimEvent[]
): void {
  const pop = nextState.citizens.population;
  const sat = nextState.citizens.satisfaction_bps;

  let newPop = pop;
  if (sat >= growth.growth_min_satisfaction_bps) {
    const delta = (pop * growth.growth_bps) / 10000n;
    const change = delta > 1n ? delta : 1n;
    newPop = pop + change;
  } else if (sat <= growth.shrink_max_satisfaction_bps) {
    const delta = (pop * growth.shrink_bps) / 10000n;
    const change = delta > 1n ? delta : 1n;
    newPop = pop - change;
    if (newPop < growth.min_population) {
      newPop = growth.min_population;
    }
  }

  if (newPop !== pop) {
    nextState.citizens.population = newPop;
    events.push({
      event: "population_change",
      city_id: nextState.city_id,
      step: nextState.step,
      old: pop.toString(),
      new: newPop.toString(),
    });
  }
}

/**
 * Phase 8 stage advancement per Rule 5.
 */
export function processStageUp(
  nextState: CityState,
  arc: ArcFile,
  growth: GrowthRules,
  events: SimEvent[]
): void {
  const nextStage = nextState.stage + 1;
  if (nextStage < arc.stages.length) {
    const nextStageDef = arc.stages[nextStage];
    if (
      nextState.citizens.population >= nextStageDef.min_population &&
      nextState.citizens.satisfaction_bps >= growth.stage_min_satisfaction_bps
    ) {
      const oldStage = nextState.stage;
      nextState.stage = nextStage;
      events.push({
        event: "stage_up",
        city_id: nextState.city_id,
        step: nextState.step,
        old_stage: oldStage,
        new_stage: nextStage,
        stage: nextStage,
      });
    }
  }
}

/**
 * Dividends (after prices, before entry): owners are citizens, so each open business pays
 * dividend_bps of the coin above its working-capital reserve into citizens.purse.
 * Coin only moves, so total coin is conserved. Without this channel profit hoards in
 * the last links of a chain, the purse empties and upstream businesses starve.
 */
export function processDividends(
  nextState: CityState,
  arc: ArcFile,
  growth: GrowthRules,
  events: SimEvent[]
): void {
  const reserve = (arc.genesis.coin_per_business * growth.dividend_reserve_bps) / 10000n;
  let total = 0n;
  let payers = 0n;
  for (const sec of nextState.sectors) {
    for (const b of sec.businesses) {
      if (!b.open || b.coin <= reserve) continue;
      const pay = ((b.coin - reserve) * growth.dividend_bps) / 10000n;
      if (pay <= 0n) continue;
      b.coin -= pay;
      total += pay;
      payers += 1n;
    }
  }
  if (total > 0n) {
    nextState.citizens.purse += total;
    events.push({
      event: "dividends_paid",
      city_id: nextState.city_id,
      step: nextState.step,
      total: total.toString(),
      businesses: payers.toString(),
    });
  }
}

/**
 * Working capital (after dividends, before entry): the citizens' purse refills open businesses
 * whose coin fell below the floor, but only when the recipe is profitable at current prices
 * (a business that loses money gets nothing and eventually closes). Order: sector idx, business id.
 * Coin only moves from purse to business, so total coin is conserved.
 */
export function processWorkingCapital(
  nextState: CityState,
  arc: ArcFile,
  growth: GrowthRules,
  events: SimEvent[]
): void {
  const floor = (arc.genesis.coin_per_business * growth.topup_floor_bps) / 10000n;
  let total = 0n;
  let count = 0n;
  for (const sec of nextState.sectors) {
    for (const b of sec.businesses) {
      if (!b.open || b.coin >= floor || nextState.citizens.purse <= 0n) continue;
      const recipe = arc.recipes.find((r) => r.id === b.recipe);
      if (!recipe) continue;
      let outputValue = 0n;
      for (const [item, qty] of Object.entries(recipe.outputs)) outputValue += qty * (nextState.market.price[item] ?? 0n);
      let inputCost = 0n;
      for (const [item, qty] of Object.entries(recipe.inputs)) inputCost += qty * (nextState.market.price[item] ?? 0n);
      if (outputValue <= inputCost + recipe.wage) continue;
      const give = floor - b.coin < nextState.citizens.purse ? floor - b.coin : nextState.citizens.purse;
      b.coin += give;
      nextState.citizens.purse -= give;
      total += give;
      count += 1n;
    }
  }
  if (total > 0n) {
    events.push({
      event: "capital_injected",
      city_id: nextState.city_id,
      step: nextState.step,
      total: total.toString(),
      businesses: count.toString(),
    });
  }
}
