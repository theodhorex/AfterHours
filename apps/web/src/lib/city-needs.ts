/**
 * Pure domain calculations for citizen needs, shortages, market imbalances,
 * and satisfaction analysis directly from CityView.
 * Zero external or React dependencies; 100% deterministic.
 */

import type { CityView } from "./sim-view.ts";
import type { MarketItem } from "../data/mock-city.ts";

export interface NeedCoverage {
  need: "food" | "housing" | "work" | "goods";
  label: string;
  coverage: number; // 0..100
  shortfallItem: string | null;
  formula: string;
  description: string;
}

export interface CityMarketItemStatus {
  id: string;
  name: string;
  tier: string;
  price: number;
  basePrice: number;
  stock: number;
  target: number;
  ratio: number;
  reason: string;
}

export interface CityNeedsSummary {
  needs: NeedCoverage[];
  oversupplied: CityMarketItemStatus[];
  inDemand: CityMarketItemStatus[];
  satisfactionBps: number;
  satisfactionPct: number;
}

// Realm signature goods lookup for consumer luxury analysis
const REALM_SIGNATURE_ITEMS: Record<string, string> = {
  goblin_warrens: "gadget",
  cave_hold: "totem",
  dino_vale: "fossil",
  elf_grove: "stave",
};

/**
 * Computes 0..100 coverage for the four core civic needs:
 * 1. Food: bread and fish available vs population consumption target
 * 2. Housing: structural metals (ingot) available vs civic maintenance demand
 * 3. Work: occupational tools available vs labor force demand
 * 4. Goods: consumer luxuries (elixir and signature goods) vs civic demand
 *
 * All formulas use existing CityView data without mutating or inventing simulation states.
 */
export function computeCityNeeds(city: CityView): CityNeedsSummary {
  const population = Math.max(0, city.citizens?.population ?? 0);
  const marketMap = new Map<string, MarketItem>();
  for (const item of city.market ?? []) {
    marketMap.set(item.id, item);
  }

  // Helper to fetch item safe metrics
  const getItem = (id: string) => {
    return marketMap.get(id) ?? {
      id,
      name: id,
      tier: "staple",
      base_price: 1,
      price: 1,
      stock: 0,
      target: 0,
      dem_ema: 0,
      dem_ref: 50,
      change: "flat" as const,
      explanation: {
        item: id,
        price: 1,
        base: 1,
        stock: 0,
        target: 0,
        dem_ema: 0,
        dem_ref: 50,
        stock_effect_bps: 0,
        demand_effect_bps: 0,
        clamp: "none" as const,
      },
    };
  };

  const breadItem = getItem("bread");
  const fishItem = getItem("fish");
  const ingotItem = getItem("ingot");
  const toolItem = getItem("tool");
  const elixirItem = getItem("elixir");
  const signatureItemId = REALM_SIGNATURE_ITEMS[city.arc_id] ?? "scroll";
  const signatureItem = getItem(signatureItemId);

  // --------------------------------------------------------------------------
  // FORMULA 1: Food Need
  // Inputs: bread.stock, fish.stock, bread.target, fish.target, citizens.population
  // Rationale: Citizens consume bread as primary staple, falling back to fish.
  // Target: combined bread and fish target reserves (or population * 0.2 units).
  // --------------------------------------------------------------------------
  const foodTarget = Math.max(
    1,
    (breadItem.target > 0 || fishItem.target > 0)
      ? breadItem.target + fishItem.target
      : Math.round(population * 0.25)
  );
  const foodStock = breadItem.stock + fishItem.stock;
  const foodCoverage = population === 0
    ? 100
    : Math.min(100, Math.max(0, Math.round((foodStock / foodTarget) * 100)));

  let foodShortfall: string | null = null;
  if (foodCoverage < 100) {
    // If bread is lower relative to its target, bread is shortfall; else fish
    const breadRatio = breadItem.target > 0 ? breadItem.stock / breadItem.target : breadItem.stock;
    const fishRatio = fishItem.target > 0 ? fishItem.stock / fishItem.target : fishItem.stock;
    foodShortfall = breadRatio <= fishRatio ? "bread" : "fish";
  }

  // --------------------------------------------------------------------------
  // FORMULA 2: Housing Need
  // Inputs: ingot.stock, ingot.target, citizens.population
  // Rationale: Structural integrity and dwelling upkeep require refined ingots.
  // Target: ingot target reserve (or 10 ingots per 100 citizens).
  // --------------------------------------------------------------------------
  const housingTarget = Math.max(
    1,
    ingotItem.target > 0 ? ingotItem.target : Math.round(population * 0.1)
  );
  const housingStock = ingotItem.stock;
  const housingCoverage = population === 0
    ? 100
    : Math.min(100, Math.max(0, Math.round((housingStock / housingTarget) * 100)));

  const housingShortfall = housingCoverage < 100 ? "ingot" : null;

  // --------------------------------------------------------------------------
  // FORMULA 3: Work Need
  // Inputs: tool.stock, tool.target, citizens.population
  // Rationale: Productive employment requires functional crafting tools.
  // Target: tool target reserve (or 5 tools per 100 citizens).
  // --------------------------------------------------------------------------
  const workTarget = Math.max(
    1,
    toolItem.target > 0 ? toolItem.target : Math.round(population * 0.05)
  );
  const workStock = toolItem.stock;
  const workCoverage = population === 0
    ? 100
    : Math.min(100, Math.max(0, Math.round((workStock / workTarget) * 100)));

  const workShortfall = workCoverage < 100 ? "tool" : null;

  // --------------------------------------------------------------------------
  // FORMULA 4: Goods Need
  // Inputs: elixir.stock, signatureItem.stock, elixir.target, signatureItem.target, population
  // Rationale: Quality of life and civic happiness demand elixirs and cultural artifacts.
  // Target: combined elixir and signature luxury target reserves.
  // --------------------------------------------------------------------------
  const goodsTarget = Math.max(
    1,
    (elixirItem.target > 0 || signatureItem.target > 0)
      ? elixirItem.target + signatureItem.target
      : Math.round(population * 0.06)
  );
  const goodsStock = elixirItem.stock + signatureItem.stock;
  const goodsCoverage = population === 0
    ? 100
    : Math.min(100, Math.max(0, Math.round((goodsStock / goodsTarget) * 100)));

  let goodsShortfall: string | null = null;
  if (goodsCoverage < 100) {
    const elixirRatio = elixirItem.target > 0 ? elixirItem.stock / elixirItem.target : elixirItem.stock;
    const sigRatio = signatureItem.target > 0 ? signatureItem.stock / signatureItem.target : signatureItem.stock;
    goodsShortfall = elixirRatio <= sigRatio ? "elixir" : signatureItemId;
  }

  const needs: NeedCoverage[] = [
    {
      need: "food",
      label: "Food",
      coverage: foodCoverage,
      shortfallItem: foodShortfall,
      formula: "ratio of grain/bread/fish reserves to dietary population target",
      description: "Daily nourishment to prevent hunger and emigration.",
    },
    {
      need: "housing",
      label: "Housing",
      coverage: housingCoverage,
      shortfallItem: housingShortfall,
      formula: "ratio of structural ingot reserves to municipal housing upkeep",
      description: "Shelter maintenance and municipal expansion materials.",
    },
    {
      need: "work",
      label: "Work",
      coverage: workCoverage,
      shortfallItem: workShortfall,
      formula: "ratio of tool inventory to craft and labor force needs",
      description: "Occupational implements required for commercial workshops.",
    },
    {
      need: "goods",
      label: "Goods",
      coverage: goodsCoverage,
      shortfallItem: goodsShortfall,
      formula: "ratio of tonic and cultural signature goods to civic demand",
      description: "Secondary amenities and prestige commodities sustaining contentment.",
    },
  ];

  // --------------------------------------------------------------------------
  // IN DEMAND ITEMS:
  // Criteria from brief: price above base price OR stock below target reserve.
  // --------------------------------------------------------------------------
  const inDemand: CityMarketItemStatus[] = [];
  // --------------------------------------------------------------------------
  // OVERSUPPLIED ITEMS:
  // Criteria from brief: stock far above consumption / target reserve (stock > target).
  // --------------------------------------------------------------------------
  const oversupplied: CityMarketItemStatus[] = [];

  for (const item of city.market ?? []) {
    const isAboveBase = item.price > item.base_price;
    const isBelowTarget = item.stock < item.target;
    const isAboveTarget = item.stock > item.target;

    if (isAboveBase || isBelowTarget) {
      let reason = "";
      if (isAboveBase && isBelowTarget) {
        const pctPrice = Math.round(((item.price - item.base_price) / item.base_price) * 100);
        reason = `High demand: price is +${pctPrice}% above base with inventory deficit.`;
      } else if (isAboveBase) {
        const pctPrice = Math.round(((item.price - item.base_price) / item.base_price) * 100);
        reason = `Elevated price: +${pctPrice}% above base (${item.price} vs ${item.base_price} coin).`;
      } else {
        const deficit = item.target - item.stock;
        reason = `Reserve deficit: current stock (${item.stock}) is ${deficit} units below target.`;
      }

      inDemand.push({
        id: item.id,
        name: item.name,
        tier: item.tier,
        price: item.price,
        basePrice: item.base_price,
        stock: item.stock,
        target: item.target,
        ratio: item.target > 0 ? item.stock / item.target : 0,
        reason,
      });
    }

    if (isAboveTarget) {
      const surplus = item.stock - item.target;
      const pctOver = item.target > 0 ? Math.round((surplus / item.target) * 100) : 100;
      const reason = `Excess reserve: stock (${item.stock}) exceeds target by ${pctOver}%.`;

      oversupplied.push({
        id: item.id,
        name: item.name,
        tier: item.tier,
        price: item.price,
        basePrice: item.base_price,
        stock: item.stock,
        target: item.target,
        ratio: item.target > 0 ? item.stock / item.target : 2,
        reason,
      });
    }
  }

  // Sort inDemand: highest price ratio / biggest deficit first
  inDemand.sort((a, b) => {
    const aPressure = a.price / Math.max(1, a.basePrice) - (a.target > 0 ? a.stock / a.target : 1);
    const bPressure = b.price / Math.max(1, b.basePrice) - (b.target > 0 ? b.stock / b.target : 1);
    return bPressure - aPressure;
  });

  // Sort oversupplied: highest stock multiple first
  oversupplied.sort((a, b) => b.ratio - a.ratio);

  // --------------------------------------------------------------------------
  // SATISFACTION:
  // Exact satisfaction from simulation (do not invent a new one)
  // --------------------------------------------------------------------------
  const satBps = city.citizens?.satisfaction_bps ?? 0;
  const satPct = Math.round(satBps / 100);

  return {
    needs,
    inDemand,
    oversupplied,
    satisfactionBps: satBps,
    satisfactionPct: satPct,
  };
}
