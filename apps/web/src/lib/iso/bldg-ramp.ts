/**
 * Pure color ramps, ordered Bayer dithering (<= 3 bands), selective 1px dark outlines,
 * seeded variant helpers, and 2:1 pixel-art isometric raster primitives for buildings.
 * Deterministic: zero Math.random or Date calls.
 */

import { relativeLuminance } from "./theme.ts";
import { createRng, type PRNG } from "./rng.ts";

export type RGB = [number, number, number];

export function toRgb(hex: number): RGB {
  return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
}

export function fromRgb(r: number, g: number, b: number): number {
  const rc = Math.max(0, Math.min(255, Math.round(r)));
  const gc = Math.max(0, Math.min(255, Math.round(g)));
  const bc = Math.max(0, Math.min(255, Math.round(b)));
  return (rc << 16) | (gc << 8) | bc;
}

export function hslShift(c: RGB, dh: number, ds: number, dl: number): RGB {
  const r = c[0] / 255;
  const g = c[1] / 255;
  const b = c[2] / 255;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (mx + mn) / 2;
  const d = mx - mn;
  if (d > 0) {
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  h = (h + dh + 360) % 360;
  s = Math.max(0, Math.min(1, s + ds));
  const ll = Math.max(0.04, Math.min(0.96, l + dl));
  const q = ll < 0.5 ? ll * (1 + s) : ll + s - ll * s;
  const p = 2 * ll - q;
  const f = (t0: number) => {
    let t = t0;
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [f(h / 360 + 1 / 3) * 255, f(h / 360) * 255, f(h / 360 - 1 / 3) * 255];
}

/**
 * Generates a 5 or 6 step hue-shifted ramp: cool shadows, warm lights, strictly monotonic luminance.
 */
export function materialRamp(baseHex: number, steps: 5 | 6 = 6, ruined = false): number[] {
  let base = toRgb(baseHex);
  if (ruined) {
    base = hslShift(base, -10, -0.34, -0.07);
  }
  const out: number[] = [];
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const dh = (t - 0.45) * -26;
    const ds = ruined ? -0.08 : (t - 0.5) * -0.06;
    const dl = (t - 0.45) * 0.46;
    let rgb = hslShift(base, dh, ds, dl);
    let hex = fromRgb(rgb[0], rgb[1], rgb[2]);
    if (i > 0) {
      let guard = 0;
      while (relativeLuminance(hex) <= relativeLuminance(out[i - 1]) && guard < 32) {
        rgb = [Math.min(255, rgb[0] + 4), Math.min(255, rgb[1] + 4), Math.min(255, rgb[2] + 4)];
        hex = fromRgb(rgb[0], rgb[1], rgb[2]);
        guard++;
      }
    }
    out.push(hex);
  }
  return out;
}

/**
 * 1px selective dark outline darker than local colour and shifted cool (never pure black 0x000000).
 */
export function selectiveOutline(hex: number): number {
  const rgb = toRgb(hex);
  const shifted = hslShift(rgb, 14, -0.04, -0.22);
  const r = Math.max(12, Math.min(220, Math.round(shifted[0] * 0.58)));
  const g = Math.max(10, Math.min(220, Math.round(shifted[1] * 0.56)));
  const b = Math.max(14, Math.min(225, Math.round(shifted[2] * 0.64)));
  const out = fromRgb(r, g, b);
  if (relativeLuminance(out) >= relativeLuminance(hex)) {
    return fromRgb(Math.max(8, (hex >> 17) & 127), Math.max(8, (hex >> 9) & 127), Math.max(10, (hex >> 1) & 127));
  }
  return out;
}

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/**
 * Ordered 4x4 Bayer dithering capped at at most 3 adjacent ramp bands for any tone value.
 */
export function ditherBand(val: number, steps: number, px: number, py: number): number {
  const clamped = Math.max(0, Math.min(1, val));
  const center = Math.max(0, Math.min(steps - 1, Math.round(clamped * (steps - 1))));
  const bayer = BAYER4[((px & 3) + ((py & 3) << 2)) & 15] / 16 - 0.5;
  const raw = Math.round(clamped * (steps - 1) + bayer * 0.85);
  const minBand = Math.max(0, center - 1);
  const maxBand = Math.min(steps - 1, center + 1);
  return Math.max(minBand, Math.min(maxBand, raw));
}

export function createBldgRng(arcId: string, level: number, variant: number, salt = ""): PRNG {
  return createRng(`${arcId}|l${level}|v${variant}|${salt}`);
}

export function pickVariantChoice<T>(
  arcId: string,
  level: number,
  variant: number,
  salt: string,
  options: readonly T[]
): T {
  const rng = createBldgRng(arcId, level, variant, salt);
  return options[rng.nextInt(0, options.length - 1)];
}

export interface BldgMaterials {
  wall: number[];
  roof: number[];
  roofAlt: number[];
  wood: number[];
  bone: number[];
  stone: number[];
  copper: number[];
  foliage: number[];
  snow: number[];
  windowLit: [number, number, number];
  windowDark: number;
  accent: number;
  hasSnow: boolean;
}

const ARC_MAT_BASE: Record<
  string,
  { wall: number; roof: number; roofAlt: number; wood: number; stone: number; copper: number; foliage: number; accent: number }
> = {
  goblin_warrens: {
    wall: 0x7d6852,
    roof: 0x724458,
    roofAlt: 0x66533e,
    wood: 0x5c4430,
    stone: 0x6a6672,
    copper: 0x986a3c,
    foliage: 0x4d7538,
    accent: 0xe09f28,
  },
  cave_hold: {
    wall: 0x6b7886,
    roof: 0x48586a,
    roofAlt: 0x586674,
    wood: 0x564334,
    stone: 0x5c6672,
    copper: 0xa86434,
    foliage: 0x5d7252,
    accent: 0xe86e2c,
  },
  dino_vale: {
    wall: 0x947a56,
    roof: 0x9e7c44,
    roofAlt: 0x8a563c,
    wood: 0x6a5038,
    stone: 0x80796a,
    copper: 0x9a6c3c,
    foliage: 0x588438,
    accent: 0xcc5238,
  },
  elf_grove: {
    wall: 0x8c7d66,
    roof: 0x48764e,
    roofAlt: 0x3e6c64,
    wood: 0x624c38,
    stone: 0x84928c,
    copper: 0xb48c3e,
    foliage: 0x528e50,
    accent: 0xd86e96,
  },
};

export function getArcMaterials(arcId: string, season = 0, ruined = false): BldgMaterials {
  const cfg = ARC_MAT_BASE[arcId] ?? ARC_MAT_BASE.goblin_warrens;
  const sIdx = ((Math.floor(season) % 4) + 4) % 4;
  const isAutumn = sIdx === 2;
  const isWinter = sIdx === 3;
  const hasSnow = !ruined && isWinter && arcId !== "dino_vale";

  const roofHex =
    arcId === "elf_grove" && isAutumn
      ? 0xa8702c
      : isAutumn
        ? fromRgb(...hslShift(toRgb(cfg.roof), -14, 0, -0.02))
        : cfg.roof;
  const foliageHex =
    arcId === "elf_grove" && sIdx === 0
      ? 0xc8648c
      : isAutumn
        ? 0xb87828
        : cfg.foliage;

  return {
    wall: materialRamp(cfg.wall, 6, ruined),
    roof: materialRamp(roofHex, 6, ruined),
    roofAlt: materialRamp(cfg.roofAlt, 6, ruined),
    wood: materialRamp(cfg.wood, 6, ruined),
    bone: materialRamp(0xc2b69e, 5, ruined),
    stone: materialRamp(cfg.stone, 6, ruined),
    copper: materialRamp(cfg.copper, 5, ruined),
    foliage: materialRamp(foliageHex, 5, ruined),
    snow: materialRamp(0xdce6ee, 5, false),
    windowLit: ruined ? [0x26201c, 0x302822, 0x38302a] : [0xb45309, 0xf59e0b, 0xfde68a],
    windowDark: 0x241e22,
    accent: ruined ? 0x5a524c : cfg.accent,
    hasSnow,
  };
}

export interface PixelGrid {
  width: number;
  height: number;
  refX: number;
  refY: number;
  rgba: Uint8ClampedArray;
  group: Uint8Array;
  opaqueCount: number;
  litWindowPixels: number;
  hasCastShadow: boolean;
  hasChimney: boolean;
  hasGardenOrFence: boolean;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  silhouetteHash: number;
}

export function createPixelGrid(width: number, height: number): PixelGrid {
  return {
    width,
    height,
    refX: Math.round(width * 0.5),
    refY: Math.round(height * 0.85),
    rgba: new Uint8ClampedArray(width * height * 4),
    group: new Uint8Array(width * height),
    opaqueCount: 0,
    litWindowPixels: 0,
    hasCastShadow: false,
    hasChimney: false,
    hasGardenOrFence: false,
    bounds: { minX: width, maxX: 0, minY: height, maxY: 0 },
    silhouetteHash: 0,
  };
}

export function setPx(
  grid: PixelGrid,
  dx: number,
  dy: number,
  hex: number,
  groupId = 1,
  alpha = 255
): void {
  const x = grid.refX + Math.round(dx);
  const y = grid.refY + Math.round(dy);
  if (x < 0 || x >= grid.width || y < 0 || y >= grid.height) return;
  const idx = y * grid.width + x;
  const o = idx * 4;
  const r = (hex >> 16) & 255;
  const g = (hex >> 8) & 255;
  const b = hex & 255;
  if (alpha >= 255 || grid.rgba[o + 3] === 0) {
    grid.rgba[o] = r;
    grid.rgba[o + 1] = g;
    grid.rgba[o + 2] = b;
    grid.rgba[o + 3] = alpha;
  } else {
    const a = alpha / 255;
    grid.rgba[o] = Math.round(grid.rgba[o] * (1 - a) + r * a);
    grid.rgba[o + 1] = Math.round(grid.rgba[o + 1] * (1 - a) + g * a);
    grid.rgba[o + 2] = Math.round(grid.rgba[o + 2] * (1 - a) + b * a);
    grid.rgba[o + 3] = Math.min(255, grid.rgba[o + 3] + alpha);
  }
  if (groupId > 0) grid.group[idx] = groupId;
  if (groupId === 9) grid.litWindowPixels++;
}

export function fillRectPx(
  grid: PixelGrid,
  dx0: number,
  dy0: number,
  w: number,
  h: number,
  hex: number,
  groupId = 1
): void {
  for (let iy = 0; iy < h; iy++) {
    for (let ix = 0; ix < w; ix++) {
      setPx(grid, dx0 + ix, dy0 + iy, hex, groupId);
    }
  }
}

/**
 * Soft dark blue-tinted cast shadow ellipse baked at the base (alpha ~0.25, no longer than a tile).
 */
export function drawCastShadow(grid: PixelGrid, rx: number, ry: number, alpha = 0.25): void {
  const clampedRx = Math.min(31, Math.max(8, Math.round(rx)));
  const clampedRy = Math.min(15, Math.max(4, Math.round(ry)));
  const shadowHex = 0x121c34;
  for (let dy = -clampedRy; dy <= clampedRy; dy++) {
    for (let dx = -clampedRx; dx <= clampedRx; dx++) {
      const d2 = (dx * dx) / (clampedRx * clampedRx) + (dy * dy) / (clampedRy * clampedRy);
      if (d2 <= 1.0) {
        const falloff = d2 > 0.65 ? (1.0 - d2) / 0.35 : 1.0;
        const a = Math.round(255 * alpha * falloff);
        if (a > 8) setPx(grid, dx + 2, dy + 2, shadowHex, 0, a);
      }
    }
  }
  grid.hasCastShadow = true;
}

/**
 * Draws a 2:1 isometric cuboid base with lit left wall, shaded right wall, stone foundation, and AO.
 */
export function drawIsoCuboid(
  grid: PixelGrid,
  wL: number,
  wR: number,
  wallH: number,
  wallRamp: number[],
  stoneRamp: number[],
  woodRamp: number[],
  opts: { ox?: number; oy?: number; foundationH?: number; timberFrame?: boolean; ruined?: boolean } = {}
): void {
  const ox = opts.ox ?? 0;
  const oy = opts.oy ?? 0;
  const fH = opts.foundationH ?? 3;

  for (let dx = -wL; dx <= wR; dx++) {
    const isLeft = dx < 0;
    const dist = Math.abs(dx);
    const baseY = oy + Math.floor((isLeft ? wL - dist : wR - dist) / 2);
    const topY = baseY - wallH;
    const isCorner = dx === -wL || dx === wR || dx === 0;

    for (let y = topY; y <= baseY; y++) {
      const hFromBot = baseY - y;
      const hFromTop = y - topY;
      let col: number;

      if (opts.ruined && hFromTop < 3 + ((dist * 3) % 5) && dist > 3 && dist < Math.max(wL, wR) - 3) {
        continue;
      }
      if (hFromBot < fH) {
        const tone = isLeft ? 0.55 : 0.28;
        col = stoneRamp[ditherBand(tone, stoneRamp.length, dx + 64, y + 64)];
      } else if (opts.timberFrame && (isCorner || hFromTop <= 1 || hFromBot === fH)) {
        col = woodRamp[isLeft ? 3 : 1];
      } else {
        let tone = isLeft ? 0.68 : 0.32;
        if (hFromTop <= 1) tone -= 0.14;
        if (hFromBot === fH) tone -= 0.08;
        const brickMod = ((y & 3) === 0 || ((dx + (y >> 2) * 3) & 5) === 0) ? -0.05 : 0.03;
        col = wallRamp[ditherBand(tone + brickMod, wallRamp.length, dx + 64, y + 64)];
      }

      if (y === baseY || y === topY || dx === -wL || dx === wR) {
        col = selectiveOutline(col);
      }
      setPx(grid, ox + dx, y, col, isLeft ? 2 : 3);
    }
  }
}

/**
 * Draws a 2:1 isometric gabled roof with shingle rows, dithering (<= 3 bands), and selective outline.
 */
export function drawGableRoof(
  grid: PixelGrid,
  wL: number,
  wR: number,
  wallH: number,
  ridgeH: number,
  roofRamp: number[],
  opts: {
    ox?: number;
    oy?: number;
    hasSnow?: boolean;
    snowRamp?: number[];
    patchedRamp?: number[];
    ruined?: boolean;
  } = {}
): void {
  const ox = opts.ox ?? 0;
  const oy = opts.oy ?? 0;
  const eaveL = wL + 2;
  const eaveR = wR + 2;

  for (let dx = -eaveL; dx <= eaveR; dx++) {
    const isLeft = dx <= 0;
    const u = isLeft ? Math.abs(dx) / Math.max(1, eaveL) : dx / Math.max(1, eaveR);
    const eaveY = oy - wallH + Math.floor((isLeft ? eaveL - Math.abs(dx) : eaveR - dx) / 2) + 1;
    const slopeTopY = oy - wallH - ridgeH + Math.floor((isLeft ? Math.abs(dx) : dx) / 2);
    const span = Math.max(1, eaveY - slopeTopY);

    for (let y = slopeTopY; y <= eaveY; y++) {
      if (opts.ruined && Math.abs(dx) > 3 && Math.abs(dx) < eaveL - 4 && y < slopeTopY + 5 && ((dx + y) & 3) !== 0) {
        if (y === slopeTopY + 4) setPx(grid, ox + dx, y, 0x1c1614, 4);
        continue;
      }
      const v = (y - slopeTopY) / span;
      const shingleRow = (y - slopeTopY) % 3 === 0 ? -0.09 : 0.04;
      let tone = (isLeft ? 0.72 : 0.36) + (1 - v) * 0.12 + shingleRow;
      let activeRamp = roofRamp;
      if (opts.patchedRamp && ((dx >> 2) + (y >> 2)) % 5 === 0) {
        activeRamp = opts.patchedRamp;
      }
      if (opts.hasSnow && opts.snowRamp && v < 0.65) {
        activeRamp = opts.snowRamp;
        tone = (isLeft ? 0.78 : 0.48) + shingleRow;
      }
      let col = activeRamp[ditherBand(tone, activeRamp.length, dx + 64, y + 64)];
      if (y === slopeTopY || y === eaveY || dx === -eaveL || dx === eaveR || (dx === 0 && u < 0.1)) {
        col = selectiveOutline(col);
      }
      setPx(grid, ox + dx, y, col, 4);
    }
  }
}

/**
 * Draws a domed or conical roof (mushroom cap, thatched round roof, or alchemy dome) with shingle rows.
 */
export function drawDomeRoof(
  grid: PixelGrid,
  rx: number,
  ry: number,
  centerY: number,
  roofRamp: number[],
  opts: {
    ox?: number;
    hasSnow?: boolean;
    snowRamp?: number[];
    spotColor?: number;
    boneTrimRamp?: number[];
  } = {}
): void {
  const ox = opts.ox ?? 0;
  for (let dy = -ry; dy <= Math.floor(ry * 0.45); dy++) {
    for (let dx = -rx; dx <= rx; dx++) {
      const nx = dx / rx;
      const ny = dy / ry;
      const r2 = nx * nx + ny * ny;
      if (r2 > 1.0) continue;
      const shingle = (dy + ry) % 3 === 0 ? -0.08 : 0.04;
      const light = (-nx * 0.35 - ny * 0.35) + 0.56 + shingle;
      let activeRamp = roofRamp;
      if (opts.hasSnow && opts.snowRamp && ny < 0.05) {
        activeRamp = opts.snowRamp;
      }
      let col = activeRamp[ditherBand(light, activeRamp.length, dx + 64, dy + 64)];
      if (opts.spotColor && !opts.hasSnow) {
        const dSpot1 = (dx + Math.round(rx * 0.38)) ** 2 + (dy + Math.round(ry * 0.25)) ** 2;
        const dSpot2 = (dx - Math.round(rx * 0.35)) ** 2 + (dy + Math.round(ry * 0.1)) ** 2;
        const dSpot3 = dx * dx + (dy + Math.round(ry * 0.55)) ** 2;
        if (dSpot1 <= 5 || dSpot2 <= 4 || dSpot3 <= 4) col = opts.spotColor;
      }
      if (opts.boneTrimRamp && Math.abs(dx) <= 1 && dy < 2) {
        col = opts.boneTrimRamp[dy % 2 === 0 ? 4 : 2];
      }
      if (r2 > 0.84 || dy === Math.floor(ry * 0.45)) {
        col = selectiveOutline(col);
      }
      setPx(grid, ox + dx, centerY + dy, col, 4);
    }
  }
}

/**
 * Post-processes silhouette edges with a 1px selective dark outline and computes metrics.
 */
export function finalizePixelGrid(grid: PixelGrid): PixelGrid {
  const { width, height, rgba, group } = grid;
  const edgeIndices: number[] = [];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      if (group[idx] === 0) continue;
      const touchesEmpty =
        group[idx - 1] === 0 ||
        group[idx + 1] === 0 ||
        group[idx - width] === 0 ||
        group[idx + width] === 0;
      if (touchesEmpty) edgeIndices.push(idx);
    }
  }

  for (const idx of edgeIndices) {
    if (group[idx] === 9) continue; // Keep lit windows bright
    const o = idx * 4;
    const hex = fromRgb(rgba[o], rgba[o + 1], rgba[o + 2]);
    const out = selectiveOutline(hex);
    rgba[o] = (out >> 16) & 255;
    rgba[o + 1] = (out >> 8) & 255;
    rgba[o + 2] = out & 255;
  }

  let opaqueCount = 0;
  let minX = width;
  let maxX = 0;
  let minY = height;
  let maxY = 0;
  let hash = 2166136261;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (group[idx] > 0) {
        opaqueCount++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        hash ^= (x * 73 + y * 131 + group[idx]) & 0xff;
        hash = Math.imul(hash, 16777619);
      }
    }
  }

  grid.opaqueCount = opaqueCount;
  grid.bounds = opaqueCount > 0 ? { minX, maxX, minY, maxY } : { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  grid.silhouetteHash = hash >>> 0;
  return grid;
}
