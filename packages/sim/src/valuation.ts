/**
 * Sector and city valuation, and sale impact preview for AfterHours.
 * Pure and deterministic functions using BigInt arithmetic only.
 * Erasable TypeScript syntax only, zero external dependencies.
 */

import type { ArcFile, CityState, SimEvent } from "./types.ts";

export const EARNINGS_MULTIPLE_STEPS = 80n;

export type ValuationWindow = SimEvent[] | { events: SimEvent[]; steps?: number };

export interface IncomeResult {
  businesses: Record<string, bigint>;
  sectors: Record<number, bigint>;
}

export interface ValuationResult {
  assetValue: bigint;
  earningsValue: bigint;
  total: bigint;
}

export interface SalePreview {
  askPrice: bigint;
  assetValue: bigint;
  earningsValue: bigint;
  sectorShareBps: bigint;
  openBusinesses: bigint;
  closedBusinesses: bigint;
  importsNeeded: string[];
  exportsOffered: string[];
  dependents: string[];
  riskFlags: string[];
}

function unpackWindow(window: ValuationWindow): { events: SimEvent[]; steps: number } {
  const events = Array.isArray(window) ? window : (window.events ?? []);
  let steps = !Array.isArray(window) && window.steps ? window.steps : 0;
  if (!steps && events.length > 0) {
    let min = Infinity;
    let max = -Infinity;
    for (const e of events) {
      if (typeof e.step === "number") {
        if (e.step < min) min = e.step;
        if (e.step > max) max = e.step;
      }
    }
    steps = min <= max ? max - min + 1 : 0;
  }
  return { events, steps };
}

/**
 * Computes per-business and per-sector net production value over a window of events.
 * If prices are provided, uses state.market.price (simpler approach per spec).
 * Otherwise tracks prices from preceding price_update events, falling back to arc base prices.
 */
export function incomeFromEvents(
  events: SimEvent[],
  arc: ArcFile,
  prices?: Record<string, bigint>
): IncomeResult {
  const recipeSectorMap = new Map<string, number>();
  for (const r of arc.recipes) recipeSectorMap.set(r.id, r.sector);

  const basePrices: Record<string, bigint> = {};
  for (const item of arc.items) basePrices[item.id] = item.base_price;
  const currentPrices: Record<string, bigint> = prices ? { ...prices } : { ...basePrices };

  const businesses: Record<string, bigint> = {};
  const sectors: Record<number, bigint> = { 0: 0n, 1: 0n, 2: 0n, 3: 0n, 4: 0n, 5: 0n };

  for (const e of events) {
    if (!prices && e.event === "price_update") {
      const item = e.item as string | undefined;
      const rawPrice = e.new_price ?? e.price;
      if (item && rawPrice !== undefined) {
        currentPrices[item] = BigInt(rawPrice as string | number | bigint);
      }
    } else if (e.event === "produced") {
      const bizId = (e.business_id ?? e.business) as string;
      const recipeId = e.recipe as string;
      const sectorIdx = recipeSectorMap.get(recipeId) ?? -1;

      let outputVal = 0n;
      const prod = (e.produced ?? {}) as Record<string, string | number | bigint>;
      for (const [item, qty] of Object.entries(prod)) {
        outputVal += BigInt(qty) * (currentPrices[item] ?? basePrices[item] ?? 0n);
      }

      let inputVal = 0n;
      const cons = (e.consumed_recipe ?? {}) as Record<string, string | number | bigint>;
      for (const [item, qty] of Object.entries(cons)) {
        inputVal += BigInt(qty) * (currentPrices[item] ?? basePrices[item] ?? 0n);
      }

      const wageVal = BigInt((e.wage_paid ?? 0) as string | number | bigint);
      const netValue = outputVal - inputVal - wageVal;

      businesses[bizId] = (businesses[bizId] ?? 0n) + netValue;
      if (sectorIdx >= 0 && sectorIdx <= 5) {
        sectors[sectorIdx] = (sectors[sectorIdx] ?? 0n) + netValue;
      }
    }
  }

  return { businesses, sectors };
}

export function valueSector(
  state: CityState,
  arc: ArcFile,
  sectorIdx: number,
  window: ValuationWindow
): ValuationResult {
  const sector = state.sectors[sectorIdx];
  if (!sector) throw new Error(`Invalid sectorIdx: ${sectorIdx}`);

  let assetValue = 0n;
  for (const b of sector.businesses) {
    assetValue += b.coin;
    for (const [item, qty] of Object.entries(b.inventory)) {
      if (qty > 0n) assetValue += qty * (state.market.price[item] ?? 0n);
    }
  }

  const { events, steps } = unpackWindow(window);
  let earningsValue = 0n;

  if (steps > 0 && events.length > 0) {
    const income = incomeFromEvents(events, arc, state.market.price);
    let openEarningsSum = 0n;
    for (const b of sector.businesses) {
      if (b.open) openEarningsSum += income.businesses[b.id] ?? 0n;
    }
    if (openEarningsSum > 0n) {
      earningsValue = (openEarningsSum / BigInt(steps)) * EARNINGS_MULTIPLE_STEPS;
    }
  }

  if (earningsValue < 0n) earningsValue = 0n;
  return { assetValue, earningsValue, total: assetValue + earningsValue };
}

export function valueCity(
  state: CityState,
  arc: ArcFile,
  window: ValuationWindow
): ValuationResult {
  let assetValue = state.treasury;
  let earningsValue = 0n;
  let total = state.treasury;

  for (let s = 0; s < 6; s++) {
    const sVal = valueSector(state, arc, s, window);
    assetValue += sVal.assetValue;
    earningsValue += sVal.earningsValue;
    total += sVal.total;
  }

  return { assetValue, earningsValue, total };
}

export function previewSale(
  state: CityState,
  arc: ArcFile,
  window: ValuationWindow,
  sectorIdx: number
): SalePreview {
  const sector = state.sectors[sectorIdx];
  if (!sector) throw new Error(`Invalid sectorIdx: ${sectorIdx}`);

  const { assetValue, earningsValue, total: askPrice } = valueSector(state, arc, sectorIdx, window);

  const { events } = unpackWindow(window);
  const income = incomeFromEvents(events, arc, state.market.price);

  let totalCityProd = 0n;
  for (let s = 0; s < 6; s++) {
    const sProd = income.sectors[s] ?? 0n;
    if (sProd > 0n) totalCityProd += sProd;
  }

  const sectorProd = (income.sectors[sectorIdx] ?? 0n) > 0n ? income.sectors[sectorIdx] : 0n;
  let sectorShareBps = 0n;
  if (totalCityProd > 0n) {
    sectorShareBps = (sectorProd * 10000n) / totalCityProd;
    if (sectorShareBps > 10000n) sectorShareBps = 10000n;
  }

  let openBusinesses = 0n;
  let closedBusinesses = 0n;
  for (const b of sector.businesses) {
    if (b.open) openBusinesses += 1n;
    else closedBusinesses += 1n;
  }

  const recipeMap = new Map<string, (typeof arc.recipes)[number]>();
  for (const r of arc.recipes) recipeMap.set(r.id, r);

  const thisSectorRecipes = arc.recipes.filter((r) => r.sector === sectorIdx);

  // 1. importsNeeded
  const sameSectorProduced = new Set<string>();
  for (const b of sector.businesses) {
    if (b.open) {
      const r = recipeMap.get(b.recipe);
      if (r) for (const item of Object.keys(r.outputs)) sameSectorProduced.add(item);
    }
  }

  const inputItemSet = new Set<string>();
  for (const r of thisSectorRecipes) {
    for (const item of Object.keys(r.inputs)) inputItemSet.add(item);
  }

  const importsNeeded = Array.from(inputItemSet)
    .filter((item) => !sameSectorProduced.has(item))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  // 2. exportsOffered
  const sectorOutputSet = new Set<string>();
  for (const r of thisSectorRecipes) {
    for (const item of Object.keys(r.outputs)) sectorOutputSet.add(item);
  }

  const otherSectorsInputSet = new Set<string>();
  for (const r of arc.recipes) {
    if (r.sector !== sectorIdx) {
      for (const item of Object.keys(r.inputs)) otherSectorsInputSet.add(item);
    }
  }

  const exportsOffered = Array.from(sectorOutputSet)
    .filter((item) => otherSectorsInputSet.has(item))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  // 3. dependents
  const exportsOfferedSet = new Set(exportsOffered);
  const dependentSet = new Set<string>();
  for (let otherIdx = 0; otherIdx < 6; otherIdx++) {
    if (otherIdx === sectorIdx) continue;
    const consumesExport = arc.recipes
      .filter((r) => r.sector === otherIdx)
      .some((r) => Object.keys(r.inputs).some((item) => exportsOfferedSet.has(item)));
    if (consumesExport) {
      const kind = arc.sectors.find((s) => s.idx === otherIdx)?.kind ?? state.sectors[otherIdx].kind;
      dependentSet.add(kind);
    }
  }
  const dependents = Array.from(dependentSet).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  // 4. riskFlags
  const riskFlags: string[] = [];
  const sectorKind = arc.sectors.find((s) => s.idx === sectorIdx)?.kind ?? sector.kind;

  if (sectorKind === "food" && sectorShareBps >= 3000n) {
    riskFlags.push("sells_critical_food");
  }

  const totalBusinesses = openBusinesses + closedBusinesses;
  if (totalBusinesses > 0n && closedBusinesses * 2n >= totalBusinesses) {
    riskFlags.push("many_closed");
  }

  let hasSingleSupplier = false;
  for (const expItem of exportsOffered) {
    let openProducerCount = 0n;
    for (const s of state.sectors) {
      for (const b of s.businesses) {
        if (b.open) {
          const r = recipeMap.get(b.recipe);
          if (r && r.outputs[expItem] !== undefined && BigInt(r.outputs[expItem]) > 0n) {
            openProducerCount += 1n;
          }
        }
      }
    }
    if (openProducerCount === 1n) {
      hasSingleSupplier = true;
      break;
    }
  }
  if (hasSingleSupplier) riskFlags.push("single_supplier");

  if (assetValue > 0n && earningsValue * 4n < assetValue) {
    riskFlags.push("low_earnings");
  }

  if (importsNeeded.length > 0) {
    riskFlags.push("input_dependent");
  }

  riskFlags.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  return {
    askPrice,
    assetValue,
    earningsValue,
    sectorShareBps,
    openBusinesses,
    closedBusinesses,
    importsNeeded,
    exportsOffered,
    dependents,
    riskFlags,
  };
}
