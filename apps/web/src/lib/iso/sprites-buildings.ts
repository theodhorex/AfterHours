/**
 * Procedural pixel-art isometric buildings, citizen houses (4 variants x levels 0..3+ per arc),
 * and 6 sector landmarks with 5-6 step hue-shifted ramps, <=3 dither bands, 1px selective dark outlines,
 * and soft blue-tinted cast shadows for PixiJS v8.
 */

import { Graphics, Texture, type Renderer } from "pixi.js";
import type { ArcPalette } from "./sprites-ground.ts";
import { getTheme, type ThemeTokens } from "./theme.ts";
import { type PixelGrid, fromRgb } from "./bldg-ramp.ts";
import { bakeHousePixels } from "./bldg-houses.ts";
import { bakeBuildingPixels } from "./bldg-business.ts";

function resolveArcId(pal: ArcPalette | ThemeTokens): string {
  return "arcId" in pal && typeof pal.arcId === "string" ? pal.arcId : "goblin_warrens";
}

function drawPixelGridToGraphics(g: Graphics, grid: PixelGrid): void {
  const { width, height, refX, refY, rgba } = grid;
  for (let y = 0; y < height; y++) {
    let x = 0;
    while (x < width) {
      const o = (y * width + x) * 4;
      const a = rgba[o + 3];
      if (a === 0) {
        x++;
        continue;
      }
      const r = rgba[o];
      const gr = rgba[o + 1];
      const b = rgba[o + 2];
      let run = 1;
      while (x + run < width) {
        const no = (y * width + (x + run)) * 4;
        if (rgba[no + 3] !== a || rgba[no] !== r || rgba[no + 1] !== gr || rgba[no + 2] !== b) {
          break;
        }
        run++;
      }
      g.rect(x - refX, y - refY, run, 1).fill({
        color: fromRgb(r, gr, b),
        alpha: a / 255,
      });
      x += run;
    }
  }
}

function pixelGridToTexture(grid: PixelGrid, renderer: Renderer): Texture {
  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = grid.width;
    canvas.height = grid.height;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const img = ctx.createImageData(grid.width, grid.height);
      img.data.set(grid.rgba);
      ctx.putImageData(img, 0, 0);
      const tex = Texture.from(canvas);
      tex.source.scaleMode = "nearest";
      return tex;
    }
  }
  const g = new Graphics();
  drawPixelGridToGraphics(g, grid);
  const tex = renderer.generateTexture({
    target: g,
    textureSourceOptions: { scaleMode: "nearest" },
    antialias: false,
  });
  tex.source.scaleMode = "nearest";
  g.destroy();
  return tex;
}

/**
 * Draws residential citizen house with arc-specific pixel-art architectural shapes.
 */
export function drawHouseGraphics(
  g: Graphics,
  variant: number,
  level: number,
  pal: ArcPalette | ThemeTokens,
  season = 0
): void {
  const arcId = resolveArcId(pal);
  const grid = bakeHousePixels(variant, level, arcId, season);
  drawPixelGridToGraphics(g, grid);
}

/**
 * Draws the 6 large sector landmarks with 5-6 step ramps, selective 1px dark outlines,
 * and arc/season/ruined variants.
 */
export function drawSectorBuildingGraphics(
  g: Graphics,
  sectorKind: string,
  level: number,
  ruined: boolean,
  pal: ArcPalette | ThemeTokens,
  season = 0
): void {
  const arcId = resolveArcId(pal);
  const grid = bakeBuildingPixels(sectorKind, level, ruined, arcId, season);
  drawPixelGridToGraphics(g, grid);
}

/**
 * Texture cache for building graphics with nearest-neighbour scaling.
 * Bakes once per key and caps canvas sizes (80x80 houses, 112x112 business buildings).
 */
export class BuildingTextureCache {
  private cache = new Map<string, Texture>();
  private renderer: Renderer;

  constructor(renderer: Renderer) {
    this.renderer = renderer;
  }

  getHouseTexture(
    variant: number,
    level: number,
    arcId: string,
    pal: ArcPalette,
    season = 0
  ): Texture {
    void pal;
    const key = `house_v${variant}_lvl${level}_${arcId}_s${season}`;
    let tex = this.cache.get(key);
    if (!tex) {
      getTheme(arcId, season);
      const grid = bakeHousePixels(variant, level, arcId, season);
      tex = pixelGridToTexture(grid, this.renderer);
      this.cache.set(key, tex);
    }
    return tex;
  }

  getBuildingTexture(
    sectorKind: string,
    level: number,
    ruined: boolean,
    arcId: string,
    pal: ArcPalette,
    season = 0
  ): Texture {
    void pal;
    const key = `bldg_${sectorKind}_lvl${level}_${ruined ? "ruin" : "ok"}_${arcId}_s${season}`;
    let tex = this.cache.get(key);
    if (!tex) {
      getTheme(arcId, season);
      const grid = bakeBuildingPixels(sectorKind, level, ruined, arcId, season);
      tex = pixelGridToTexture(grid, this.renderer);
      this.cache.set(key, tex);
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
