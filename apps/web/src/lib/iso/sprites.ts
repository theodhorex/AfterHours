/**
 * Procedural isometric sprite generators and texture caching for PixiJS v8.
 * Draws blocky TheoTown-like ground blocks, distinctive buildings per sector kind,
 * and houses adhering to arc palette themes.
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
  sand: number;
  rock: number;
  forest: number;
  road: number;
  bridge: number;
}

export const ARC_PALETTES: Record<string, ArcPalette> = {
  goblin_warrens: {
    primary: 0x3d3429,
    secondary: 0x2b241d,
    trim: 0x1f1b16,
    accent: 0xf07f4f, // Ember
    grass: 0x3a452d,
    grassDark: 0x2c3523,
    water: 0x22485a,
    waterDeep: 0x16313e,
    sand: 0x5a4d38,
    rock: 0x483e33,
    forest: 0x24341e,
    road: 0x4a3f32,
    bridge: 0x614f3b,
  },
  cave_hold: {
    primary: 0x423528,
    secondary: 0x30251c,
    trim: 0x231a13,
    accent: 0xe5b358, // Gold / Hearth
    grass: 0x454231,
    grassDark: 0x333024,
    water: 0x203e4d,
    waterDeep: 0x142833,
    sand: 0x69573f,
    rock: 0x4e3e30,
    forest: 0x2b3620,
    road: 0x524434,
    bridge: 0x5e4832,
  },
  dino_vale: {
    primary: 0x38422d,
    secondary: 0x293120,
    trim: 0x1c2316,
    accent: 0xd48a37, // Amber
    grass: 0x3b5229,
    grassDark: 0x2a3d1c,
    water: 0x1c4a45,
    waterDeep: 0x12312e,
    sand: 0x6b633b,
    rock: 0x3d3c2d,
    forest: 0x1f3b19,
    road: 0x474230,
    bridge: 0x574b2f,
  },
  elf_grove: {
    primary: 0x50493f,
    secondary: 0x38332c,
    trim: 0x26231e,
    accent: 0x8ec3b0, // Silver leaf
    grass: 0x3b5735,
    grassDark: 0x293e25,
    water: 0x23576e,
    waterDeep: 0x153747,
    sand: 0x666250,
    rock: 0x464a47,
    forest: 0x204526,
    road: 0x575245,
    bridge: 0x6e624c,
  },
};

export function getArcPalette(arcId: string): ArcPalette {
  return ARC_PALETTES[arcId] ?? ARC_PALETTES.goblin_warrens;
}

/**
 * Draws 64x32 isometric ground block with side depth skirt.
 */
export function drawTileGraphics(
  g: Graphics,
  kind: TileKind | "road" | "bridge",
  pal: ArcPalette
): void {
  let topColor = pal.grass;
  let skirtColor = pal.grassDark;

  if (kind === "water") {
    topColor = pal.water;
    skirtColor = pal.waterDeep;
  } else if (kind === "sand") {
    topColor = pal.sand;
    skirtColor = 0x423827;
  } else if (kind === "rock") {
    topColor = pal.rock;
    skirtColor = 0x2d261e;
  } else if (kind === "forest") {
    topColor = pal.forest;
    skirtColor = 0x162413;
  } else if (kind === "road") {
    topColor = pal.road;
    skirtColor = 0x2d2720;
  } else if (kind === "bridge") {
    topColor = pal.bridge;
    skirtColor = 0x3b3022;
  }

  // 1. Skirt (depth block 6px below top face)
  g.poly([-32, 0, 0, 16, 32, 0, 32, 6, 0, 22, -32, 6])
    .fill({ color: skirtColor });

  // 2. Top Diamond face
  g.poly([0, -16, 32, 0, 0, 16, -32, 0])
    .fill({ color: topColor })
    .stroke({ color: 0x12100e, width: 0.75 });

  // 3. Tile surface details
  if (kind === "water") {
    // Water ripple highlights
    g.poly([-12, -4, 0, -10, 12, -4, 0, 2])
      .stroke({ color: 0x4fa4c9, width: 0.8, alpha: 0.4 });
  } else if (kind === "road") {
    // Cobblestone center seam
    g.poly([-18, 0, 0, 9, 18, 0, 0, -9])
      .stroke({ color: 0x2a241c, width: 0.8, alpha: 0.5 });
  } else if (kind === "bridge") {
    // Wooden plank lines and side posts
    g.poly([-14, -7, 14, 7]).stroke({ color: 0x241a10, width: 1 });
    g.poly([-14, 7, 14, -7]).stroke({ color: 0x241a10, width: 1 });
    g.rect(-24, -8, 3, 5).fill({ color: 0x261a0f });
    g.rect(21, -8, 3, 5).fill({ color: 0x261a0f });
  } else if (kind === "forest") {
    // Stylized mini tree crown
    g.poly([0, -18, 9, -7, 0, 0, -9, -7]).fill({ color: 0x1e4a1e });
    g.poly([0, -23, 7, -13, 0, -6, -7, -13]).fill({ color: 0x2b6329 });
  } else if (kind === "rock") {
    // Jagged stone prism
    g.poly([-6, -8, 6, -11, 8, 0, -4, 2]).fill({ color: 0x615446 });
    g.poly([-6, -8, 0, -18, 6, -11]).fill({ color: 0x7a6b5a });
  }
}

/**
 * Draws citizen residential house (levels 1-4).
 */
export function drawHouseGraphics(g: Graphics, level: number, pal: ArcPalette): void {
  const wallH = 12 + level * 3;
  const roofColor = pal.secondary;
  const wallLeft = pal.primary;
  const wallRight = 0x241e17;

  // Base left and right walls
  g.poly([-14, 0, 0, 7, 0, 7 - wallH, -14, -wallH]).fill({ color: wallLeft });
  g.poly([0, 7, 14, 0, 14, -wallH, 0, 7 - wallH]).fill({ color: wallRight });

  // Pitched Roof
  const peakY = -wallH - 8 - level * 2;
  g.poly([-16, -wallH, 0, 7 - wallH, 0, peakY]).fill({ color: roofColor });
  g.poly([0, 7 - wallH, 16, -wallH, 0, peakY]).fill({ color: roofColor - 0x0a0a0a });

  // Door on left wall
  g.poly([-8, 3, -4, 5, -4, 5 - 6, -8, 3 - 6]).fill({ color: 0x120f0c });

  // Window with warm light
  g.poly([4, 1 - wallH / 2, 8, -1 - wallH / 2, 8, -6 - wallH / 2, 4, -4 - wallH / 2])
    .fill({ color: pal.accent });

  // Chimney for level 2+
  if (level >= 2) {
    g.rect(6, peakY + 2, 3, 6).fill({ color: 0x382d23 });
  }
}

/**
 * Draws distinctive building for each sector kind (0 food, 1 ore, 2 forge, 3 alchemy, 4 harbor, 5 tower).
 */
export function drawSectorBuildingGraphics(
  g: Graphics,
  sectorKind: string,
  level: number,
  ruined: boolean,
  pal: ArcPalette
): void {
  const wallLeft = ruined ? 0x221e1a : pal.primary;
  const wallRight = ruined ? 0x191613 : 0x221c15;
  const roofCol = ruined ? 0x28231e : pal.secondary;
  const accent = ruined ? 0x473e35 : pal.accent;
  const wallH = 14 + level * 4;

  if (sectorKind === "food") {
    // Farmstead: barn with fenced plots / silo
    g.poly([-16, 0, 0, 8, 0, 8 - wallH, -16, -wallH]).fill({ color: wallLeft });
    g.poly([0, 8, 16, 0, 16, -wallH, 0, 8 - wallH]).fill({ color: wallRight });
    // Gambrel barn roof
    g.poly([-18, -wallH, 0, 8 - wallH, 0, -wallH - 10]).fill({ color: roofCol });
    g.poly([0, 8 - wallH, 18, -wallH, 0, -wallH - 10]).fill({ color: roofCol - 0x080808 });
    // Fenced crop plots / silo extension
    g.rect(-25, 0, 8, 6).fill({ color: 0x483a27 });
    g.poly([-25, 2, -17, 6]).stroke({ color: 0x6e9c49, width: 1.5 });
  } else if (sectorKind === "ore") {
    // Mine entrance with timber headframe and ore cart
    g.poly([-18, 0, 0, 9, 18, 0, 0, -12]).fill({ color: 0x332c25 });
    // Wooden mine shaft archway
    g.poly([-10, 4, -10, -14, 0, -9, 0, 8]).fill({ color: 0x110e0b });
    g.poly([-12, 5, -12, -16, 2, -10, 2, 9]).stroke({ color: 0x54402a, width: 2 });
    // Little ore cart
    g.poly([6, 5, 12, 2, 12, -2, 6, 1]).fill({ color: 0x6e6150 });
    g.circle(8, 6, 1.5).fill({ color: 0x12100e });
    g.circle(11, 4, 1.5).fill({ color: 0x12100e });
  } else if (sectorKind === "forge") {
    // Smithy with heavy chimney and glowing hearth
    g.poly([-18, 0, 0, 9, 0, 9 - wallH, -18, -wallH]).fill({ color: wallLeft });
    g.poly([0, 9, 16, 1, 16, 1 - wallH, 0, 9 - wallH]).fill({ color: wallRight });
    // Forge roof
    g.poly([-20, -wallH, 0, 9 - wallH, 0, -wallH - 7]).fill({ color: roofCol });
    g.poly([0, 9 - wallH, 18, 1 - wallH, 0, -wallH - 7]).fill({ color: roofCol - 0x0a0a0a });
    // Hearth opening glowing with ember
    g.poly([-12, 4, -5, 7, -5, 1, -12, -2]).fill({ color: accent });
    // Tall stone chimney stack
    g.rect(8, -wallH - 14, 5, 16).fill({ color: 0x3d3226 }).stroke({ color: 0x1a1510, width: 1 });
  } else if (sectorKind === "alchemy") {
    // Alchemical vat with boiling dome / alembic
    g.poly([-16, 0, 0, 8, 0, 8 - wallH, -16, -wallH]).fill({ color: wallLeft });
    g.poly([0, 8, 16, 0, 16, -wallH, 0, 8 - wallH]).fill({ color: wallRight });
    // Dome roof
    g.circle(0, -wallH + 2, 12).fill({ color: 0x33443a }).stroke({ color: 0x4f6b5c, width: 1 });
    // Glowing vat viewport
    g.circle(0, -wallH + 2, 6).fill({ color: accent });
  } else if (sectorKind === "harbor") {
    // Wooden dock wharf and moored boat
    g.poly([-22, 2, 8, 17, 8, 12, -22, -3]).fill({ color: 0x4a3a27 });
    // Shed
    g.poly([-14, -2, 0, 5, 0, 5 - wallH, -14, -wallH - 2]).fill({ color: wallLeft });
    g.poly([0, 5, 14, -2, 14, -wallH - 2, 0, 5 - wallH]).fill({ color: wallRight });
    g.poly([-16, -wallH - 2, 0, 5 - wallH, 16, -wallH - 2, 0, -wallH - 9]).fill({ color: roofCol });
    // Moored boat hull
    g.poly([10, 10, 24, 3, 22, -1, 8, 6]).fill({ color: 0x59422a });
  } else {
    // Tower (sector 5)
    const towerH = 26 + level * 8;
    g.poly([-10, 0, 0, 5, 0, 5 - towerH, -10, -towerH]).fill({ color: wallLeft });
    g.poly([0, 5, 10, 0, 10, -towerH, 0, 5 - towerH]).fill({ color: wallRight });
    // Spire peak
    g.poly([-12, -towerH, 0, 5 - towerH, 0, -towerH - 18]).fill({ color: roofCol });
    g.poly([0, 5 - towerH, 12, -towerH, 0, -towerH - 18]).fill({ color: roofCol - 0x0c0c0c });
    // Arcane spire gem at apex
    g.poly([0, -towerH - 22, 3, -towerH - 18, 0, -towerH - 14, -3, -towerH - 18]).fill({ color: accent });
  }

  // Ruined details: cracked broken-roof notch and red warning marker shape
  if (ruined) {
    // Broken roof gap
    g.poly([-4, -wallH - 5, 4, -wallH - 1, 0, -wallH + 3]).fill({ color: 0x12100e });
    // Red structural marker shape (broken girder / chevron)
    g.poly([-6, -wallH - 12, 6, -wallH - 12, 0, -wallH - 6]).fill({ color: 0xf26868 });
  }
}

/**
 * Texture Manager pre-rendering procedural graphics into cached textures.
 */
export class IsoTextureManager {
  private cache = new Map<string, Texture>();

  constructor(private renderer: Renderer) {}

  getTileTexture(kind: TileKind | "road" | "bridge", arcId: string): Texture {
    const key = `tile_${kind}_${arcId}`;
    let tex = this.cache.get(key);
    if (!tex) {
      const g = new Graphics();
      drawTileGraphics(g, kind, getArcPalette(arcId));
      tex = this.renderer.generateTexture({ target: g });
      this.cache.set(key, tex);
      g.destroy();
    }
    return tex;
  }

  getHouseTexture(level: number, arcId: string): Texture {
    const key = `house_lvl${level}_${arcId}`;
    let tex = this.cache.get(key);
    if (!tex) {
      const g = new Graphics();
      drawHouseGraphics(g, level, getArcPalette(arcId));
      tex = this.renderer.generateTexture({ target: g });
      this.cache.set(key, tex);
      g.destroy();
    }
    return tex;
  }

  getBuildingTexture(
    sectorKind: string,
    level: number,
    ruined: boolean,
    arcId: string
  ): Texture {
    const key = `bldg_${sectorKind}_lvl${level}_${ruined ? "ruin" : "ok"}_${arcId}`;
    let tex = this.cache.get(key);
    if (!tex) {
      const g = new Graphics();
      drawSectorBuildingGraphics(g, sectorKind, level, ruined, getArcPalette(arcId));
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
