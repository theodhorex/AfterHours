/**
 * Procedural isometric ground tiles with shade variants, road junctions,
 * sand shorelines, and water foam edges for PixiJS v8.
 */

import { Graphics, type Renderer, type Texture } from "pixi.js";
import type { TileKind } from "./terrain.ts";

export interface ArcPalette {
  primary: number;
  secondary: number;
  trim: number;
  accent: number;
  grass: number;
  grassDark: number;
  water: number;
  waterDeep: number;
  waterFoam: number;
  sand: number;
  rock: number;
  forest: number;
  road: number;
  roadCurb: number;
  bridge: number;
}

export const ARC_PALETTES: Record<string, ArcPalette> = {
  goblin_warrens: {
    primary: 0x42382c,
    secondary: 0x30271e,
    trim: 0x221c15,
    accent: 0xf59e0b, // Amber lantern light
    grass: 0x4c6632, // Mossy vibrant green
    grassDark: 0x364a23,
    water: 0x265f7c,
    waterDeep: 0x184257,
    waterFoam: 0x64b4d6,
    sand: 0x7d6f54,
    rock: 0x55585e, // Damp grey stone
    forest: 0x284720,
    road: 0x5a5142,
    roadCurb: 0x363026,
    bridge: 0x735738,
  },
  cave_hold: {
    primary: 0x4d3c2c,
    secondary: 0x382a1d,
    trim: 0x261b11,
    accent: 0xe5b358, // Warm gold & hearth
    grass: 0x8a6842, // Warm tans & ochre
    grassDark: 0x61482d,
    water: 0x25566c,
    waterDeep: 0x163747,
    waterFoam: 0x58a4c7,
    sand: 0x8c7450,
    rock: 0x6b594d, // Clay and bone stone
    forest: 0x3a4c28,
    road: 0x65513d,
    roadCurb: 0x3d3023,
    bridge: 0x7a5e3d,
  },
  dino_vale: {
    primary: 0x3d4a2d,
    secondary: 0x29351e,
    trim: 0x1c2514,
    accent: 0xeb8828, // Amber and orange
    grass: 0x387d2f, // Lush swamp green
    grassDark: 0x26571f,
    water: 0x1b7d75, // Rich teal water
    waterDeep: 0x114f4a,
    waterFoam: 0x42cfc2,
    sand: 0x787342,
    rock: 0x464e43,
    forest: 0x215421,
    road: 0x54523e,
    roadCurb: 0x333225,
    bridge: 0x695a35,
  },
  elf_grove: {
    primary: 0x5a544a,
    secondary: 0x3e3a32,
    trim: 0x282520,
    accent: 0xa8e0d8, // Silver leaf glow
    grass: 0x4f9c52, // Fresh light green
    grassDark: 0x356937,
    water: 0x2b78ad, // Moon-blue water
    waterDeep: 0x174b6f,
    waterFoam: 0x72c8fa,
    sand: 0x8c8973,
    rock: 0x6a7880, // Silver quartz
    forest: 0x265c2e,
    road: 0x6d6d63,
    roadCurb: 0x44443c,
    bridge: 0x85775f,
  },
};

export function getArcPalette(arcId: string): ArcPalette {
  return ARC_PALETTES[arcId] ?? ARC_PALETTES.goblin_warrens;
}

/**
 * Adjusts color brightness deterministically for tile shade variants.
 */
function adjustColor(col: number, delta: number): number {
  let r = (col >> 16) & 0xff;
  let g = (col >> 8) & 0xff;
  let b = col & 0xff;
  r = Math.max(0, Math.min(255, r + delta));
  g = Math.max(0, Math.min(255, g + delta));
  b = Math.max(0, Math.min(255, b + delta));
  return (r << 16) | (g << 8) | b;
}

/**
 * Draws 64x32 isometric ground tile with 2-3 shade variants, road edges,
 * shoreline foam, or small props.
 */
export function drawTileGraphics(
  g: Graphics,
  kind: TileKind | "road" | "bridge",
  pal: ArcPalette,
  variant = 0,
  roadMask = 0
): void {
  // Variant delta brightness: [-8, 0, +10]
  const delta = variant === 0 ? 0 : variant === 1 ? -8 : 10;

  let topColor = adjustColor(pal.grass, delta);
  let skirtColor = pal.grassDark;

  if (kind === "water") {
    topColor = adjustColor(pal.water, delta / 2);
    skirtColor = pal.waterDeep;
  } else if (kind === "sand") {
    topColor = adjustColor(pal.sand, delta);
    skirtColor = 0x423827;
  } else if (kind === "rock") {
    topColor = adjustColor(pal.rock, delta);
    skirtColor = 0x2d261e;
  } else if (kind === "forest") {
    topColor = adjustColor(pal.forest, delta);
    skirtColor = 0x162413;
  } else if (kind === "road") {
    topColor = adjustColor(pal.road, delta);
    skirtColor = pal.roadCurb;
  } else if (kind === "bridge") {
    topColor = adjustColor(pal.bridge, delta);
    skirtColor = 0x3b3022;
  }

  // 1. Skirt (depth block 6px below top face)
  g.poly([-32, 0, 0, 16, 32, 0, 32, 6, 0, 22, -32, 6]).fill({ color: skirtColor });

  // 2. Top Diamond face (64x32)
  g.poly([0, -16, 32, 0, 0, 16, -32, 0])
    .fill({ color: topColor })
    .stroke({ color: 0x12100e, width: 0.6, alpha: 0.8 });

  // 3. Tile surface details & props
  if (kind === "water") {
    // Water ripple highlights and foam
    g.poly([-12, -4, 0, -10, 12, -4, 0, 2]).stroke({
      color: pal.waterFoam,
      width: 0.8,
      alpha: 0.45,
    });
    if (variant === 1) {
      g.poly([-6, 4, 6, 4]).stroke({ color: pal.waterFoam, width: 1, alpha: 0.35 });
    } else if (variant === 2) {
      // Light foam rim
      g.poly([-16, 8, 0, 16, 16, 8]).stroke({ color: pal.waterFoam, width: 0.9, alpha: 0.5 });
    }
  } else if (kind === "grass") {
    // Grass tufts or small flowers depending on variant
    if (variant === 1) {
      // 3 tiny blades of grass
      const bladeCol = adjustColor(topColor, -18);
      g.poly([-3, -2, -4, -6]).stroke({ color: bladeCol, width: 1 });
      g.poly([-1, -1, -1, -7]).stroke({ color: bladeCol, width: 1 });
      g.poly([1, -2, 3, -6]).stroke({ color: bladeCol, width: 1 });
    } else if (variant === 2) {
      // Small wildflower / pebble
      g.circle(4, -2, 1.3).fill({ color: pal.accent, alpha: 0.85 });
      g.circle(7, 0, 1.1).fill({ color: 0xf0e6d2, alpha: 0.75 });
    }
  } else if (kind === "sand") {
    // Sand dune speckles
    if (variant > 0) {
      g.circle(-5, 0, 1).fill({ color: adjustColor(topColor, -16) });
      g.circle(6, -3, 0.9).fill({ color: adjustColor(topColor, -16) });
    }
  } else if (kind === "rock") {
    // Jagged stone facet prism
    g.poly([-8, -6, 4, -10, 9, 1, -5, 3]).fill({ color: adjustColor(topColor, 18) });
    g.poly([-8, -6, 0, -16, 4, -10]).fill({ color: adjustColor(topColor, 32) });
    g.poly([4, -10, 0, -16, 9, 1]).stroke({ color: 0x12100e, width: 0.75 });
  } else if (kind === "forest") {
    // Base forest undergrowth pattern
    g.circle(-4, -2, 3.5).fill({ color: adjustColor(topColor, -15) });
    g.circle(5, 0, 3).fill({ color: adjustColor(topColor, -15) });
  } else if (kind === "road") {
    // Cobblestone pavement & curb edge lines according to connection mask
    // Mask bits: 1: North (-y), 2: East (+x), 4: South (+y), 8: West (-x)
    const hasN = (roadMask & 1) !== 0;
    const hasE = (roadMask & 2) !== 0;
    const hasS = (roadMask & 4) !== 0;
    const hasW = (roadMask & 8) !== 0;

    const curbCol = pal.roadCurb;
    // Draw curb lines on borders that have no road connection
    // North edge: [-32, 0] to [0, -16] is -X (West). [0, -16] to [32, 0] is -Y (North).
    if (!hasW) g.poly([-32, 0, 0, -16]).stroke({ color: curbCol, width: 1.5 });
    if (!hasN) g.poly([0, -16, 32, 0]).stroke({ color: curbCol, width: 1.5 });
    if (!hasE) g.poly([32, 0, 0, 16]).stroke({ color: curbCol, width: 1.5 });
    if (!hasS) g.poly([0, 16, -32, 0]).stroke({ color: curbCol, width: 1.5 });

    // Inner cobblestone texture
    g.poly([-16, 0, 0, 8, 16, 0, 0, -8]).stroke({
      color: curbCol,
      width: 0.75,
      alpha: 0.45,
    });
    if (variant === 1) {
      g.circle(0, 0, 1.2).fill({ color: adjustColor(topColor, -15) });
    }
  } else if (kind === "bridge") {
    // Timber plank bridge
    g.poly([-16, -8, 16, 8]).stroke({ color: 0x22170d, width: 1.2 });
    g.poly([-16, 8, 16, -8]).stroke({ color: 0x22170d, width: 1.2 });
    // Guard posts
    g.rect(-24, -8, 3, 6).fill({ color: 0x22170d });
    g.rect(21, -8, 3, 6).fill({ color: 0x22170d });
    g.poly([-24, -6, 21, -6]).stroke({ color: 0x3d2a18, width: 1 });
  }
}

/**
 * Cache for procedurally baked ground tile textures.
 */
export class GroundTextureCache {
  private cache = new Map<string, Texture>();
  private renderer: Renderer;

  constructor(renderer: Renderer) {
    this.renderer = renderer;
  }

  getTileTexture(
    kind: TileKind | "road" | "bridge",
    arcId: string,
    variant = 0,
    roadMask = 0
  ): Texture {
    const key = `tile_${kind}_${arcId}_v${variant}_m${roadMask}`;
    let tex = this.cache.get(key);
    if (!tex) {
      const g = new Graphics();
      drawTileGraphics(g, kind, getArcPalette(arcId), variant, roadMask);
      tex = this.renderer.generateTexture({ target: g });
      this.cache.set(key, tex);
      g.destroy();
    }
    return tex;
  }

  destroy(): void {
    for (const tex of this.cache.values()) {
      tex.destroy(true);
    }
    this.cache.clear();
  }
}
