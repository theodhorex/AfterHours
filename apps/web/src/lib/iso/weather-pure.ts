/**
 * Pure seasonal weather configuration and cross-fade math helpers.
 * Defines particle counts, season presets, and continuous fade factors.
 * Strictly pure helper — zero mutations, deterministic.
 */

import type { Bounds2D } from "./light-curve.ts";

export const MAX_WEATHER_PARTICLES = 120;
export const CROSSFADE_DURATION_SEC = 2.0;

export type ParticleKind = "rain" | "ripple" | "dust" | "fireflies" | "leaves" | "fog" | "snow" | "none";

export interface SeasonWeatherSpec {
  primaryKind: "rain" | "dust" | "leaves" | "snow";
  secondaryKind: "ripple" | "fireflies" | "fog" | "none";
  primaryCount: number;
  secondaryCount: number;
}

/**
 * Returns weather configuration for each season index (0: spring, 1: summer, 2: autumn, 3: winter).
 * Summer dynamically enables fireflies during dusk and night.
 */
export function getSeasonWeatherSpec(season: number, timeOfDayT = 0.3): SeasonWeatherSpec {
  const normSeason = ((Math.floor(season) % 4) + 4) % 4;
  const isDuskOrNight = timeOfDayT >= 0.5 || timeOfDayT < 0.12;

  switch (normSeason) {
    case 0: // Spring: rain streaks + ripple dots on water
      return { primaryKind: "rain", secondaryKind: "ripple", primaryCount: 55, secondaryCount: 25 };
    case 1: // Summer: clear, drifting dust motes and fireflies at dusk/night
      return {
        primaryKind: "dust",
        secondaryKind: isDuskOrNight ? "fireflies" : "none",
        primaryCount: 45,
        secondaryCount: isDuskOrNight ? 30 : 0,
      };
    case 2: // Autumn: blowing leaves + low fog band
      return { primaryKind: "leaves", secondaryKind: "fog", primaryCount: 50, secondaryCount: 16 };
    case 3: // Winter: snow flakes (1 to 2 px, slow, sway)
      return { primaryKind: "snow", secondaryKind: "none", primaryCount: 75, secondaryCount: 0 };
    default:
      return { primaryKind: "rain", secondaryKind: "none", primaryCount: 40, secondaryCount: 0 };
  }
}

/**
 * Computes deterministic particle counts per season.
 * Yields strictly 0 under reduced motion.
 */
export function getWeatherParticleCounts(
  season: number,
  allowMotion = true,
  timeOfDayT = 0.3
): { total: number; primary: number; secondary: number } {
  if (!allowMotion) {
    return { total: 0, primary: 0, secondary: 0 };
  }
  const spec = getSeasonWeatherSpec(season, timeOfDayT);
  const primary = spec.primaryCount;
  const secondary = spec.secondaryCount;
  const total = Math.min(MAX_WEATHER_PARTICLES, primary + secondary);
  return { total, primary, secondary };
}

/**
 * Evaluates smooth cross-fade blend factors across 2.0s duration.
 */
export function computeCrossFadeAlpha(
  fadeTimer: number,
  fadeDuration = CROSSFADE_DURATION_SEC
): { fadeOutAlpha: number; fadeInAlpha: number } {
  const clamped = Math.max(0, Math.min(fadeDuration, fadeTimer));
  const t = fadeDuration > 0 ? clamped / fadeDuration : 1.0;
  return {
    fadeOutAlpha: 1.0 - t,
    fadeInAlpha: t,
  };
}

/**
 * Culls a particle against viewport bounds with margin.
 */
export function isWeatherParticleInView(
  x: number,
  y: number,
  bounds: Bounds2D,
  margin = 48
): boolean {
  return (
    x >= bounds.minX - margin &&
    x <= bounds.maxX + margin &&
    y >= bounds.minY - margin &&
    y <= bounds.maxY + margin
  );
}
