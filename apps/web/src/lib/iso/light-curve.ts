/**
 * Pure day/night light curve calculations for the isometric city.
 * Defines a 120s real-time continuous circadian clock, full-scene colour grades,
 * and additive light pool intensities.
 * Strictly pure helper — zero sim mutation imports, fully deterministic.
 */

import { isoToScreen } from "./iso-math.ts";

export const DAY_DURATION_SEC = 120;
export const REDUCED_MOTION_T = 0.3; // Midday: fixed warm dusk-free daytime
export const MAX_LIGHT_POOLS = 40;

export interface LightPoolOrigin {
  x: number;
  y: number;
  kind: "forge" | "building" | "house" | "plaza";
  radius?: number;
}

export interface Bounds2D {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export type DayPhase = "dawn" | "day" | "dusk" | "night";

interface LightKeyframe {
  t: number;
  r: number;
  g: number;
  b: number;
}

// Circadian light keyframes across [0.0, 1.0]
// Dawn (warm pink), Day (neutral), Dusk (orange), Night (cool blue >= 55% brightness)
const LIGHT_KEYFRAMES: LightKeyframe[] = [
  { t: 0.0, r: 0.96, g: 0.78, b: 0.82 }, // Early dawn (soft pink)
  { t: 0.06, r: 1.0, g: 0.88, b: 0.84 }, // Golden dawn
  { t: 0.15, r: 1.0, g: 0.98, b: 0.95 }, // Mid morning
  { t: 0.3, r: 1.0, g: 1.0, b: 1.0 }, // Midday (neutral)
  { t: 0.48, r: 1.0, g: 0.95, b: 0.88 }, // Late afternoon
  { t: 0.58, r: 1.0, g: 0.72, b: 0.44 }, // Dusk golden hour (warm orange)
  { t: 0.68, r: 0.72, g: 0.62, b: 0.72 }, // Twilight
  { t: 0.8, r: 0.55, g: 0.62, b: 0.86 }, // Midnight (cool blue, >= 55% floor)
  { t: 0.92, r: 0.62, g: 0.66, b: 0.85 }, // Late night
  { t: 1.0, r: 0.96, g: 0.78, b: 0.82 }, // Wrap continuous to 0.0
];

/**
 * Standard smooth hermite interpolation (smoothstep)
 */
function smoothstep(min: number, max: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - min) / (max - min)));
  return t * t * (3 - 2 * t);
}

/**
 * Normalizes any timestamp or cycle float into [0, 1).
 */
export function normalizeTime(t: number): number {
  return ((t % 1) + 1) % 1;
}

/**
 * Evaluates the light curve at normalized time t in [0, 1].
 * Yields continuous RGB multipliers with smooth interpolation between keyframes.
 */
export function evaluateLightCurve(t: number): RgbColor {
  const normT = t === 1.0 ? 1.0 : normalizeTime(t);

  // Find surrounding keyframes
  let prev = LIGHT_KEYFRAMES[0];
  let next = LIGHT_KEYFRAMES[LIGHT_KEYFRAMES.length - 1];

  for (let i = 0; i < LIGHT_KEYFRAMES.length - 1; i++) {
    if (normT >= LIGHT_KEYFRAMES[i].t && normT <= LIGHT_KEYFRAMES[i + 1].t) {
      prev = LIGHT_KEYFRAMES[i];
      next = LIGHT_KEYFRAMES[i + 1];
      break;
    }
  }

  const span = next.t - prev.t;
  const factor = span > 0 ? smoothstep(0, 1, (normT - prev.t) / span) : 0;

  return {
    r: prev.r + (next.r - prev.r) * factor,
    g: prev.g + (next.g - prev.g) * factor,
    b: prev.b + (next.b - prev.b) * factor,
  };
}

/**
 * Computes perceived brightness / relative luminance from RGB channels.
 * Guarantees never below ~0.55.
 */
export function getLightBrightness(rgb: RgbColor): number {
  return 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
}

/**
 * Returns current phase name based on normalized day time.
 */
export function getPhaseName(t: number): DayPhase {
  const norm = normalizeTime(t);
  if (norm < 0.12) return "dawn";
  if (norm < 0.5) return "day";
  if (norm < 0.68) return "dusk";
  return "night";
}

/**
 * Computes intensity of warm window / lamppost light pools [0.0, 1.0].
 * Fades in at dusk, stays full during night, fades out at dawn.
 */
export function getLightPoolIntensity(t: number): number {
  const norm = normalizeTime(t);

  // Dusk: fade in from 0 to 1 between t = 0.50 and t = 0.68
  if (norm >= 0.5 && norm < 0.68) {
    return smoothstep(0.5, 0.68, norm);
  }

  // Night: full intensity from 0.68 to 0.92
  if (norm >= 0.68 && norm < 0.92) {
    return 1.0;
  }

  // Dawn fade out: from 0.92 to 1.0 and 0.0 to 0.12
  if (norm >= 0.92) {
    // 0.92 -> 1.0 is first half of fade out (1.0 -> 0.4)
    const factor = (norm - 0.92) / (1.12 - 0.92);
    return 1.0 - smoothstep(0, 1, factor);
  }
  if (norm < 0.12) {
    // 0.0 -> 0.12 is second half of fade out
    const factor = (norm + 0.08) / (0.12 + 0.08);
    return 1.0 - smoothstep(0, 1, factor);
  }

  // Day (0.12 to 0.50): off
  return 0.0;
}

/**
 * Multiplies two 24-bit RGB tints channel-wise.
 */
export function blendTints(baseTint: number, gradeTint: number): number {
  const br = (baseTint >> 16) & 0xff;
  const bg = (baseTint >> 8) & 0xff;
  const bb = baseTint & 0xff;

  const gr = (gradeTint >> 16) & 0xff;
  const gg = (gradeTint >> 8) & 0xff;
  const gb = gradeTint & 0xff;

  const r = Math.min(255, Math.max(0, Math.round((br * gr) / 255)));
  const g = Math.min(255, Math.max(0, Math.round((bg * gg) / 255)));
  const b = Math.min(255, Math.max(0, Math.round((bb * gb) / 255)));

  return (r << 16) | (g << 8) | b;
}

/**
 * Converts normalized light curve time to 24-bit hex tint, optionally blended with base.
 */
export function getLightTint(t: number, baseTint?: number): number {
  const rgb = evaluateLightCurve(t);
  const r = Math.min(255, Math.max(0, Math.round(rgb.r * 255)));
  const g = Math.min(255, Math.max(0, Math.round(rgb.g * 255)));
  const b = Math.min(255, Math.max(0, Math.round(rgb.b * 255)));
  const lightHex = (r << 16) | (g << 8) | b;

  if (baseTint !== undefined) {
    return blendTints(baseTint, lightHex);
  }
  return lightHex;
}

/**
 * Updates circadian clock time based on elapsed delta seconds.
 * Freezes when paused (e.g. document hidden), and locks to midday on reduced motion.
 */
export function updateClock(
  currentT: number,
  dt: number,
  paused = false,
  reducedMotion = false
): number {
  if (reducedMotion) return REDUCED_MOTION_T;
  if (paused) return currentT;
  return normalizeTime(currentT + dt / DAY_DURATION_SEC);
}

/**
 * Deterministically locates warm light pool origins from city layout features.
 * Caps strictly at MAX_LIGHT_POOLS (40) with priority given to plaza, forges, and windows.
 */
export function findLightPoolOrigins(
  layout: {
    buildings?: Array<{ tileX: number; tileY: number; open?: boolean; ruined?: boolean; sectorIdx?: number }>;
    houses?: Array<{ tileX: number; tileY: number; level?: number }>;
    plaza?: { x: number; y: number } | null;
    sectors?: Array<{ idx: number; kind: string }>;
  },
  maxPools = MAX_LIGHT_POOLS
): LightPoolOrigin[] {
  const pools: LightPoolOrigin[] = [];

  // 1. Central Plaza lantern / campfire
  if (layout.plaza) {
    const scr = isoToScreen(layout.plaza.x, layout.plaza.y);
    pools.push({ x: scr.x, y: scr.y - 12, kind: "plaza", radius: 36 });
  }

  // 2. Open sector buildings (forge mouths, alchemy lanterns, workshops)
  for (const b of layout.buildings ?? []) {
    if (pools.length >= maxPools) break;
    const sec = layout.sectors?.find((s) => s.idx === b.sectorIdx);
    const kind = sec?.kind ?? "building";
    const scr = isoToScreen(b.tileX, b.tileY);
    const isForge = kind === "forge" || kind === "ore";
    pools.push({
      x: scr.x + (isForge ? 8 : 0),
      y: scr.y - (isForge ? 18 : 22),
      kind: isForge ? "forge" : "building",
      radius: isForge ? 32 : 26,
    });
  }

  // 3. Residential cottages with lit windows
  for (let i = 0; i < (layout.houses ?? []).length; i++) {
    if (pools.length >= maxPools) break;
    const h = layout.houses![i];
    const scr = isoToScreen(h.tileX, h.tileY);
    pools.push({
      x: scr.x + 4,
      y: scr.y - 14,
      kind: "house",
      radius: 20,
    });
  }

  return pools.slice(0, maxPools);
}

/**
 * Culls light pools against viewport bounds with margin.
 */
export function cullLightPools(
  pools: Array<{ x: number; y: number }>,
  bounds: Bounds2D,
  margin = 64
): boolean[] {
  return pools.map(
    (p) =>
      p.x >= bounds.minX - margin &&
      p.x <= bounds.maxX + margin &&
      p.y >= bounds.minY - margin &&
      p.y <= bounds.maxY + margin
  );
}
