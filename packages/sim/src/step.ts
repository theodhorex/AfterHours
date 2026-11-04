/**
 * Step engine core for AfterHours simulation.
 * Erasable TypeScript only, zero external dependencies, BigInt arithmetic.
 */

import { cityRoot } from "./roots.ts";
import { explainPrice } from "./pricing.ts";
import {
  processClosuresAndAuctions,
  processDividends,
  processWorkingCapital,
  processEntrepreneurEntry,
  processPopulation,
  processStageUp,
} from "./growth.ts";
import { processEventsPhase, applyRecipeOutputEffects } from "./events.ts";
import { processOrdersPhase, type PlayerOrder } from "./orders.ts";
import type { ArcFile, ArcRecipe, Business, CityState, SectorState, SimEvent } from "./types.ts";
import type { PricingRules } from "./pricing.ts";
import type { GrowthRules } from "./growth.ts";

export interface StepContext {
  arc: ArcFile;
  pricing: PricingRules;
  growth: GrowthRules;
  orders?: PlayerOrder[];
  executedIds?: Set<string>;
}

export interface StepResult {
  state: CityState;
  events: SimEvent[];
}

export interface ItemFlows {
  produced: bigint;
  consumed_recipe: bigint;
  consumed_pop: bigint;
  sunk: bigint;
  trade_to_players: bigint;
  trade_from_players: bigint;
}

/**
 * Pure helper returning per-item net flows from a list of simulation events.
 */
export function flowsFromEvents(events: SimEvent[]): Record<string, ItemFlows> {
  const flows: Record<string, ItemFlows> = {};
  const ensure = (item: string) => {
    if (!flows[item]) {
      flows[item] = {
        produced: 0n,
        consumed_recipe: 0n,
        consumed_pop: 0n,
        sunk: 0n,
        trade_to_players: 0n,
        trade_from_players: 0n,
      };
    }
  };

  for (const e of events) {
    if (e.event === "produced") {
      const prod = (e.produced ?? {}) as Record<string, string | bigint | number>;
      for (const [item, qty] of Object.entries(prod)) {
        ensure(item);
        flows[item].produced += BigInt(qty);
      }
      const cons = (e.consumed_recipe ?? {}) as Record<string, string | bigint | number>;
      for (const [item, qty] of Object.entries(cons)) {
        ensure(item);
        flows[item].consumed_recipe += BigInt(qty);
      }
    } else if (e.event === "consumed_pop") {
      ensure(e.item as string);
      flows[e.item as string].consumed_pop += BigInt((e.qty as string | bigint | number) ?? 0);
    } else if (e.event === "inventory_sunk") {
      const items = (e.items ?? e.sunk ?? {}) as Record<string, string | bigint | number>;
      for (const [item, qty] of Object.entries(items)) {
        ensure(item);
        flows[item].sunk += BigInt(qty);
      }
    } else if (e.event === "order_accepted") {
      if (e.kind === "buy" && typeof e.item === "string") {
        ensure(e.item);
        flows[e.item].trade_to_players += BigInt((e.filled as string | bigint | number) ?? 0);
      } else if (e.kind === "sell" && typeof e.item === "string") {
        ensure(e.item);
        flows[e.item].trade_from_players += BigInt((e.filled as string | bigint | number) ?? 0);
      }
    }
  }
  return flows;
}

function cloneState(state: CityState): CityState {
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
    step: state.step + 1,
    world_seed: state.world_seed,
    stage: state.stage,
    sectors,
    citizens: { ...state.citizens },
    market: { price: { ...state.market.price }, demand_ema: { ...state.market.demand_ema } },
    treasury: state.treasury,
    totals: { items: { ...state.totals.items }, coin: state.totals.coin },
  };
}

/**
 * Executes a single simulation step. Pure function: does not mutate input state.
 */
export function step(state: CityState, ctx: StepContext, ordersArg?: PlayerOrder[]): StepResult {
  const nextState = cloneState(state);
  const nextStep = nextState.step;
  const events: SimEvent[] = [{ event: "step_start", city_id: nextState.city_id, step: nextStep }];

  const recipeMap = new Map<string, ArcRecipe>();
  for (const r of ctx.arc.recipes) recipeMap.set(r.id, r);

  // 1. Events Phase
  const activeEvents = processEventsPhase(nextState, ctx.arc, ctx.growth, events);

  // 2. Orders Phase (executed after events, before production)
  const orders = ordersArg ?? ctx.orders ?? [];
  processOrdersPhase(nextState, ctx.arc, orders, ctx.executedIds, events);

  // Flatten businesses in fixed order: sector idx asc, business id asc
  const allBusinesses: Business[] = [];
  for (const sec of nextState.sectors) {
    const sorted = [...sec.businesses].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    allBusinesses.push(...sorted);
  }

  // 3. Production Phase
  const productionRunsMap = new Map<string, bigint>();
  for (const b of allBusinesses) {
    if (!b.open) continue;
    const recipe = recipeMap.get(b.recipe);
    if (!recipe) continue;

    let runs = recipe.max_per_run_per_business;
    const inputEntries = Object.entries(recipe.inputs);
    for (const [item, needed] of inputEntries) {
      const inv = b.inventory[item] ?? 0n;
      const maxPossible = inv / needed;
      if (maxPossible < runs) runs = maxPossible;
    }
    if (recipe.wage > 0n) {
      const maxPossibleWage = b.coin / recipe.wage;
      if (maxPossibleWage < runs) runs = maxPossibleWage;
    }
    if (ctx.growth) {
      // Stock cap: no point producing more of what already sits unsold in the warehouse.
      for (const [item, perRun] of Object.entries(recipe.outputs)) {
        const cap = BigInt(ctx.growth.stock_cap_runs) * recipe.max_per_run_per_business * perRun;
        const room = cap - (b.inventory[item] ?? 0n);
        const maxByRoom = room > 0n ? room / perRun : 0n;
        if (maxByRoom < runs) runs = maxByRoom;
      }
    }

    productionRunsMap.set(b.id, runs);

    if (runs > 0n) {
      const consumedRecipeMap: Record<string, string> = {};
      for (const [item, needed] of inputEntries) {
        const qty = runs * needed;
        b.inventory[item] = (b.inventory[item] ?? 0n) - qty;
        if (b.inventory[item] === 0n) delete b.inventory[item];
        consumedRecipeMap[item] = qty.toString();
      }

      const producedMap: Record<string, string> = {};
      for (const [item, outputPerRun] of Object.entries(recipe.outputs)) {
        const baseQty = runs * outputPerRun;
        const qty = applyRecipeOutputEffects(recipe.id, baseQty, activeEvents);
        b.inventory[item] = (b.inventory[item] ?? 0n) + qty;
        producedMap[item] = qty.toString();
      }

      const totalWage = runs * recipe.wage;
      b.coin -= totalWage;
      nextState.citizens.purse += totalWage;

      events.push({
        event: "produced", city_id: nextState.city_id, step: nextStep,
        business_id: b.id, business: b.id, recipe: b.recipe,
        runs: runs.toString(), consumed_recipe: consumedRecipeMap,
        produced: producedMap, wage_paid: totalWage.toString(),
      });
    }
  }

  // 2. Closure & Auction Phase (Rule 2)
  if (ctx.growth) {
    processClosuresAndAuctions(
      nextState,
      allBusinesses,
      recipeMap,
      productionRunsMap,
      ctx.growth.idle_close_steps,
      events
    );
  }

  // 2. Business Purchases (Inputs)
  const demandUnitsStep: Record<string, bigint> = {};
  for (const it of ctx.arc.items) demandUnitsStep[it.id] = 0n;

  for (const buyer of allBusinesses) {
    if (!buyer.open) continue;
    const recipe = recipeMap.get(buyer.recipe);
    if (!recipe) continue;

    for (const item of Object.keys(recipe.inputs).sort()) {
      const needed = recipe.inputs[item];
      const targetInv = recipe.max_per_run_per_business * needed;
      const currentInv = buyer.inventory[item] ?? 0n;
      if (currentInv >= targetInv) continue;

      const desired = targetInv - currentInv;
      demandUnitsStep[item] += desired;
      let remaining = desired;
      const price = state.market.price[item];
      if (price <= 0n) continue;

      for (const seller of allBusinesses) {
        if (remaining === 0n || buyer.coin < price) break;
        if (seller.id === buyer.id || !seller.open) continue;
        const sellerRecipe = recipeMap.get(seller.recipe);
        if (!sellerRecipe || sellerRecipe.outputs[item] === undefined) continue;

        const sellerOffer = seller.inventory[item] ?? 0n;
        if (sellerOffer <= 0n) continue;

        const maxAffordable = buyer.coin / price;
        let q = remaining < sellerOffer ? remaining : sellerOffer;
        if (maxAffordable < q) q = maxAffordable;

        if (q > 0n) {
          const cost = q * price;
          buyer.coin -= cost;
          seller.coin += cost;
          buyer.inventory[item] = (buyer.inventory[item] ?? 0n) + q;
          seller.inventory[item] = (seller.inventory[item] ?? 0n) - q;
          if (seller.inventory[item] === 0n) delete seller.inventory[item];
          remaining -= q;
          events.push({
            event: "traded", city_id: nextState.city_id, step: nextStep,
            buyer: buyer.id, seller: seller.id, item,
            qty: q.toString(), coin: cost.toString(), price: price.toString(),
          });
        }
      }
    }
  }

  // 3. Citizen Consumption
  const fulfilledBpsList: bigint[] = [];
  const consumedPopMap: Record<string, bigint> = {};

  for (const need of ctx.arc.citizens.needs) {
    const demand = (nextState.citizens.population * need.per_capita_milli) / 1000n;
    demandUnitsStep[need.item] += demand;
    let neededToFulfill = demand;
    let fulfilled = 0n;

    for (const candidateItem of [need.item, ...(need.alt ?? [])]) {
      if (neededToFulfill === 0n) break;
      const price = state.market.price[candidateItem];
      if (price <= 0n) continue;

      for (const seller of allBusinesses) {
        if (neededToFulfill === 0n || nextState.citizens.purse < price) break;
        if (!seller.open) continue;
        const sellerRecipe = recipeMap.get(seller.recipe);
        if (!sellerRecipe || sellerRecipe.outputs[candidateItem] === undefined) continue;

        const sellerOffer = seller.inventory[candidateItem] ?? 0n;
        if (sellerOffer <= 0n) continue;

        const maxAffordable = nextState.citizens.purse / price;
        let q = neededToFulfill < sellerOffer ? neededToFulfill : sellerOffer;
        if (maxAffordable < q) q = maxAffordable;

        if (q > 0n) {
          const cost = q * price;
          nextState.citizens.purse -= cost;
          seller.coin += cost;
          seller.inventory[candidateItem] = (seller.inventory[candidateItem] ?? 0n) - q;
          if (seller.inventory[candidateItem] === 0n) delete seller.inventory[candidateItem];
          neededToFulfill -= q;
          fulfilled += q;
          consumedPopMap[candidateItem] = (consumedPopMap[candidateItem] ?? 0n) + q;
          events.push({
            event: "traded", city_id: nextState.city_id, step: nextStep,
            buyer: "citizens", seller: seller.id, item: candidateItem,
            qty: q.toString(), coin: cost.toString(), price: price.toString(),
          });
        }
      }
    }
    fulfilledBpsList.push(demand === 0n ? 10000n : (fulfilled * 10000n) / demand);
  }

  for (const item of Object.keys(consumedPopMap).sort()) {
    const qty = consumedPopMap[item];
    if (qty > 0n) events.push({ event: "consumed_pop", city_id: nextState.city_id, step: nextStep, item, qty: qty.toString() });
  }

  // 4. Satisfaction
  let sumWeight = 0n;
  let weightedSum = 0n;
  for (let i = 0; i < ctx.arc.citizens.needs.length; i++) {
    const weight = ctx.arc.citizens.needs[i].satisfaction_weight;
    sumWeight += weight;
    weightedSum += weight * fulfilledBpsList[i];
  }
  const target_bps = sumWeight > 0n ? weightedSum / sumWeight : 10000n;
  nextState.citizens.satisfaction_bps = (nextState.citizens.satisfaction_bps * 3n + target_bps * 7n) / 10n;

  // 5. Prices Update
  const sortedItems = [...ctx.arc.items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const itemDef of sortedItems) {
    const itemId = itemDef.id;
    let stock = 0n;
    for (const b of allBusinesses) stock += b.inventory[itemId] ?? 0n;

    const reqUnits = demandUnitsStep[itemId] ?? 0n;
    const alpha = ctx.pricing.dem_ema_alpha_bps;
    const oldEma = state.market.demand_ema[itemId] ?? 0n;
    const dem_ema = (alpha * reqUnits + (10000n - alpha) * oldEma) / 10000n;
    nextState.market.demand_ema[itemId] = dem_ema;

    let steadyCitizenDemand = 0n;
    for (const need of ctx.arc.citizens.needs) {
      if (need.item === itemId) steadyCitizenDemand += (nextState.citizens.population * need.per_capita_milli) / 1000n;
    }
    let steadyBusinessDemand = 0n;
    for (const b of allBusinesses) {
      if (!b.open) continue;
      const recipe = recipeMap.get(b.recipe);
      if (recipe && recipe.inputs[itemId] !== undefined) {
        steadyBusinessDemand += recipe.max_per_run_per_business * recipe.inputs[itemId];
      }
    }
    const expected = steadyCitizenDemand + steadyBusinessDemand;

    const reason = explainPrice({
      item: itemId,
      base: itemDef.base_price,
      stock,
      dem_ema,
      expected,
      pricing: ctx.pricing,
    });

    const newPrice = reason.price;
    const oldPrice = state.market.price[itemId] ?? itemDef.base_price;
    nextState.market.price[itemId] = newPrice;

    if (newPrice !== oldPrice) {
      events.push({
        event: "price_update", city_id: nextState.city_id, step: nextStep,
        item: itemId, old_price: oldPrice.toString(), new_price: newPrice.toString(),
        price: newPrice.toString(), reason,
      });
    }
  }

  // 5b. Dividends: business profit flows back to citizens
  if (ctx.growth) {
    processDividends(nextState, ctx.arc, ctx.growth, events);
    processWorkingCapital(nextState, ctx.arc, ctx.growth, events);
  }

  // 6. Entrepreneur Entry (Phase 6, Rule 3)
  if (ctx.growth) {
    processEntrepreneurEntry(nextState, ctx.arc, ctx.growth, events);
  }

  // 7. Population Growth / Shrink (Phase 7, Rule 4)
  if (ctx.growth) {
    processPopulation(nextState, ctx.growth, events);
  }

  // 8. Stage Advancement (Phase 8, Rule 5)
  if (ctx.growth) {
    processStageUp(nextState, ctx.arc, ctx.growth, events);
  }

  // 9. Totals Update
  const flows = flowsFromEvents(events);
  for (const itemDef of ctx.arc.items) {
    const netFlow =
      (flows[itemDef.id]?.produced ?? 0n) +
      (flows[itemDef.id]?.trade_from_players ?? 0n) -
      (flows[itemDef.id]?.consumed_recipe ?? 0n) -
      (flows[itemDef.id]?.consumed_pop ?? 0n) -
      (flows[itemDef.id]?.sunk ?? 0n) -
      (flows[itemDef.id]?.trade_to_players ?? 0n);
    nextState.totals.items[itemDef.id] = (state.totals.items[itemDef.id] ?? 0n) + netFlow;
  }

  let coinTradeFromPlayers = 0n;
  let coinTradeToPlayers = 0n;
  for (const e of events) {
    if (e.event === "order_accepted") {
      if (e.kind === "buy") {
        coinTradeFromPlayers += BigInt((e.total_coin as string | bigint | number) ?? 0);
      } else if (e.kind === "sell") {
        coinTradeToPlayers += BigInt((e.total_coin as string | bigint | number) ?? 0);
      } else if (e.kind === "invest") {
        coinTradeFromPlayers += BigInt((e.total_coin ?? e.amount as string | bigint | number) ?? 0);
      }
    }
  }
  nextState.totals.coin = state.totals.coin + coinTradeFromPlayers - coinTradeToPlayers;

  // 7. City Root & Step End
  const cRoot = cityRoot(nextState);
  events.push({ event: "step_end", city_id: nextState.city_id, step: nextStep, city_root: cRoot });

  return { state: nextState, events };
}
