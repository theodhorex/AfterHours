/**
 * Pure domain logic for cross-world global market aggregation and trade discovery.
 * Aggregates CityViews across the 4 simulation worlds into unified market rows.
 * Zero React/Next dependencies, 100% deterministic, no Math.random/Date.now.
 */

import { AVAILABLE_ARCS, getArc } from "./sim-adapter.ts";
import { toTitleCase, type CityView } from "./sim-view.ts";

export type SupplyStatus = "short" | "balanced" | "plenty";
export type ItemCategory = "raw" | "processed";

export interface WorldMarketCell {
  worldId: string;
  worldName: string;
  price: number | null;
  stock: number | null;
  target: number | null;
  supplyStatus: SupplyStatus | null;
}

export interface TradeSuggestion {
  worldId: string;
  worldName: string;
  price: number;
  reason: string;
}

export interface GlobalMarketRecommendation {
  buyHere: TradeSuggestion | null;
  sellHere: TradeSuggestion | null;
  summary: string;
}

export interface GlobalMarketRow {
  id: string;
  name: string;
  tier: "staple" | "raw" | "refined" | "luxury";
  category: ItemCategory;
  isExclusive: boolean;
  worlds: Record<string, WorldMarketCell>;
  cheapest: TradeSuggestion | null;
  dearest: TradeSuggestion | null;
  spreadPct: number;
  spreadAbsolute: number;
  recommendation: GlobalMarketRecommendation;
}

export const WORLD_NAMES: Record<string, string> = {
  goblin_warrens: "Goblin Warrens",
  cave_hold: "Cave Hold",
  dino_vale: "Dino Vale",
  elf_grove: "Elf Grove",
};

/**
 * Determines commodity supply status based on current stock vs consumption target.
 * - 'short': stock < 80% target
 * - 'balanced': 80% <= stock <= 120% target
 * - 'plenty': stock > 120% target
 */
export function calculateSupplyStatus(stock: number, target: number): SupplyStatus {
  if (target <= 0) {
    return stock > 0 ? "plenty" : "short";
  }
  const ratio = stock / target;
  if (ratio < 0.8) return "short";
  if (ratio > 1.2) return "plenty";
  return "balanced";
}

/**
 * Calculates percentage price spread between cheapest and dearest realms.
 * Returns integer percentage: e.g. 10c to 30c -> 200 (for +200%).
 */
export function calculateSpread(minPrice: number, maxPrice: number): number {
  if (minPrice <= 0 || maxPrice <= minPrice) return 0;
  return Math.round(((maxPrice - minPrice) / minPrice) * 100);
}

/**
 * Friendly name lookup matching game vernacular.
 */
const ITEM_DISPLAY_NAMES: Record<string, string> = {
  grain: "Cave Grain",
  flour: "Stone Flour",
  bread: "Cinder Bread",
  fish: "Blind Fish",
  ore: "Crude Ore",
  ingot: "Scrap Ingot",
  tool: "Warren Pick",
  crystal: "Glimmer Shard",
  elixir: "Bile Tonic",
  scroll: "Shadow Script",
  scrap: "Rusted Bits",
  gadget: "Clockwork Gizmo",
  hide: "Beast Hide",
  totem: "Runic Totem",
  amber: "Amber Resin",
  fossil: "Ancient Fossil",
  silverleaf: "Silverleaf Herb",
  stave: "Living Stave",
};

export function getItemDisplayName(id: string): string {
  return ITEM_DISPLAY_NAMES[id] ?? toTitleCase(id);
}

/**
 * Maps arc item definitions to category chips ("raw" vs "processed").
 */
export function getItemCategory(tier: string): ItemCategory {
  return tier === "raw" ? "raw" : "processed";
}

/**
 * Normalizes CityView collections (either Array or Record).
 */
function normalizeViews(
  views: CityView[] | Record<string, CityView>
): Record<string, CityView> {
  if (Array.isArray(views)) {
    const map: Record<string, CityView> = {};
    for (const v of views) {
      map[v.arc_id] = v;
    }
    return map;
  }
  return views;
}

/**
 * Builds table rows comparing all items across the four worlds.
 */
export function buildGlobalMarketRows(
  viewsInput: CityView[] | Record<string, CityView>
): GlobalMarketRow[] {
  const views = normalizeViews(viewsInput);

  // 1. Gather all item definitions and tiers across canonical arcs
  const itemMetaMap = new Map<string, { id: string; name: string; tier: "staple" | "raw" | "refined" | "luxury" }>();

  for (const arcId of AVAILABLE_ARCS) {
    const arc = getArc(arcId);
    for (const item of arc.items) {
      if (!itemMetaMap.has(item.id)) {
        itemMetaMap.set(item.id, {
          id: item.id,
          name: getItemDisplayName(item.id),
          tier: (item.tier as "staple" | "raw" | "refined" | "luxury") ?? "staple",
        });
      }
    }
  }

  const rows: GlobalMarketRow[] = [];

  for (const [itemId, meta] of itemMetaMap.entries()) {
    const worldCells: Record<string, WorldMarketCell> = {};
    const validPrices: { worldId: string; worldName: string; price: number; supply: SupplyStatus }[] = [];

    for (const arcId of AVAILABLE_ARCS) {
      const worldName = WORLD_NAMES[arcId] ?? toTitleCase(arcId);
      const view = views[arcId];
      const marketItem = view?.market?.find((m) => m.id === itemId);

      if (marketItem) {
        const supplyStatus = calculateSupplyStatus(marketItem.stock, marketItem.target);
        worldCells[arcId] = {
          worldId: arcId,
          worldName,
          price: marketItem.price,
          stock: marketItem.stock,
          target: marketItem.target,
          supplyStatus,
        };
        validPrices.push({
          worldId: arcId,
          worldName,
          price: marketItem.price,
          supply: supplyStatus,
        });
      } else {
        worldCells[arcId] = {
          worldId: arcId,
          worldName,
          price: null,
          stock: null,
          target: null,
          supplyStatus: null,
        };
      }
    }

    // Determine cheapest and dearest
    let cheapest: TradeSuggestion | null = null;
    let dearest: TradeSuggestion | null = null;
    let spreadPct = 0;
    let spreadAbsolute = 0;
    const isExclusive = validPrices.length === 1;

    if (validPrices.length > 0) {
      // Sort ascending by price
      const sorted = [...validPrices].sort((a, b) => a.price - b.price);
      const low = sorted[0];
      const high = sorted[sorted.length - 1];

      cheapest = {
        worldId: low.worldId,
        worldName: low.worldName,
        price: low.price,
        reason: `Lowest purchase price at ${low.price} coin (${low.supply} supply in ${low.worldName}).`,
      };

      dearest = {
        worldId: high.worldId,
        worldName: high.worldName,
        price: high.price,
        reason: `Highest selling price at ${high.price} coin (${high.supply} supply in ${high.worldName}).`,
      };

      if (high.price > low.price) {
        spreadPct = calculateSpread(low.price, high.price);
        spreadAbsolute = high.price - low.price;
      }
    }

    // Recommendation sentence
    let buyHere: TradeSuggestion | null = null;
    let sellHere: TradeSuggestion | null = null;
    let summary = "";

    if (isExclusive && cheapest) {
      summary = `Exclusive to ${cheapest.worldName} at ${cheapest.price} coin; no inter-realm price spread.`;
    } else if (validPrices.length > 1 && spreadPct > 0 && cheapest && dearest) {
      buyHere = cheapest;
      sellHere = dearest;
      summary = `Buy in ${cheapest.worldName} (${cheapest.price}c), sell in ${dearest.worldName} (${dearest.price}c) for +${spreadPct}% spread.`;
    } else if (cheapest) {
      summary = `Parity pricing across realms at ${cheapest.price} coin; no arbitrage spread.`;
    } else {
      summary = "No market price data recorded.";
    }

    rows.push({
      id: itemId,
      name: meta.name,
      tier: meta.tier,
      category: getItemCategory(meta.tier),
      isExclusive,
      worlds: worldCells,
      cheapest,
      dearest,
      spreadPct,
      spreadAbsolute,
      recommendation: {
        buyHere,
        sellHere,
        summary,
      },
    });
  }

  return rows;
}

/**
 * Extracts top N trade arbitrage opportunities sorted by spread percentage descending.
 */
export function getBestTrades(
  rows: GlobalMarketRow[],
  limit: number = 5
): GlobalMarketRow[] {
  return [...rows]
    .filter((r) => !r.isExclusive && r.spreadPct > 0 && r.recommendation.buyHere && r.recommendation.sellHere)
    .sort((a, b) => b.spreadPct - a.spreadPct || b.spreadAbsolute - a.spreadAbsolute)
    .slice(0, limit);
}
