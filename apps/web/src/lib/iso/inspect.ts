import type { Sector } from "../../data/mock-city.ts";

export interface TooltipPositionOptions {
  pointerX: number;
  pointerY: number;
  cardWidth: number;
  cardHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  offset?: number;
}

export interface BuildingHoverData {
  sectorIdx: number;
  name: string;
  kind: string;
  level: number;
  openCount: number;
  insolventCount: number;
  totalCoin: number;
  activeRevenue: number;
}

export interface TouchTapState {
  lastTappedId: string | null;
  lastTappedTime: number;
}

export interface TouchTapResult {
  action: "inspect" | "open";
  nextState: TouchTapState;
}

/**
 * Clamps tooltip position within viewport bounds, flipping sides when needed.
 * Pure function: deterministic, zero side effects.
 */
export function clampTooltipPosition(options: TooltipPositionOptions): { x: number; y: number } {
  const {
    pointerX,
    pointerY,
    cardWidth,
    cardHeight,
    viewportWidth,
    viewportHeight,
    offset = 12,
  } = options;

  let x = pointerX + offset;
  let y = pointerY + offset;

  // Flip horizontally if overflow on the right
  if (x + cardWidth > viewportWidth) {
    x = pointerX - offset - cardWidth;
  }

  // Flip vertically if overflow on bottom
  if (y + cardHeight > viewportHeight) {
    y = pointerY - offset - cardHeight;
  }

  // Hard clamp within viewport
  const maxX = Math.max(0, viewportWidth - cardWidth);
  const maxY = Math.max(0, viewportHeight - cardHeight);

  return {
    x: Math.max(0, Math.min(x, maxX)),
    y: Math.max(0, Math.min(y, maxY)),
  };
}

/**
 * Formats a clean level label for display without emojis.
 */
export function formatLevelLabel(level: number, kind?: string): string {
  if (level <= 0) return "Level 0";
  const titles: Record<number, string> = {
    1: "Settlement",
    2: "Workshop",
    3: "Landmark",
  };
  const title = titles[level] ?? "District";
  return `Level ${level} • ${title}`;
}

/**
 * Returns a practical hint regarding next upgrade tier.
 */
export function getNextLevelHint(kind: string, level: number): string {
  if (level >= 3) {
    return "District is fully developed at maximum tier.";
  }
  if (level === 0) {
    return "Promote commerce and city growth to reach Level 1.";
  }
  if (level === 1) {
    return "Maintain open businesses and coin reserve for Level 2.";
  }
  return "Reach sustained civic prosperity to build Level 3.";
}

/**
 * Extracts and calculates summary metrics for a sector's building.
 */
export function calcBuildingHoverData(
  sector: Sector,
  buildingLevel = 1
): BuildingHoverData {
  let openCount = 0;
  let insolventCount = 0;
  let totalCoin = 0;
  let activeRevenue = 0;

  for (const b of sector.businesses) {
    const isOpen = b.open && b.insolvent_steps === 0;
    if (isOpen) {
      openCount++;
      activeRevenue += b.coin;
    } else {
      insolventCount++;
    }
    totalCoin += b.coin;
  }

  return {
    sectorIdx: sector.idx,
    name: sector.name,
    kind: sector.kind,
    level: buildingLevel,
    openCount,
    insolventCount,
    totalCoin,
    activeRevenue,
  };
}

/**
 * Manages touch interactions: first tap = inspect, second tap within window = open.
 */
export function resolveTouchTap(
  state: TouchTapState,
  currentId: string,
  currentTime: number,
  doubleTapWindowMs = 500
): TouchTapResult {
  if (
    state.lastTappedId === currentId &&
    currentTime - state.lastTappedTime <= doubleTapWindowMs
  ) {
    return {
      action: "open",
      nextState: {
        lastTappedId: null,
        lastTappedTime: 0,
      },
    };
  }

  return {
    action: "inspect",
    nextState: {
      lastTappedId: currentId,
      lastTappedTime: currentTime,
    },
  };
}
