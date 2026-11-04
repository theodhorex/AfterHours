/**
 * High-detail procedural isometric buildings, houses (4 variants with level growth),
 * and 6 unmistakable sector landmarks (farm, mine, forge, alchemy, harbor, tower)
 * scaled ~1.3x for houses and ~1.6x for landmarks relative to 64x32 isometric tiles,
 * featuring drop shadows, light-direction shading, ruined states, and stage growth for PixiJS v8.
 */

import { Graphics, type Renderer, type Texture } from "pixi.js";
import type { ArcPalette } from "./sprites-ground.ts";
import { drawDropShadow } from "./sprites-props.ts";

function getFacetColors(base: number, ruined: boolean) {
  if (ruined) {
    return {
      left: 0x3d352c,
      right: 0x2b241c,
      roof: 0x483e33,
      trim: 0x1c1712,
    };
  }
  const r = (base >> 16) & 0xff;
  const g = (base >> 8) & 0xff;
  const b = base & 0xff;

  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  const left = (clamp(r + 14) << 16) | (clamp(g + 14) << 8) | clamp(b + 14);
  const right = (clamp(r - 22) << 16) | (clamp(g - 22) << 8) | clamp(b - 22);
  const roof = (clamp(r + 28) << 16) | (clamp(g + 28) << 8) | clamp(b + 28);
  const trim = (clamp(r - 35) << 16) | (clamp(g - 35) << 8) | clamp(b - 35);

  return { left, right, roof, trim };
}

/**
 * Draws residential citizen house (~1.3x scale) with 4 architectural variants and levels 1-4.
 */
export function drawHouseGraphics(
  g: Graphics,
  variant: number,
  level: number,
  pal: ArcPalette
): void {
  drawDropShadow(g, 21 + level * 2, 10 + level, 0.32);

  const wallH = 16 + level * 5;
  const facet = getFacetColors(pal.primary, false);
  const roofFacet = getFacetColors(pal.secondary, false);
  const warmWindow = 0xf5b041;

  if (variant === 0) {
    // Gable cottage with stone chimney
    g.poly([-18, 0, 0, 9, 0, 9 - wallH, -18, -wallH]).fill({ color: facet.left });
    g.poly([0, 9, 18, 0, 18, -wallH, 0, 9 - wallH]).fill({ color: facet.right });
    const peak = -wallH - 11 - level * 2;
    g.poly([-20, -wallH, 0, 9 - wallH, 0, peak]).fill({ color: roofFacet.roof });
    g.poly([0, 9 - wallH, 20, -wallH, 0, peak]).fill({ color: roofFacet.right });
    g.poly([-10, 4, -5, 6, -5, 6 - 9, -10, 4 - 9]).fill({ color: facet.trim });
    g.poly([5, 1 - wallH / 2, 10, -1 - wallH / 2, 10, -7 - wallH / 2, 5, -5 - wallH / 2]).fill({ color: warmWindow });
    g.rect(8, peak + 3, 5, 10).fill({ color: 0x3d3023 });
  } else if (variant === 1) {
    // Masonry home with side lean-to wing and dormer window
    g.poly([-20, 0, 0, 10, 0, 10 - wallH, -20, -wallH]).fill({ color: facet.left });
    g.poly([0, 10, 16, 2, 16, 2 - wallH, 0, 10 - wallH]).fill({ color: facet.right });
    g.poly([-28, -4, -20, 0, -20, -wallH + 6, -28, -wallH + 2]).fill({ color: facet.left });
    const peak = -wallH - 12;
    g.poly([-22, -wallH, 0, 10 - wallH, 0, peak]).fill({ color: roofFacet.roof });
    g.poly([0, 10 - wallH, 18, 2 - wallH, 0, peak]).fill({ color: roofFacet.right });
    g.rect(-13, -wallH / 2, 5, 5).fill({ color: warmWindow });
    g.rect(4, -wallH / 2, 5, 5).fill({ color: warmWindow });
  } else if (variant === 2) {
    // Tall townhouse with steep pitched roof and double dormers
    const tallH = wallH + 7;
    g.poly([-16, 0, 0, 8, 0, 8 - tallH, -16, -tallH]).fill({ color: facet.left });
    g.poly([0, 8, 16, 0, 16, -tallH, 0, 8 - tallH]).fill({ color: facet.right });
    const peak = -tallH - 15;
    g.poly([-18, -tallH, 0, 8 - tallH, 0, peak]).fill({ color: roofFacet.roof });
    g.poly([0, 8 - tallH, 18, -tallH, 0, peak]).fill({ color: roofFacet.right });
    g.rect(4, -tallH + 8, 5, 5).fill({ color: warmWindow });
    g.rect(4, -tallH + 18, 5, 5).fill({ color: warmWindow });
  } else {
    // L-shaped homestead with timber porch canopy
    g.poly([-19, 0, 0, 9, 0, 9 - wallH, -19, -wallH]).fill({ color: facet.left });
    g.poly([0, 9, 19, 0, 19, -wallH, 0, 9 - wallH]).fill({ color: facet.right });
    const peak = -wallH - 11;
    g.poly([-21, -wallH, 0, 9 - wallH, 0, peak]).fill({ color: roofFacet.roof });
    g.poly([0, 9 - wallH, 21, -wallH, 0, peak]).fill({ color: roofFacet.right });
    g.poly([-15, 6, -3, 12, -3, 7, -15, 1]).fill({ color: facet.trim });
    g.rect(5, -wallH / 2, 6, 5).fill({ color: warmWindow });
  }

  // Extra upper floor / dormer for level 3 and 4
  if (level >= 3) {
    g.poly([-5, -wallH - 3, 5, -wallH + 3, 0, -wallH - 8]).fill({ color: roofFacet.roof });
    g.circle(0, -wallH - 1, 2).fill({ color: warmWindow });
  }
}

/**
 * Draws the 6 large, unmistakable sector landmark buildings (~1.6x scale) with
 * high architectural fidelity, light direction, stage 3+ height variants, and ruined states.
 */
export function drawSectorBuildingGraphics(
  g: Graphics,
  sectorKind: string,
  level: number,
  ruined: boolean,
  pal: ArcPalette
): void {
  drawDropShadow(g, 42, 21, 0.35);

  const facet = getFacetColors(pal.primary, ruined);
  const roofFacet = getFacetColors(pal.secondary, ruined);
  const wallH = 24 + level * 6;
  const lit = !ruined;
  const warmGlow = lit ? 0xf5b041 : 0x443a30;
  const isGrand = level >= 3;

  if (sectorKind === "food") {
    // 1. FARM: Big red/timber gambrel barn, tall grain silo, crop rows, and windmill
    g.poly([-32, 0, 0, 16, 0, 16 - wallH, -32, -wallH]).fill({ color: facet.left });
    g.poly([0, 16, 28, 2, 28, 2 - wallH, 0, 16 - wallH]).fill({ color: facet.right });
    const peak = -wallH - (isGrand ? 28 : 22);
    g.poly([-34, -wallH, 0, 16 - wallH, -8, peak]).fill({ color: roofFacet.roof });
    g.poly([0, 16 - wallH, 30, 2 - wallH, 12, peak + 3]).fill({ color: roofFacet.right });
    g.poly([-18, 6, -6, 12, -6, 12 - 15, -18, 6 - 15]).fill({ color: facet.trim });

    // Silo (scaled 1.6x, taller in stage 3+)
    const siloH = wallH + (isGrand ? 16 : 9);
    g.rect(30, -siloH, 12, siloH + 8).fill({ color: 0x5a554c });
    g.poly([30, -siloH, 42, -siloH, 36, -siloH - 10]).fill({ color: isGrand ? 0xa89f90 : 0x8a7f70 });

    // Crop Furrows
    g.poly([-48, 3, -34, 10, -40, 18, -54, 10]).fill({ color: 0x4a3c26 });
    g.poly([-46, 6, -34, 12]).stroke({ color: 0x6e9c49, width: 2 });
    g.poly([-49, 10, -37, 16]).stroke({ color: 0x6e9c49, width: 2 });

    // Windmill
    const millPeak = -wallH - (isGrand ? 42 : 36);
    g.rect(-9, millPeak, 6, 18).fill({ color: 0x73634e });
    g.poly([-28, millPeak + 3, 12, millPeak + 15]).stroke({ color: 0xd9cebe, width: 2.4 });
    g.poly([-3, millPeak - 6, -9, millPeak + 24]).stroke({ color: 0xd9cebe, width: 2.4 });
  } else if (sectorKind === "ore") {
    // 2. MINE: Heavy timber-framed shaft entrance, gantry crane, ore cart on rails, rock pile
    g.poly([-35, 0, 0, 17, 35, 0, 0, -24]).fill({ color: 0x3d352b });
    g.poly([-19, 8, -19, -23, 0, -14, 0, 15]).fill({ color: 0x0f0c09 });
    g.poly([-22, 9, -22, -28, 3, -15, 3, 17]).stroke({ color: 0x543e26, width: 4 });
    g.poly([-22, -12, 3, -1]).stroke({ color: 0x6b4f31, width: 3.5 });

    // Tracks & Ore Cart
    g.poly([0, 15, 18, 24]).stroke({ color: 0x6e685f, width: 2.5 });
    g.poly([4, 12, 22, 21]).stroke({ color: 0x6e685f, width: 2.5 });
    g.poly([11, 15, 23, 9, 23, 0, 11, 6]).fill({ color: 0x6e5e48 });
    g.circle(14, 18, 3).fill({ color: 0x1a1612 });
    g.circle(20, 14, 3).fill({ color: 0x1a1612 });
    g.poly([-36, 4, -22, 9, -27, -3]).fill({ color: 0x635749 });
    if (lit) g.circle(-27, 2, 2.5).fill({ color: pal.accent });

    // Grand mine hoist gantry for stage 3+
    if (isGrand) {
      g.poly([0, -24, 0, -42, 16, -34, 16, -16]).stroke({ color: 0x543e26, width: 3 });
      g.circle(8, -38, 4).fill({ color: 0x8a7f70 });
    }
  } else if (sectorKind === "forge") {
    // 3. FORGE: Heavy masonry smithy, huge industrial chimney stack, blazing furnace
    g.poly([-34, 0, 0, 17, 0, 17 - wallH, -34, -wallH]).fill({ color: facet.left });
    g.poly([0, 17, 28, 3, 28, 3 - wallH, 0, 17 - wallH]).fill({ color: facet.right });
    const peak = -wallH - 14;
    g.poly([-37, -wallH, 0, 17 - wallH, 0, peak]).fill({ color: roofFacet.roof });
    g.poly([0, 17 - wallH, 31, 3 - wallH, 0, peak]).fill({ color: roofFacet.right });
    g.poly([-22, 8, -8, 14, -8, 3, -22, -3]).fill({ color: warmGlow });
    if (lit) g.poly([-17, 9, -11, 12, -11, 6, -17, 3]).fill({ color: 0xffe066 });

    // Industrial chimney
    g.rect(15, -wallH - 35, 11, 38).fill({ color: 0x3d3429 }).stroke({ color: 0x1c1712, width: 1.8 });
    if (isGrand) {
      // Second grand chimney stack for stage 3+
      g.rect(3, -wallH - 42, 9, 30).fill({ color: 0x3d3429 }).stroke({ color: 0x1c1712, width: 1.8 });
    }
    g.rect(-15, 12, 6, 4).fill({ color: 0x221d18 });
  } else if (sectorKind === "alchemy") {
    // 4. ALCHEMY: Cylindrical arcane tower, translucent glass dome, coiled pipes
    const towerH = wallH + (isGrand ? 22 : 15);
    g.poly([-22, 0, 0, 11, 0, 11 - towerH, -22, -towerH]).fill({ color: facet.left });
    g.poly([0, 11, 22, 0, 22, -towerH, 0, 11 - towerH]).fill({ color: facet.right });
    g.circle(0, -towerH, 18).fill({ color: lit ? 0x2e594d : 0x24332d }).stroke({ color: 0x5ea38c, width: 2.2 });
    if (lit) {
      g.circle(0, -towerH, 11).fill({ color: pal.accent });
      g.circle(3, -towerH - 3, 4).fill({ color: 0xffffff, alpha: 0.7 });
    }
    g.poly([22, -towerH + 6, 28, -towerH + 14, 22, -towerH + 22]).stroke({ color: 0xb86e37, width: 3 });
  } else if (sectorKind === "harbor") {
    // 5. HARBOR: Timber wharf dock, moored boat hull, cargo crane derrick
    g.poly([-40, 5, 16, 32, 16, 23, -40, -4]).fill({ color: 0x473724 });
    g.poly([-25, -3, 0, 9, 0, 9 - wallH, -25, -wallH - 3]).fill({ color: facet.left });
    g.poly([0, 9, 22, -1, 22, -wallH - 1, 0, 9 - wallH]).fill({ color: facet.right });
    g.poly([-28, -wallH - 3, 0, 9 - wallH, 25, -wallH - 1, 0, -wallH - 14]).fill({ color: roofFacet.roof });
    g.poly([19, 19, 41, 8, 38, 0, 16, 11]).fill({ color: 0x594129 });
    g.rect(27, -12, 3, 19).fill({ color: 0x2e2114 });
    g.poly([-31, 2, -31, -28, -16, -19]).stroke({ color: 0x6e502f, width: 3 });
  } else {
    // 6. TOWER: Tall tapering citadel spire, battlements, glowing arcane apex beacon, pennant
    const spireH = wallH + (isGrand ? 42 : 30);
    g.poly([-19, 0, 0, 9, 0, 9 - spireH, -19, -spireH]).fill({ color: facet.left });
    g.poly([0, 9, 19, 0, 19, -spireH, 0, 9 - spireH]).fill({ color: facet.right });
    g.rect(-22, -spireH - 3, 6, 4).fill({ color: facet.left });
    g.rect(16, -spireH - 3, 6, 4).fill({ color: facet.right });
    const apex = -spireH - (isGrand ? 42 : 36);
    g.poly([-20, -spireH, 0, 9 - spireH, 0, apex]).fill({ color: roofFacet.roof });
    g.poly([0, 9 - spireH, 20, -spireH, 0, apex]).fill({ color: roofFacet.right });
    if (lit) {
      g.poly([0, apex - 9, 5, apex - 3, 0, apex + 3, -5, apex - 3]).fill({ color: pal.accent });
    }
    g.poly([0, apex - 9, 13, apex - 15, 0, apex - 21]).fill({ color: 0xf26868 });
  }

  // Ruined details: broken collapsed silhouette
  if (ruined) {
    g.poly([-9, -wallH - 11, 9, -wallH - 3, 0, -wallH + 9]).fill({ color: 0x0f0d0b });
    g.poly([-15, -wallH - 3, 6, -wallH - 21]).stroke({ color: 0x3d3124, width: 3 });
    g.poly([-11, -wallH - 24, 11, -wallH - 24, 0, -wallH - 14]).fill({ color: 0xf26868 });
  }
}

/**
 * Texture cache for building graphics.
 */
export class BuildingTextureCache {
  private cache = new Map<string, Texture>();
  private renderer: Renderer;

  constructor(renderer: Renderer) {
    this.renderer = renderer;
  }

  getHouseTexture(variant: number, level: number, arcId: string, pal: ArcPalette): Texture {
    const key = `house_v${variant}_lvl${level}_${arcId}`;
    let tex = this.cache.get(key);
    if (!tex) {
      const g = new Graphics();
      drawHouseGraphics(g, variant, level, pal);
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
    arcId: string,
    pal: ArcPalette
  ): Texture {
    const key = `bldg_${sectorKind}_lvl${level}_${ruined ? "ruin" : "ok"}_${arcId}`;
    let tex = this.cache.get(key);
    if (!tex) {
      const g = new Graphics();
      drawSectorBuildingGraphics(g, sectorKind, level, ruined, pal);
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
