/**
 * Pure pixel-art helpers for trees, props, and road/bridge tiles:
 * hue-shifted 5-6 step ramps, selective dark outlines, 4x4 Bayer dithering,
 * seeded variant choice via createRng, road mask-to-edges mapping, and pixel buffer blitting.
 * Deterministic: zero Math.random or Date.
 */

import type { Graphics } from "pixi.js";
import { createRng } from "./rng.ts";
import { relativeLuminance } from "./theme.ts";

export type CardinalEdge = "N" | "E" | "S" | "W";

export interface EdgeSegment {
  edge: CardinalEdge;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  lit: boolean;
}

export interface RoadEdgeSet {
  mask: number;
  connected: {
    N: boolean;
    E: boolean;
    S: boolean;
    W: boolean;
  };
  openEdges: CardinalEdge[];
  kerbEdges: CardinalEdge[];
  litKerbEdges: CardinalEdge[];
  shadedKerbEdges: CardinalEdge[];
  segments: Record<CardinalEdge, EdgeSegment>;
}

const BAYER_4X4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5] as const;

function hexToRgb(hex: number): [number, number, number] {
  return [(hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff];
}

function rgbToHex(r: number, g: number, b: number): number {
  return (
    (Math.max(0, Math.min(255, Math.round(r))) << 16) |
    (Math.max(0, Math.min(255, Math.round(g))) << 8) |
    Math.max(0, Math.min(255, Math.round(b)))
  );
}

function rgbToHsl(r0: number, g0: number, b0: number): [number, number, number] {
  const r = r0 / 255, g = g0 / 255, b = b0 / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (mx + mn) / 2, d = mx - mn;
  if (d > 0) {
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return [h, s, l];
}

function hslToRgb(h0: number, s0: number, l0: number): [number, number, number] {
  const h = ((h0 % 360) + 360) % 360;
  const s = Math.max(0, Math.min(1, s0)), l = Math.max(0, Math.min(1, l0));
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t0: number): number => {
    let t = t0;
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [channel(h / 360 + 1 / 3) * 255, channel(h / 360) * 255, channel(h / 360 - 1 / 3) * 255];
}

/**
 * Shifts a hex color in HSL space.
 */
export function shiftHslHex(hex: number, dh: number, ds: number, dl: number): number {
  const [r, g, b] = hexToRgb(hex);
  const [h, s, l] = rgbToHsl(r, g, b);
  const [nr, ng, nb] = hslToRgb(h + dh, s + ds, l + dl);
  return rgbToHex(nr, ng, nb);
}

/**
 * Builds a 5 or 6 step hue-shifted pixel-art ramp from darkest cool shadow (index 0)
 * to brightest warm highlight (index steps-1). Strictly monotonic in relative luminance.
 */
export function buildHueRamp(baseHex: number, steps: 5 | 6 = 6): number[] {
  const [r, g, b] = hexToRgb(baseHex);
  const [baseH, baseS, baseL] = rgbToHsl(r, g, b);
  const minL = Math.max(0.11, Math.min(0.28, baseL - 0.24));
  const maxL = Math.min(0.88, Math.max(0.62, baseL + 0.26));

  const out: number[] = [];
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1); // 0 = deepest shadow, 1 = brightest highlight
    // Cool shift in shadow (+18 deg toward blue/teal), warm shift in light (-18 deg toward yellow/sun)
    const dh = (0.48 - t) * 32;
    const ds = (t - 0.5) * -0.05;
    const targetL = minL + (maxL - minL) * t;
    const [cr, cg, cb] = hslToRgb(baseH + dh, Math.max(0.08, baseS + ds), targetL);
    let candidate = rgbToHex(cr, cg, cb);

    if (i > 0) {
      let guard = 0;
      while (relativeLuminance(candidate) <= relativeLuminance(out[i - 1]) && guard < 32) {
        const [pr, pg, pb] = hexToRgb(candidate);
        candidate = rgbToHex(pr + 4, pg + 4, pb + 4);
        guard++;
      }
    }
    out.push(candidate);
  }
  return out;
}

/**
 * Computes a selective dark outline color (cool-shifted darker shade of the fill, never pure black).
 */
export function propOutlineColor(hex: number): number {
  const [r, g, b] = hexToRgb(hex);
  const [h, s, l] = rgbToHsl(r, g, b);
  const targetL = Math.max(0.06, Math.min(l * 0.45, l - 0.12));
  const [nr, ng, nb] = hslToRgb(h + 14, Math.min(0.85, s + 0.06), targetL);
  let out = rgbToHex(nr, ng, nb);
  if (out === 0x000000) out = 0x0b0d12;
  if (relativeLuminance(out) >= relativeLuminance(hex)) {
    out = rgbToHex(Math.max(8, r * 0.45), Math.max(8, g * 0.45), Math.max(10, b * 0.48));
  }
  return out;
}

/**
 * Ordered 4x4 Bayer dithering step index in [0..steps-1].
 */
export function ditherStep(
  val: number,
  steps: number,
  px: number,
  py: number,
  spread = 0.48
): number {
  const bayer = BAYER_4X4[((px & 3) + ((py & 3) << 2)) & 15] / 16 - 0.5;
  const idx = Math.floor(val * (steps - 1) + bayer * spread + 0.5);
  return Math.max(0, Math.min(steps - 1, idx));
}

/**
 * Deterministic coordinate hash in [0, 1).
 */
export function coordHash(x: number, y: number, salt = 0): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(salt | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * Picks a deterministic variant from `options` using `createRng(seedKey)`.
 */
export function pickSeededVariant<T>(seedKey: string | number, options: readonly T[]): T {
  if (options.length === 0) {
    throw new Error("pickSeededVariant requires at least one option");
  }
  const rng = createRng(seedKey);
  const idx = rng.nextInt(0, options.length - 1);
  return options[idx];
}

/**
 * Maps treeType + arcId + season deterministically to one of the 3 arc tree variants (0, 1, 2).
 */
export function pickTreeVariant(treeType: number, arcId: string, season: number): 0 | 1 | 2 {
  if (Number.isFinite(treeType) && treeType >= 0) {
    return (((Math.floor(treeType) % 3) + 3) % 3) as 0 | 1 | 2;
  }
  const rng = createRng(`tree_${arcId}_${season}_${treeType}`);
  return rng.nextInt(0, 2) as 0 | 1 | 2;
}

/**
 * Converts a 4-bit road connection mask (1=N, 2=E, 4=S, 8=W) into connected/unconnected
 * edge sets and lit/shaded kerb classifications for a 64x32 isometric diamond.
 */
export function maskToRoadEdges(roadMask: number): RoadEdgeSet {
  const m = roadMask & 15;
  const connected = {
    N: (m & 1) !== 0,
    E: (m & 2) !== 0,
    S: (m & 4) !== 0,
    W: (m & 8) !== 0,
  };

  const order: CardinalEdge[] = ["N", "E", "S", "W"];
  const openEdges: CardinalEdge[] = [];
  const kerbEdges: CardinalEdge[] = [];
  const litKerbEdges: CardinalEdge[] = [];
  const shadedKerbEdges: CardinalEdge[] = [];

  for (const edge of order) {
    if (connected[edge]) {
      openEdges.push(edge);
    } else {
      kerbEdges.push(edge);
      if (edge === "N" || edge === "W") litKerbEdges.push(edge);
      else shadedKerbEdges.push(edge);
    }
  }

  const segments: Record<CardinalEdge, EdgeSegment> = {
    N: { edge: "N", x0: 0, y0: -16, x1: 32, y1: 0, lit: true },
    E: { edge: "E", x0: 32, y0: 0, x1: 0, y1: 16, lit: false },
    S: { edge: "S", x0: 0, y0: 16, x1: -32, y1: 0, lit: false },
    W: { edge: "W", x0: -32, y0: 0, x1: 0, y1: -16, lit: true },
  };

  return { mask: m, connected, openEdges, kerbEdges, litKerbEdges, shadedKerbEdges, segments };
}

/**
 * Checks whether a 24-bit hex colour lies in the purple/magenta hue band.
 */
export function isPurpleHue(hex: number): boolean {
  const [r, g, b] = hexToRgb(hex);
  const [h, s, l] = rgbToHsl(r, g, b);
  return h >= 250 && h <= 325 && s > 0.16 && l > 0.08 && l < 0.92;
}

export interface PixelSurface {
  width: number;
  height: number;
  anchorX: number;
  anchorY: number;
  rgba: Uint8ClampedArray;
}

export function createPixelSurface(
  width: number,
  height: number,
  anchorX: number,
  anchorY: number
): PixelSurface {
  return { width, height, anchorX, anchorY, rgba: new Uint8ClampedArray(width * height * 4) };
}

export function setPx(surf: PixelSurface, gx: number, gy: number, hex: number, alpha = 1): void {
  const px = Math.round(gx + surf.anchorX), py = Math.round(gy + surf.anchorY);
  if (px < 0 || py < 0 || px >= surf.width || py >= surf.height) return;
  const idx = (py * surf.width + px) * 4;
  surf.rgba[idx] = (hex >> 16) & 0xff;
  surf.rgba[idx + 1] = (hex >> 8) & 0xff;
  surf.rgba[idx + 2] = hex & 0xff;
  surf.rgba[idx + 3] = Math.max(0, Math.min(255, Math.round(alpha * 255)));
}

/**
 * Bakes a soft blue-tinted ground shadow ellipse (default alpha ~0.25) around (cx, cy).
 */
export function drawSoftShadow(
  surf: PixelSurface,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  alpha = 0.25
): number {
  const shadowColor = 0x162238; // Soft blue-tinted shadow, never pure black
  let count = 0;
  const minX = Math.floor(cx - rx - 1);
  const maxX = Math.ceil(cx + rx + 1);
  const minY = Math.floor(cy - ry - 1);
  const maxY = Math.ceil(cy + ry + 1);
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dx = (x - cx) / Math.max(1, rx);
      const dy = (y - cy) / Math.max(1, ry);
      const d2 = dx * dx + dy * dy;
      if (d2 <= 0.78) {
        setPx(surf, x, y, shadowColor, alpha);
        count++;
      } else if (d2 <= 1.05 && ((x + y) & 1) === 0) {
        setPx(surf, x, y, shadowColor, alpha * 0.65);
        count++;
      }
    }
  }
  return count;
}

/**
 * Renders a PixelSurface into a PixiJS Graphics instance using horizontal 1px scanline spans,
 * preserving exact texture dimensions and anchor coordinates.
 */
export function drawSurfaceToGraphics(g: Graphics, surf: PixelSurface): void {
  // Corner bounds anchors ensure generateTexture crops to exact [width x height]
  g.rect(-surf.anchorX, -surf.anchorY, 1, 1).fill({ color: 0x000000, alpha: 0.004 });
  g.rect(surf.width - surf.anchorX - 1, surf.height - surf.anchorY - 1, 1, 1).fill({
    color: 0x000000,
    alpha: 0.004,
  });

  const { width, height, anchorX, anchorY, rgba } = surf;
  for (let py = 0; py < height; py++) {
    let px = 0;
    while (px < width) {
      const i = (py * width + px) * 4;
      const a = rgba[i + 3];
      if (a === 0) {
        px++;
        continue;
      }
      const r = rgba[i];
      const gr = rgba[i + 1];
      const b = rgba[i + 2];
      let run = 1;
      while (px + run < width) {
        const j = (py * width + (px + run)) * 4;
        if (rgba[j + 3] !== a || rgba[j] !== r || rgba[j + 1] !== gr || rgba[j + 2] !== b) {
          break;
        }
        run++;
      }
      const color = (r << 16) | (gr << 8) | b;
      g.rect(px - anchorX, py - anchorY, run, 1).fill({
        color,
        alpha: +(a / 255).toFixed(3),
      });
      px += run;
    }
  }
}

export function computeSilhouetteHash(rgba: Uint8ClampedArray): number {
  let h = 2166136261;
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3] > 0) {
      h ^= i ^ rgba[i] ^ (rgba[i + 1] << 8) ^ (rgba[i + 2] << 16);
      h = Math.imul(h, 16777619);
    }
  }
  return h >>> 0;
}
