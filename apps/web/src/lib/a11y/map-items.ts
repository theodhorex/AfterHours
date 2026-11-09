/**
 * Pure helper for building accessible map object items from a CityView.
 * Districts appear first, followed by prioritized icon bubbles.
 */

import type { CityView } from "../sim-view.ts";
import { bubblesFor } from "../iso/bubbles.ts";

export interface MapA11yItem {
  id: string;
  label: string;
  sectorIdx: number;
  kind: "district" | "bubble";
}

/**
 * Formats accessible label for a district.
 * Format: "Bakery district, 3 businesses, 1 closed"
 */
export function formatDistrictLabel(
  name: string,
  totalBiz: number,
  closedBiz: number,
): string {
  const bizWord = totalBiz === 1 ? "business" : "businesses";
  return `${name}, ${totalBiz} ${bizWord}, ${closedBiz} closed`;
}

/**
 * Builds an ordered list of map items (districts first, then bubbles).
 * Pure function: deterministic, zero Math.random, zero Date.
 */
export function buildMapA11yItems(city: CityView | null | undefined): MapA11yItem[] {
  if (!city || !Array.isArray(city.sectors) || city.sectors.length === 0) {
    return [];
  }

  const items: MapA11yItem[] = [];

  // 1. Districts (ordered by sector index)
  const sortedSectors = [...city.sectors].sort((a, b) => a.idx - b.idx);
  for (const sector of sortedSectors) {
    const businesses = Array.isArray(sector.businesses) ? sector.businesses : [];
    const totalBiz = businesses.length;
    const closedBiz = businesses.filter(
      (b) => !b.open || (typeof b.insolvent_steps === "number" && b.insolvent_steps > 0),
    ).length;

    const label = formatDistrictLabel(sector.name, totalBiz, closedBiz);

    items.push({
      id: `district-${sector.idx}`,
      label,
      sectorIdx: sector.idx,
      kind: "district",
    });
  }

  // 2. Bubbles (from pure bubblesFor helper)
  const bubbles = bubblesFor(city);
  for (const bubble of bubbles) {
    const label = bubble.ariaLabel || `${bubble.title}: ${bubble.description}`;
    items.push({
      id: bubble.id,
      label,
      sectorIdx: bubble.sectorIdx,
      kind: "bubble",
    });
  }

  return items;
}
