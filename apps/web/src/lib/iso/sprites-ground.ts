/**
 * Procedural isometric ground tiles with pixel-sharp nearest-neighbour rendering,
 * 1px dark outlines, flat tone steps, and per-arc road/season styles for PixiJS v8.
 */

import { Graphics, type Renderer, type Texture } from "pixi.js";
import type { TileKind } from "./terrain.ts";
import { getTheme, shade, outlineColor, type ThemeTokens } from "./theme.ts";
import { drawSurfaceToGraphics } from "./prop-helpers.ts";
import { bakeRoadPixels, bakeBridgePixels } from "./prop-roads.ts";

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

export { getTheme };

export function getArcPalette(arcId: string, season = 0): ArcPalette {
  return getTheme(arcId, season);
}

/**
 * Draws 64x32 isometric ground tile with 3-4 flat tone steps, 1px dark outlines,
 * and seasonal variants (frozen water, frost rims, road styles).
 */
export function drawTileGraphics(
  g: Graphics,
  kind: TileKind | "road" | "bridge",
  pal: ArcPalette | ThemeTokens,
  variant = 0,
  roadMask = 0
): void {
  if (kind === "road") {
    const roadStyle = "roadStyle" in pal ? pal.roadStyle : "cobble";
    const arcId = "arcId" in pal && typeof pal.arcId === "string" ? pal.arcId : "goblin_warrens";
    const season = "seasonIndex" in pal ? pal.seasonIndex : 0;
    const baked = bakeRoadPixels(roadStyle, variant, roadMask, arcId, season);
    drawSurfaceToGraphics(g, baked);
    return;
  }

  if (kind === "bridge") {
    const arcId = "arcId" in pal && typeof pal.arcId === "string" ? pal.arcId : "goblin_warrens";
    const season = "seasonIndex" in pal ? pal.seasonIndex : 0;
    const baked = bakeBridgePixels(variant, roadMask, arcId, season);
    drawSurfaceToGraphics(g, baked);
    return;
  }

  const delta = variant === 0 ? 0 : variant === 1 ? -12 : 12;

  let topColor = shade(pal.grass, 1 + delta / 100);
  let skirtColor = pal.grassDark;

  if (kind === "water") {
    topColor = shade(pal.water, 1 + delta / 200);
    skirtColor = pal.waterDeep;
  } else if (kind === "sand") {
    topColor = shade(pal.sand, 1 + delta / 100);
    skirtColor = shade(pal.sand, 0.65);
  } else if (kind === "rock") {
    topColor = shade(pal.rock, 1 + delta / 100);
    skirtColor = shade(pal.rock, 0.6);
  } else if (kind === "forest") {
    topColor = shade(pal.forest, 1 + delta / 100);
    skirtColor = shade(pal.forest, 0.55);
  }

  const border = outlineColor(topColor);

  // 1. Skirt: 3 flat tone steps (left mid, right dark)
  const leftSkirt = shade(skirtColor, 1.0);
  const rightSkirt = shade(skirtColor, 0.72);
  g.poly([-32, 0, 0, 16, 0, 22, -32, 6]).fill({ color: leftSkirt });
  g.poly([0, 16, 32, 0, 32, 6, 0, 22]).fill({ color: rightSkirt });
  g.poly([-32, 6, 0, 22, 32, 6]).stroke({ color: outlineColor(skirtColor), width: 1 });

  // 2. Top Diamond face (64x32) with 1px dark pixel outline
  g.poly([0, -16, 32, 0, 0, 16, -32, 0])
    .fill({ color: topColor })
    .stroke({ color: border, width: 1 });

  // 3. Tile surface details & props
  if (kind === "water") {
    const isFrozen = "isFrozenWater" in pal && pal.isFrozenWater;
    if (isFrozen) {
      // Frozen ice fissures and frost rim
      g.poly([-16, -4, -4, 2, 8, -6, 18, 0]).stroke({ color: 0xffffff, width: 1, alpha: 0.85 });
      g.poly([0, 6, 12, 10]).stroke({ color: 0xd8edf5, width: 1, alpha: 0.75 });
    } else {
      // Crisp 2-band water ripples with flat steps
      g.poly([-14, -2, 0, -8, 14, -2]).stroke({ color: pal.waterFoam, width: 1, alpha: 0.65 });
      if (variant === 1) {
        g.poly([-8, 4, 0, 8, 8, 4]).stroke({ color: pal.waterFoam, width: 1, alpha: 0.5 });
      } else if (variant === 2) {
        g.poly([-18, 4, -4, 12, 12, 4]).stroke({ color: pal.waterFoam, width: 1, alpha: 0.6 });
      }
    }
  } else if (kind === "grass") {
    const hasSnow = "hasSnowCaps" in pal && pal.hasSnowCaps;
    if (hasSnow) {
      // Winter frost/snow patches
      g.poly([-6, -4, 0, -8, 6, -4, 0, 0]).fill({ color: 0xf0f8ff });
    } else if (variant === 1) {
      // Crisp 3-blade tuft with dark outline
      const tuftCol = shade(topColor, -0.25 > 0 ? 0.75 : 0.7);
      g.poly([-3, -2, -4, -6]).stroke({ color: tuftCol, width: 1 });
      g.poly([-1, -1, -1, -7]).stroke({ color: tuftCol, width: 1 });
      g.poly([1, -2, 3, -6]).stroke({ color: tuftCol, width: 1 });
    } else if (variant === 2) {
      // Pebble or wildflower
      g.circle(4, -2, 1.5).fill({ color: pal.accent }).stroke({ color: outlineColor(pal.accent), width: 0.75 });
      g.circle(7, 0, 1.2).fill({ color: 0xf0e6d2 });
    }
  } else if (kind === "sand") {
    if (variant > 0) {
      g.rect(-5, 0, 2, 1).fill({ color: shade(topColor, 0.75) });
      g.rect(6, -3, 2, 1).fill({ color: shade(topColor, 0.75) });
    }
  } else if (kind === "rock") {
    // Jagged stone prism with 3 flat tone steps
    g.poly([-8, -6, 4, -10, 9, 1, -5, 3]).fill({ color: shade(topColor, 0.8) });
    g.poly([-8, -6, 0, -16, 4, -10]).fill({ color: shade(topColor, 1.25) });
    g.poly([4, -10, 0, -16, 9, 1])
      .fill({ color: shade(topColor, 1.1) })
      .stroke({ color: outlineColor(topColor), width: 1 });
  } else if (kind === "forest") {
    // Forest underbrush with crisp outlines
    g.circle(-4, -2, 3.5).fill({ color: shade(topColor, 0.8) }).stroke({ color: border, width: 0.75 });
    g.circle(5, 0, 3).fill({ color: shade(topColor, 0.75) }).stroke({ color: border, width: 0.75 });
  }
}

/**
 * Cache for procedurally baked ground tile textures with nearest-neighbour scaling.
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
    roadMask = 0,
    season = 0
  ): Texture {
    const key = `tile_${kind}_${arcId}_s${season}_v${variant}_m${roadMask}`;
    let tex = this.cache.get(key);
    if (!tex) {
      const g = new Graphics();
      const theme = getTheme(arcId, season);
      drawTileGraphics(g, kind, theme, variant, roadMask);
      tex = this.renderer.generateTexture({
        target: g,
        textureSourceOptions: {
          scaleMode: "nearest",
        },
        antialias: false,
      });
      tex.source.scaleMode = "nearest";
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
