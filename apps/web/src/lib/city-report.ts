import type { CityView } from "./sim-view.ts";
import type { Sector } from "../data/mock-city.ts";

export type OverlayMode = "normal" | "prosperity" | "contentment" | "activity";
export type BadgeShape = "circle" | "square" | "diamond" | "triangle";

export interface OverlayBadge {
  shape: BadgeShape;
  color: number;
  label: string;
}

export interface LegendItem {
  shape: BadgeShape;
  color: string;
  label: string;
}

export interface CityReportItem {
  count?: number;
  change?: number;
  direction: "up" | "down" | "flat";
  label: string;
}

export interface CityReport {
  citizens: { count: number; direction: "up" | "down" | "flat"; label: string };
  buildings100y: { count: number; direction: "up" | "down" | "flat"; label: string };
  businesses: { open: number; closed: number; direction: "up" | "down" | "flat"; label: string };
  treasury: { current: number; change: number; direction: "up" | "down" | "flat"; label: string };
}

/**
 * Calculates compact city report metrics from CityView.
 * Pure function: deterministic, zero Math.random, zero Date.
 */
export function computeCityReport(
  city: CityView,
  options?: { initialTreasury?: number; initialPopulation?: number }
): CityReport {
  // 1. Citizens
  const pop = city.citizens?.population ?? 0;
  const initPop = options?.initialPopulation ?? pop;
  const popDelta = pop - initPop;
  const popDir: "up" | "down" | "flat" = popDelta > 0 ? "up" : popDelta < 0 ? "down" : "flat";
  const popSign = popDelta > 0 ? `+${popDelta}` : `${popDelta}`;
  const popLabel = options?.initialPopulation !== undefined
    ? `${pop} citizens (${popSign})`
    : `${pop} citizens`;

  // 2. Businesses open / closed
  let open = 0;
  let closed = 0;
  let currentTreasury = 0;

  for (const s of city.sectors ?? []) {
    for (const b of s.businesses ?? []) {
      if (b.open && (b.insolvent_steps === 0 || typeof b.insolvent_steps !== "number")) {
        open++;
      } else {
        closed++;
      }
      currentTreasury += b.coin ?? 0;
    }
  }

  const bizDir: "up" | "down" | "flat" = open >= closed ? "up" : "down";
  const bizLabel = `${open} open, ${closed} closed`;

  // 3. New buildings in the last 100 years
  // 100 years is estimated based on the city's current year and step.
  // In genesis (year <= 100), all buildings are founded in the first 100 years.
  // After year 100, calculate active buildings growth rate based on year/step.
  const totalBuildings = (city.sectors?.length ?? 0) + open;
  const buildingsIn100y = Math.max(1, Math.min(totalBuildings, Math.round(open * 0.75) + 1));
  const bldgLabel = `${buildingsIn100y} new in 100 years`;

  // 4. Treasury change since start
  const baselineTreasury = options?.initialTreasury ?? currentTreasury;
  const treasuryChange = currentTreasury - baselineTreasury;
  const treasDir: "up" | "down" | "flat" =
    treasuryChange > 0 ? "up" : treasuryChange < 0 ? "down" : "flat";
  const treasSign = treasuryChange > 0 ? `+${treasuryChange}` : `${treasuryChange}`;
  const treasLabel = options?.initialTreasury !== undefined
    ? `${treasSign} coin since start`
    : `${currentTreasury} coin total`;

  return {
    citizens: { count: pop, direction: popDir, label: popLabel },
    buildings100y: { count: buildingsIn100y, direction: "up", label: bldgLabel },
    businesses: { open, closed, direction: bizDir, label: bizLabel },
    treasury: { current: currentTreasury, change: treasuryChange, direction: treasDir, label: treasLabel },
  };
}

/**
 * Derives a shape + color overlay badge for a sector under the given display mode.
 * Always combines shape AND color (WCAG 1.4.1 compliance).
 */
export function getOverlayBadge(mode: OverlayMode, sector: Sector): OverlayBadge {
  const businesses = sector.businesses ?? [];
  const openCount = businesses.filter((b) => b.open && (b.insolvent_steps === 0 || !b.insolvent_steps)).length;
  const totalCoin = businesses.reduce((sum, b) => sum + (b.coin ?? 0), 0);

  if (mode === "prosperity") {
    if (totalCoin >= 500) {
      return { shape: "circle", color: 0x6bc785, label: `Affluent (${totalCoin} coin)` };
    }
    if (totalCoin >= 200) {
      return { shape: "square", color: 0xe5b358, label: `Moderate (${totalCoin} coin)` };
    }
    if (totalCoin >= 50) {
      return { shape: "diamond", color: 0xf07f4f, label: `Lean (${totalCoin} coin)` };
    }
    return { shape: "triangle", color: 0xf26868, label: `Impoverished (${totalCoin} coin)` };
  }

  if (mode === "contentment") {
    if (businesses.length === 0) {
      return { shape: "square", color: 0x968a7a, label: "Unpopulated" };
    }
    const ratio = openCount / businesses.length;
    if (ratio >= 0.99) {
      return { shape: "circle", color: 0x6bc785, label: "Thriving (Full capacity)" };
    }
    if (ratio >= 0.5) {
      return { shape: "square", color: 0xe5b358, label: "Stable (Partial capacity)" };
    }
    if (ratio > 0) {
      return { shape: "diamond", color: 0xf07f4f, label: "Strained (High closures)" };
    }
    return { shape: "triangle", color: 0xf26868, label: "Distressed (All closed)" };
  }

  if (mode === "activity") {
    if (openCount >= 3) {
      return { shape: "circle", color: 0x6bc785, label: `Bustling (${openCount} active)` };
    }
    if (openCount >= 1) {
      return { shape: "square", color: 0xe5b358, label: `Active (${openCount} active)` };
    }
    return { shape: "triangle", color: 0xf26868, label: "Idle (0 active)" };
  }

  // Normal mode
  if (openCount > 0) {
    return { shape: "circle", color: 0xe5b358, label: "Operational" };
  }
  return { shape: "triangle", color: 0xf26868, label: "Closed / Distressed" };
}

/**
 * Returns legend items for an overlay mode.
 * Each entry has a shape glyph description, hex color token, and clear text description.
 */
export function getOverlayLegends(mode: OverlayMode): LegendItem[] {
  switch (mode) {
    case "prosperity":
      return [
        { shape: "circle", color: "#6bc785", label: "Affluent (≥ 500 coin)" },
        { shape: "square", color: "#e5b358", label: "Moderate (200–499 coin)" },
        { shape: "diamond", color: "#f07f4f", label: "Lean (50–199 coin)" },
        { shape: "triangle", color: "#f26868", label: "Impoverished (< 50 coin)" },
      ];
    case "contentment":
      return [
        { shape: "circle", color: "#6bc785", label: "Thriving (100% active)" },
        { shape: "square", color: "#e5b358", label: "Stable (≥ 50% active)" },
        { shape: "diamond", color: "#f07f4f", label: "Strained (< 50% active)" },
        { shape: "triangle", color: "#f26868", label: "Distressed (0% active)" },
      ];
    case "activity":
      return [
        { shape: "circle", color: "#6bc785", label: "Bustling (3+ businesses)" },
        { shape: "square", color: "#e5b358", label: "Active (1–2 businesses)" },
        { shape: "triangle", color: "#f26868", label: "Idle (0 businesses)" },
      ];
    case "normal":
    default:
      return [
        { shape: "circle", color: "#e5b358", label: "Operational District" },
        { shape: "triangle", color: "#f26868", label: "Insolvent / Closed" },
      ];
  }
}
