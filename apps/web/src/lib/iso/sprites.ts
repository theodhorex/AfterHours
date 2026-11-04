/**
 * Central Texture Manager and procedural sprite coordinator for PixiJS v8.
 * Re-exports submodules for ground tiles, props/actors, and buildings.
 */

import { type Renderer, type Texture } from "pixi.js";
import type { TileKind } from "./terrain.ts";
import {
  type ArcPalette,
  GroundTextureCache,
  drawTileGraphics,
} from "./sprites-ground.ts";
import {
  BuildingTextureCache,
  drawHouseGraphics,
  drawSectorBuildingGraphics,
} from "./sprites-buildings.ts";
import {
  PropTextureCache,
  drawTreeGraphics,
  drawCitizenGraphics,
  drawCartGraphics,
} from "./sprites-props.ts";
import { shade, outlineColor, getTheme, type ThemeTokens } from "./theme.ts";

export type { ArcPalette, ThemeTokens };
export {
  shade,
  outlineColor,
  getTheme,
  drawTileGraphics,
  drawHouseGraphics,
  drawSectorBuildingGraphics,
  drawTreeGraphics,
  drawCitizenGraphics,
  drawCartGraphics,
};

/**
 * Unified Texture Manager pre-rendering procedural graphics into cached textures.
 * Caches textures per arc and season with nearest-neighbour pixel-sharp scaling.
 */
export class IsoTextureManager {
  private groundCache: GroundTextureCache;
  private buildingCache: BuildingTextureCache;
  private propCache: PropTextureCache;
  private renderer: Renderer;

  constructor(renderer: Renderer) {
    this.renderer = renderer;
    this.groundCache = new GroundTextureCache(renderer);
    this.buildingCache = new BuildingTextureCache(renderer);
    this.propCache = new PropTextureCache(renderer);
  }

  getTileTexture(
    kind: TileKind | "road" | "bridge",
    arcId: string,
    variant = 0,
    roadMask = 0,
    season = 0
  ): Texture {
    return this.groundCache.getTileTexture(kind, arcId, variant, roadMask, season);
  }

  getHouseTexture(variant: number, level: number, arcId: string, season = 0): Texture {
    const pal = getTheme(arcId, season);
    return this.buildingCache.getHouseTexture(variant, level, arcId, pal, season);
  }

  getBuildingTexture(
    sectorKind: string,
    level: number,
    ruined: boolean,
    arcId: string,
    season = 0
  ): Texture {
    const pal = getTheme(arcId, season);
    return this.buildingCache.getBuildingTexture(sectorKind, level, ruined, arcId, pal, season);
  }

  getTreeTexture(treeType: number, arcId: string, season = 0): Texture {
    const pal = getTheme(arcId, season);
    return this.propCache.getTreeTexture(treeType, arcId, pal, season);
  }

  getCitizenTexture(arcId: string, season = 0): Texture {
    const pal = getTheme(arcId, season);
    return this.propCache.getCitizenTexture(arcId, pal);
  }

  getCartTexture(arcId: string, season = 0): Texture {
    const pal = getTheme(arcId, season);
    return this.propCache.getCartTexture(arcId, pal);
  }

  getSupportingTexture(kind: string, arcId: string, season = 0): Texture {
    const pal = getTheme(arcId, season);
    return this.propCache.getSupportingTexture(kind, arcId, pal);
  }

  getStallTexture(itemId: string, arcId: string, season = 0): Texture {
    const pal = getTheme(arcId, season);
    return this.propCache.getStallTexture(itemId, arcId, pal);
  }

  getRuralTexture(kind: string, arcId: string, season = 0): Texture {
    const pal = getTheme(arcId, season);
    return this.propCache.getRuralTexture(kind, arcId, pal);
  }

  getFountainTexture(arcId: string, season = 0): Texture {
    const pal = getTheme(arcId, season);
    return this.propCache.getFountainTexture(arcId, pal);
  }

  destroy(): void {
    this.groundCache.destroy();
    this.buildingCache.destroy();
    this.propCache.destroy();
  }
}
