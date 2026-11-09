/**
 * Bakes the whole terrain into ONE pixel-art texture: layered value noise posterised into
 * hue-shifted ramps with ordered (Bayer) dithering, plus tufts, flowers, pebbles, dirt patches,
 * foamy shores, ice and snow. Deterministic: no Math.random, no Date. Browser only (canvas).
 */
import type { TerrainMap, TileKind } from "./terrain.ts";
import type { ThemeTokens } from "./theme.ts";

export const GROUND_TILE_W = 64;
export const GROUND_TILE_H = 32;

export interface BakedGround {
  canvas: HTMLCanvasElement;
  /** Screen position of the canvas top-left in world space. */
  originX: number;
  originY: number;
}

type RGB = [number, number, number];

function toRgb(hex: number): RGB {
  return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
}

function hslShift(c: RGB, dh: number, ds: number, dl: number): RGB {
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
  const ll = Math.max(0, Math.min(1, l + dl));
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

function mixRgb(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** Six-step ramp: shadows drift cool, lights drift warm, as pixel artists do. */
function ramp(base: RGB, steps = 6): RGB[] {
  const out: RGB[] = [];
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    out.push(hslShift(base, (t - 0.45) * -22, (t - 0.5) * -0.06, (t - 0.45) * 0.3));
  }
  return out;
}

// --- deterministic noise -----------------------------------------------------------------

const TABLE = (() => {
  const t = new Float32Array(256 * 256);
  let s = 0x2545f491;
  for (let i = 0; i < t.length; i++) {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    t[i] = ((s >>> 0) % 100000) / 100000;
  }
  return t;
})();

function lat(ix: number, iy: number, salt: number): number {
  return TABLE[((ix + salt * 31) & 255) + (((iy + salt * 17) & 255) << 8)];
}

function vnoise(x: number, y: number, salt: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const a = lat(ix, iy, salt);
  const b = lat(ix + 1, iy, salt);
  const c = lat(ix, iy + 1, salt);
  const d = lat(ix + 1, iy + 1, salt);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function hash2(x: number, y: number, salt: number): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(salt, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

function band(v: number, steps: number, px: number, py: number, spread = 0.55): number {
  const d = (BAYER[(px & 3) + ((py & 3) << 2)] / 16 - 0.5) * spread;
  const i = Math.floor(v * steps + d + 0.5);
  return Math.max(0, Math.min(steps - 1, i));
}

// --- palettes ----------------------------------------------------------------------------

interface Palettes {
  grass: RGB[];
  moss: RGB[];
  forest: RGB[];
  dirt: RGB[];
  rock: RGB[];
  sand: RGB[];
  water: RGB[];
  foam: RGB;
  snow: RGB[];
  ice: RGB[];
  flowers: RGB[];
  leaf: RGB;
}

interface ArcGround {
  grass: number;
  forest: number;
  dirt: number;
  rock: number;
  sand: number;
  water: number;
}

/** Own muted, earthy ground colours per arc. The theme colours are cartoon-bright. */
const ARC_GROUND: Record<string, ArcGround> = {
  goblin_warrens: { grass: 0x4d7538, forest: 0x34542e, dirt: 0x6a5536, rock: 0x6b6a70, sand: 0x9a8a5c, water: 0x3f7a88 },
  cave_hold: { grass: 0x66764f, forest: 0x44573a, dirt: 0x6a5a48, rock: 0x6d7580, sand: 0x9c8e70, water: 0x3d6a90 },
  dino_vale: { grass: 0x5c8638, forest: 0x3d6a2c, dirt: 0x8a6a3a, rock: 0x7a7468, sand: 0xb59a5c, water: 0x3a8a82 },
  elf_grove: { grass: 0x5a9650, forest: 0x37764a, dirt: 0x786842, rock: 0x7d8c86, sand: 0xb0a070, water: 0x4896ae },
};

function buildPalettes(theme: ThemeTokens, season: number, arcId: string): Palettes {
  const a = ARC_GROUND[arcId] ?? ARC_GROUND.goblin_warrens;
  // season tint: spring fresh, summer rich, autumn rust and olive, winter drained
  const [dh, ds, dl] =
    season === 0 ? [4, 0.02, 0.03] : season === 1 ? [0, 0.05, 0] : season === 2 ? [-26, -0.04, -0.01] : [0, -0.2, 0.02];
  const tint = (hex: number, k = 1): RGB => hslShift(toRgb(hex), dh * k, ds * k, dl * k);
  const accent = toRgb(theme.accent);
  const grassBase = tint(a.grass);
  return {
    grass: ramp(grassBase),
    moss: ramp(hslShift(grassBase, -16, 0.0, -0.08)),
    forest: ramp(tint(a.forest)),
    dirt: ramp(tint(a.dirt, 0.4)),
    rock: ramp(toRgb(a.rock)),
    sand: ramp(tint(a.sand, 0.5)),
    water: ramp(toRgb(a.water)),
    foam: toRgb(0xeef5f2),
    snow: ramp(toRgb(0xe8eff4)),
    ice: ramp(toRgb(0xa8cbe0)),
    flowers: [accent, [240, 232, 200], [226, 178, 70], [196, 96, 112]],
    leaf: season === 2 ? [186, 96, 36] : [150, 128, 52],
  };
}

function kindAt(terrain: TerrainMap, x: number, y: number): TileKind | null {
  if (x < 0 || y < 0 || x >= terrain.size || y >= terrain.size) return null;
  return terrain.tiles[y][x];
}

export interface BakeOptions {
  /** Snow cover 0..1 for winter. Defaults from season. */
  snow?: number;
}

/** Draws the full terrain. Roads and buildings are separate sprites above it. */
export function bakeGround(
  terrain: TerrainMap,
  theme: ThemeTokens,
  arcId: string,
  season: number,
  opts: BakeOptions = {}
): BakedGround {
  const n = terrain.size;
  const minX = -(n - 1) * (GROUND_TILE_W / 2) - GROUND_TILE_W / 2 - 2;
  const maxX = (n - 1) * (GROUND_TILE_W / 2) + GROUND_TILE_W / 2 + 2;
  const minY = -GROUND_TILE_H / 2 - 2;
  const maxY = (n - 1) * GROUND_TILE_H + GROUND_TILE_H / 2 + 2;
  const W = Math.ceil(maxX - minX);
  const H = Math.ceil(maxY - minY);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas unavailable");
  const img = ctx.createImageData(W, H);
  const data = img.data;

  const P = buildPalettes(theme, season, arcId);
  const saltBase = Math.abs(hashString(arcId)) % 97;
  const snowCover = opts.snow ?? (season === 3 ? 0.62 : 0);
  const frozen = theme.isFrozenWater;
  const treeTone = arcId === "elf_grove" ? 0.58 : arcId === "cave_hold" ? 0.3 : 0.45;

  for (let py = 0; py < H; py++) {
    const sy = py + minY;
    for (let px = 0; px < W; px++) {
      const sx = px + minX;
      const fx = (sx / (GROUND_TILE_W / 2) + sy / (GROUND_TILE_H / 2)) / 2;
      const fy = (sy / (GROUND_TILE_H / 2) - sx / (GROUND_TILE_W / 2)) / 2;
      const ix = Math.round(fx);
      const iy = Math.round(fy);
      const kind = kindAt(terrain, ix, iy);
      if (!kind) continue;
      const u = fx - ix;
      const v = fy - iy;

      // layered noise in world space so patches flow across tile borders
      const big = vnoise(fx * 0.16, fy * 0.16, saltBase);
      const mid = vnoise(fx * 0.55, fy * 0.55, saltBase + 3);
      const small = vnoise(fx * 1.9, fy * 1.9, saltBase + 7);
      const grain = hash2(px, py, saltBase);

      let c: RGB;
      if (kind === "water") {
        c = shadeWater(terrain, ix, iy, u, v, fx, fy, px, py, P, frozen, saltBase);
      } else if (kind === "rock") {
        const ridge = Math.abs(vnoise(fx * 0.9, fy * 0.9, saltBase + 11) - 0.5) * 2;
        const lum = 0.55 * mid + 0.25 * (1 - ridge) + 0.2 * grain;
        c = P.rock[band(lum, P.rock.length, px, py)];
        if (ridge < 0.06) c = P.rock[0];
        if (grain > 0.985) c = P.rock[5];
      } else if (kind === "sand") {
        const ripple = Math.sin((fx + fy) * 5.2 + big * 6) * 0.5 + 0.5;
        const lum = 0.45 * mid + 0.3 * ripple + 0.25 * grain;
        c = P.sand[band(lum, P.sand.length, px, py)];
        if (grain < 0.01) c = P.sand[0];
      } else {
        // grass and forest floor
        const forest = kind === "forest";
        const base = forest ? P.forest : P.grass;
        let lum = 0.4 * mid + 0.34 * big + 0.18 * small + 0.08 * grain;
        const tileJit = (hash2(ix, iy, saltBase + 5) - 0.5) * 0.08;
        lum += tileJit;
        c = base[band(lum, base.length, px, py)];

        // moss: darker, cooler patches
        if (mid > 0.58 && !forest) c = P.moss[band(lum + 0.05, P.moss.length, px, py)];
        // bare earth patches with dithered edges
        const dirtN = vnoise(fx * 0.38 + 40, fy * 0.38 + 40, saltBase + 13);
        if (dirtN > (forest ? 0.84 : 0.78)) {
          c = P.dirt[band(0.25 + 0.5 * small + 0.25 * grain, P.dirt.length, px, py)];
        }
        // tufts: two-pixel vertical strokes
        const stem = hash2(px, py, saltBase + 21) < 0.011 + (forest ? 0.006 : 0);
        const top = hash2(px, py + 1, saltBase + 21) < 0.011 + (forest ? 0.006 : 0);
        if (stem) c = base[Math.max(0, band(lum, base.length, px, py) - 2)];
        else if (top) c = base[Math.min(base.length - 1, band(lum, base.length, px, py) + 2)];
        // flowers (2x2 blobs) on open grass, fallen leaves on forest floor
        if (!forest && hash2(px >> 1, py >> 1, saltBase + 31) < 0.006) {
          c = P.flowers[Math.floor(hash2(px >> 1, py >> 1, saltBase + 33) * P.flowers.length)];
        }
        if (forest && hash2(px >> 1, py >> 1, saltBase + 35) < treeTone * 0.02) c = P.leaf;
        // pebbles
        if (hash2(px >> 1, py >> 1, saltBase + 41) < 0.004) {
          c = (px & 1) === 0 ? P.rock[4] : P.rock[1];
        }
        // soft wet rim where grass meets water
        const wet = shoreProximity(terrain, ix, iy, u, v);
        if (wet > 0.8) c = P.dirt[band(0.2 + 0.4 * grain, P.dirt.length, px, py)];
        else if (wet > 0.6) c = mixRgb(c, P.dirt[1], 0.45);
      }

      // snow: large smooth drifts, a narrow dithered rim, calm surface shading
      if (snowCover > 0 && kind !== "water") {
        const drift = 0.55 * big + 0.35 * mid + 0.1 * small;
        const edge = (BAYER[(px & 3) + ((py & 3) << 2)] / 16 - 0.5) * 0.05;
        if (drift + edge < snowCover * 0.78 + 0.1) {
          const calm = 0.5 + 0.35 * (mid - 0.5) + 0.2 * (grain - 0.5);
          c = P.snow[2 + band(calm, 4, px, py, 0.35)];
        }
      }

      const o = (py * W + px) * 4;
      data[o] = c[0];
      data[o + 1] = c[1];
      data[o + 2] = c[2];
      data[o + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  return { canvas, originX: minX, originY: minY };
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h | 0;
}

/** 0..1, higher the closer a land pixel is to water on its own tile edges. */
function shoreProximity(terrain: TerrainMap, ix: number, iy: number, u: number, v: number): number {
  let best = 0;
  const check = (dx: number, dy: number, dist: number) => {
    if (kindAt(terrain, ix + dx, iy + dy) === "water") best = Math.max(best, 1 - dist * 2.2);
  };
  check(1, 0, 0.5 - u);
  check(-1, 0, 0.5 + u);
  check(0, 1, 0.5 - v);
  check(0, -1, 0.5 + v);
  return Math.max(0, best);
}

function shadeWater(
  terrain: TerrainMap,
  ix: number,
  iy: number,
  u: number,
  v: number,
  fx: number,
  fy: number,
  px: number,
  py: number,
  P: Palettes,
  frozen: boolean,
  salt: number
): RGB {
  const flow = vnoise(fx * 0.7 + fy * 0.2, fy * 0.7 - fx * 0.2, salt + 51);
  const wave = Math.sin((fx - fy) * 3.1 + flow * 7) * 0.5 + 0.5;
  const ramps = frozen ? P.ice : P.water;
  let lum = 0.5 * flow + 0.3 * wave + 0.2 * hash2(px, py, salt + 53);
  // deeper toward the middle of a body of water, lighter at the edge
  let edge = 0;
  const probe = (dx: number, dy: number, dist: number) => {
    const k = kindAt(terrain, ix + dx, iy + dy);
    if (k && k !== "water") edge = Math.max(edge, 1 - dist * 2.6);
  };
  probe(1, 0, 0.5 - u);
  probe(-1, 0, 0.5 + u);
  probe(0, 1, 0.5 - v);
  probe(0, -1, 0.5 + v);
  edge = Math.max(0, edge);
  lum = lum * (1 - edge * 0.5) + edge * 0.55;
  let c = ramps[band(lum, ramps.length, px, py)];
  if (edge > 0.72) c = P.foam;
  else if (edge > 0.55 && ((px + py) & 1) === 0) c = mixRgb(c, P.foam, 0.7);
  // sparkle glints
  if (!frozen && hash2(px >> 1, py >> 1, salt + 57) > 0.997) c = P.foam;
  if (frozen && Math.abs(vnoise(fx * 1.3, fy * 1.3, salt + 59) - 0.5) < 0.012) c = ramps[0];
  return c;
}
