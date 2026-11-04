/**
 * Time speed tiers, simulated bread wallet, and in-world calendar clock.
 * Kept pure with zero Next/React dependencies for Node test compatibility.
 */
import type { Season } from "./format.ts";

export const FREE_TIERS = ["1x", "3x", "30x", "timelapse"] as const;
export const PREVIEW_TIERS = ["60x", "120x", "240x", "480x", "960x"] as const;
export type FreeSpeedTier = (typeof FREE_TIERS)[number];
export type PreviewSpeedTier = (typeof PREVIEW_TIERS)[number];
export type SpeedTier = FreeSpeedTier | PreviewSpeedTier;

// Temporal constants
export const STEPS_PER_YEAR = 4;
export const DAYS_PER_SEASON = 91.25;
export const DAYS_PER_YEAR = STEPS_PER_YEAR * DAYS_PER_SEASON; // 365 days
export const TOTAL_CITY_STEPS = 10000;
export const TOTAL_CITY_YEARS = 2500;
export const OFFICIAL_TIER: SpeedTier = "30x";

export const SECONDS_PER_REAL_DAY = 86400;
export const SECONDS_PER_SEASON_AT_1X = DAYS_PER_SEASON * SECONDS_PER_REAL_DAY; // 7,884,000s

// Ticket & pricing constants
export const PREVIEW_PRICE_BASE = 100; // 60x costs 100 bread
export const PREVIEW_PRICE_MULTIPLIER = 2; // Doubling per tier
export const DEFAULT_PASS_DURATION_MS = 10 * 60 * 1000; // 10-minute pass
export const DEFAULT_WALLET_BALANCE = 500; // Starting demo bread balance
export const WALLET_STORAGE_KEY = "afterhours_bread_wallet_v1";

const SEASONS: Season[] = ["Spring", "Summer", "Autumn", "Winter"];

export interface ActiveTicket {
  tier: PreviewSpeedTier;
  purchasedAt: number;
  expiresAt: number;
  costBread: number;
}

export interface BreadSinkEntry {
  id: string;
  timestamp: number;
  tier: PreviewSpeedTier;
  cost: number;
  description: string;
}

export interface SpeedWallet {
  bread: number;
  activeTicket: ActiveTicket | null;
  sinkLog: BreadSinkEntry[];
}

export interface CalendarClock {
  year: number;
  season: Season;
  day: number;
  totalDays: number;
}

/** Check if a tier is free */
export function isFreeTier(tier: string): tier is FreeSpeedTier {
  return (FREE_TIERS as readonly string[]).includes(tier);
}

/** Check if a tier is preview */
export function isPreviewTier(tier: string): tier is PreviewSpeedTier {
  return (PREVIEW_TIERS as readonly string[]).includes(tier);
}

/**
 * Return the price in bread for a given speed tier.
 * Free tiers always cost 0 bread.
 * Preview tiers double per tier starting from PREVIEW_PRICE_BASE at 60x.
 */
export function pricePreview(tier: SpeedTier): number {
  if (isFreeTier(tier)) return 0;
  const idx = PREVIEW_TIERS.indexOf(tier as PreviewSpeedTier);
  if (idx < 0) return 0;
  return PREVIEW_PRICE_BASE * Math.pow(PREVIEW_PRICE_MULTIPLIER, idx);
}

/**
 * Check if a tier is currently usable by the wallet at the given timestamp (now).
 * Free tiers are always usable.
 * Preview tiers require an active, unexpired ticket for that tier.
 */
export function canUse(wallet: SpeedWallet, tier: SpeedTier, now: number): boolean {
  if (isFreeTier(tier)) return true;
  if (!wallet.activeTicket) return false;
  if (wallet.activeTicket.tier !== tier) return false;
  return now < wallet.activeTicket.expiresAt;
}

/**
 * Pure function to purchase a preview tier ticket.
 * Injects `now` to remain strictly deterministic and testable without side-effects.
 */
export function buyTicket(
  wallet: SpeedWallet,
  tier: SpeedTier,
  now: number,
  durationMs: number = DEFAULT_PASS_DURATION_MS
): {
  success: boolean;
  wallet: SpeedWallet;
  ticket?: ActiveTicket;
  error?: string;
} {
  if (!isPreviewTier(tier)) {
    return {
      success: false,
      wallet,
      error: `Tier ${tier} is already free to use.`,
    };
  }

  const price = pricePreview(tier);
  if (wallet.bread < price) {
    return {
      success: false,
      wallet,
      error: `Insufficient bread balance: need ${price} bread, have ${wallet.bread}.`,
    };
  }

  const ticket: ActiveTicket = {
    tier,
    purchasedAt: now,
    expiresAt: now + durationMs,
    costBread: price,
  };

  const sinkEntry: BreadSinkEntry = {
    id: `sink_${now}_${tier}`,
    timestamp: now,
    tier,
    cost: price,
    description: `Purchased ${tier} PREVIEW pass (10 min)`,
  };

  const nextWallet: SpeedWallet = {
    bread: clampWalletBalance(wallet.bread - price),
    activeTicket: ticket,
    sinkLog: [sinkEntry, ...wallet.sinkLog].slice(0, 50), // keep last 50 entries
  };

  return {
    success: true,
    wallet: nextWallet,
    ticket,
  };
}

/**
 * Get active tier, automatically reverting to official 30x if an active ticket has expired.
 */
export function getActiveSpeed(
  selectedTier: SpeedTier,
  wallet: SpeedWallet,
  now: number
): SpeedTier {
  if (canUse(wallet, selectedTier, now)) {
    return selectedTier;
  }
  return OFFICIAL_TIER;
}

/**
 * Get multiplier factor for a speed tier (e.g. 30 for 30x).
 */
export function getTierMultiplier(tier: SpeedTier): number {
  switch (tier) {
    case "1x":
      return 1;
    case "3x":
      return 3;
    case "30x":
      return 30;
    case "60x":
      return 60;
    case "120x":
      return 120;
    case "240x":
      return 240;
    case "480x":
      return 480;
    case "960x":
      return 960;
    case "timelapse":
      return 0;
  }
}

/**
 * Returns effective simulated seasons per real second.
 * For fixed multipliers (1x..960x), calculated from 1 season = 91.25 days = 7,884,000 real seconds at 1x.
 * For timelapse, returns the selected demo steps per second (default 4 steps/sec = 4 seasons/sec).
 */
export function effectiveSeasonsPerSecond(
  tier: SpeedTier,
  timelapseStepsPerSec = 4
): number {
  if (tier === "timelapse") {
    return Math.max(0.1, Math.min(60, timelapseStepsPerSec));
  }
  const multiplier = getTierMultiplier(tier);
  return multiplier / SECONDS_PER_SEASON_AT_1X;
}

/**
 * In-world calendar clock: calculates (year, season, day, totalDays)
 * from the simulation step and optional day offset.
 */
export function calculateCalendarClock(
  step: number,
  dayOffset = 0
): CalendarClock {
  const safeStep = Math.max(0, Math.floor(step));
  const safeOffset = Math.max(0, dayOffset);
  const totalDays = safeStep * DAYS_PER_SEASON + safeOffset;
  const year = Math.floor(safeStep / STEPS_PER_YEAR);
  const stepInYear = safeStep % STEPS_PER_YEAR;
  const season = SEASONS[stepInYear];
  const dayInSeason = Math.min(
    91,
    Math.floor(safeOffset % DAYS_PER_SEASON) + 1
  );

  return {
    year,
    season,
    day: dayInSeason,
    totalDays,
  };
}

/**
 * Defensive clamp for wallet bread balance to guard against NaN, negative, or overflow.
 */
export function clampWalletBalance(value: unknown): number {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  if (value === Infinity) return 1_000_000;
  if (value === -Infinity) return 0;
  return Math.max(0, Math.min(1_000_000, Math.floor(value)));
}

/**
 * Parse stored wallet JSON defensively with fallback.
 */
export function parseStoredWallet(raw: string | null): SpeedWallet {
  const fallback: SpeedWallet = {
    bread: DEFAULT_WALLET_BALANCE,
    activeTicket: null,
    sinkLog: [],
  };

  if (!raw) return fallback;
  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object") return fallback;

    const bread = clampWalletBalance(data.bread ?? DEFAULT_WALLET_BALANCE);

    let activeTicket: ActiveTicket | null = null;
    if (
      data.activeTicket &&
      typeof data.activeTicket === "object" &&
      isPreviewTier(data.activeTicket.tier) &&
      typeof data.activeTicket.purchasedAt === "number" &&
      typeof data.activeTicket.expiresAt === "number" &&
      typeof data.activeTicket.costBread === "number"
    ) {
      activeTicket = {
        tier: data.activeTicket.tier,
        purchasedAt: data.activeTicket.purchasedAt,
        expiresAt: data.activeTicket.expiresAt,
        costBread: clampWalletBalance(data.activeTicket.costBread),
      };
    }

    const sinkLog: BreadSinkEntry[] = Array.isArray(data.sinkLog)
      ? data.sinkLog
          .filter(
            (item: unknown): item is BreadSinkEntry =>
              Boolean(item) &&
              typeof item === "object" &&
              typeof (item as BreadSinkEntry).id === "string" &&
              typeof (item as BreadSinkEntry).timestamp === "number" &&
              isPreviewTier((item as BreadSinkEntry).tier) &&
              typeof (item as BreadSinkEntry).cost === "number"
          )
          .slice(0, 50)
      : [];

    return { bread, activeTicket, sinkLog };
  } catch {
    return fallback;
  }
}

/**
 * Serialize wallet for localStorage safely.
 */
export function serializeWallet(wallet: SpeedWallet): string {
  return JSON.stringify({
    bread: clampWalletBalance(wallet.bread),
    activeTicket: wallet.activeTicket,
    sinkLog: wallet.sinkLog.slice(0, 50),
  });
}

/**
 * Safe browser localStorage loader with try/catch fallback.
 */
export function loadWalletFromStorage(): SpeedWallet {
  if (typeof window === "undefined" || !window.localStorage) {
    return {
      bread: DEFAULT_WALLET_BALANCE,
      activeTicket: null,
      sinkLog: [],
    };
  }
  try {
    const raw = window.localStorage.getItem(WALLET_STORAGE_KEY);
    return parseStoredWallet(raw);
  } catch {
    return {
      bread: DEFAULT_WALLET_BALANCE,
      activeTicket: null,
      sinkLog: [],
    };
  }
}

/**
 * Safe browser localStorage saver with try/catch fallback.
 */
export function saveWalletToStorage(wallet: SpeedWallet): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(WALLET_STORAGE_KEY, serializeWallet(wallet));
  } catch {
    // Ignore storage quota or security errors gracefully
  }
}
