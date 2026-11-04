/**
 * Pure formatting utilities for the AfterEarth settlement ledger.
 * Kept strictly pure with zero Next/React dependencies for Node 26 native tests.
 */

export type Season = "Spring" | "Summer" | "Autumn" | "Winter";

const SEASONS: Season[] = ["Spring", "Summer", "Autumn", "Winter"];

/**
 * Format coin integer values with comma grouping and coin label.
 */
export function formatCoin(amount: number | bigint): string {
  const n = typeof amount === "bigint" ? amount : BigInt(Math.round(amount));
  return `${n.toLocaleString("en-US")} coin`;
}

/**
 * Format item count or population with comma grouping.
 */
export function formatCount(n: number | bigint): string {
  const val = typeof n === "bigint" ? n : BigInt(Math.round(n));
  return val.toLocaleString("en-US");
}

/**
 * Convert step index to simulation calendar: 4 steps per year.
 * Step 0 = Year 0, Spring.
 * Step 480 = Year 120, Spring.
 */
export function stepToSeason(step: number): {
  year: number;
  season: Season;
  stepInYear: number;
} {
  const s = Math.max(0, Math.floor(step));
  const year = Math.floor(s / 4);
  const stepInYear = s % 4;
  const season = SEASONS[stepInYear];
  return { year, season, stepInYear };
}

/**
 * Format a step as a display string (e.g., "Year 120, Spring").
 */
export function formatStep(step: number): string {
  const { year, season } = stepToSeason(step);
  return `Year ${year}, ${season}`;
}
