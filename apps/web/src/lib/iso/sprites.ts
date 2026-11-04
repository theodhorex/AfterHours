/**
 * Central Texture Manager and procedural sprite coordinator for PixiJS v8.
 * Re-exports submodules for ground tiles, props/actors, and buildings.
 */

import { type Renderer, type Texture } from "pixi.js";
import type { TileKind } from "./terrain.ts";
import {
  type ArcPalette,
  ARC_PALETTES,
  getArcPalette,
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

export type { ArcPalette };
export {
  ARC_PALETTES,
  getArcPalette,
  drawTileGraphics,
  drawHouseGraphics,
  drawSectorBuildingGraphics,
  drawTreeGraphics,
  drawCitizenGraphics,
  drawCartGraphics,
};

/**
 * Unified Texture Manager pre-rendering procedural graphics into cached textures.
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
    roadMask = 0
  ): Texture {
    return this.groundCache.getTileTexture(kind, arcId, variant, roadMask);
  }

  getHouseTexture(variant: number, level: number, arcId: string): Texture {
    const pal = getArcPalette(arcId);
    return this.buildingCache.getHouseTexture(variant, level, arcId, pal);
  }

  getBuildingTexture(
    sectorKind: string,
    level: number,
    ruined: boolean,
    arcId: string
  ): Texture {
    const pal = getArcPalette(arcId);
    return this.buildingCache.getBuildingTexture(sectorKind, level, ruined, arcId, pal);
  }

  getTreeTexture(treeType: number, arcId: string): Texture {
    const pal = getArcPalette(arcId);
    return this.propCache.getTreeTexture(treeType, arcId, pal);
  }

  getCitizenTexture(arcId: string): Texture {
    const pal = getArcPalette(arcId);
    return this.propCache.getCitizenTexture(arcId, pal);
  }

  getCartTexture(arcId: string): Texture {
    const pal = getArcPalette(arcId);
    return this.propCache.getCartTexture(arcId, pal);
  }

  destroy(): void {
    this.groundCache.destroy();
    this.buildingCache.destroy();
    this.propCache.destroy();
  }
}
