/**
 * High-detail procedural isometric buildings, houses (4 variants with level growth),
 * and 6 unmistakable sector landmarks (farm, mine, forge, alchemy, harbor, tower)
 * with ruined variants, drop shadows, and light-direction shading for PixiJS v8.
 */

import { Graphics, type Renderer, type Texture } from "pixi.js";
import type { ArcPalette } from "./sprites-ground.ts";
import { drawDropShadow } from "./sprites-props.ts";

/**
 * Shading helper: Left face lighter, right face darker, roof lightest.
 */
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
 * Draws residential citizen house with 4 distinct architectural variants and stage levels 1-4.
 */
export function drawHouseGraphics(
  g: Graphics,
  variant: number,
  level: number,
  pal: ArcPalette
): void {
  // Soft drop shadow
  drawDropShadow(g, 16 + level * 2, 8 + level, 0.32);

  const wallH = 12 + level * 4;
  const facet = getFacetColors(pal.primary, false);
  const roofFacet = getFacetColors(pal.secondary, false);
  const warmWindow = 0xf5b041; // Warm glowing light

  if (variant === 0) {
    // Gable cottage with stone chimney
    g.poly([-14, 0, 0, 7, 0, 7 - wallH, -14, -wallH]).fill({ color: facet.left });
    g.poly([0, 7, 14, 0, 14, -wallH, 0, 7 - wallH]).fill({ color: facet.right });
    // Roof
    const peak = -wallH - 8 - level * 2;
    g.poly([-16, -wallH, 0, 7 - wallH, 0, peak]).fill({ color: roofFacet.roof });
    g.poly([0, 7 - wallH, 16, -wallH, 0, peak]).fill({ color: roofFacet.right });
    // Door
    g.poly([-8, 3, -4, 5, -4, 5 - 7, -8, 3 - 7]).fill({ color: facet.trim });
    // Lit warm window
    g.poly([4, 1 - wallH / 2, 8, -1 - wallH / 2, 8, -6 - wallH / 2, 4, -4 - wallH / 2]).fill({ color: warmWindow });
    // Chimney
    g.rect(6, peak + 2, 4, 8).fill({ color: 0x3d3023 });
  } else if (variant === 1) {
    // Masonry home with side lean-to wing and dormer window
    g.poly([-16, 0, 0, 8, 0, 8 - wallH, -16, -wallH]).fill({ color: facet.left });
    g.poly([0, 8, 12, 2, 12, 2 - wallH, 0, 8 - wallH]).fill({ color: facet.right });
    // Side lean-to extension
    g.poly([-22, -3, -16, 0, -16, -wallH + 5, -22, -wallH + 2]).fill({ color: facet.left });
    // Roof
    const peak = -wallH - 9;
    g.poly([-18, -wallH, 0, 8 - wallH, 0, peak]).fill({ color: roofFacet.roof });
    g.poly([0, 8 - wallH, 14, 2 - wallH, 0, peak]).fill({ color: roofFacet.right });
    // Double lit windows
    g.rect(-10, -wallH / 2, 4, 4).fill({ color: warmWindow });
    g.rect(3, -wallH / 2, 4, 4).fill({ color: warmWindow });
  } else if (variant === 2) {
    // Tall townhouse with steep pitched roof and dormer
    const tallH = wallH + 5;
    g.poly([-12, 0, 0, 6, 0, 6 - tallH, -12, -tallH]).fill({ color: facet.left });
    g.poly([0, 6, 12, 0, 12, -tallH, 0, 6 - tallH]).fill({ color: facet.right });
    // Steep roof
    const peak = -tallH - 12;
    g.poly([-14, -tallH, 0, 6 - tallH, 0, peak]).fill({ color: roofFacet.roof });
    g.poly([0, 6 - tallH, 14, -tallH, 0, peak]).fill({ color: roofFacet.right });
    // Lit upper & lower windows
    g.rect(3, -tallH + 6, 4, 4).fill({ color: warmWindow });
    g.rect(3, -tallH + 14, 4, 4).fill({ color: warmWindow });
  } else {
    // L-shaped homestead with timber porch canopy
    g.poly([-15, 0, 0, 7, 0, 7 - wallH, -15, -wallH]).fill({ color: facet.left });
    g.poly([0, 7, 15, 0, 15, -wallH, 0, 7 - wallH]).fill({ color: facet.right });
    const peak = -wallH - 8;
    g.poly([-17, -wallH, 0, 7 - wallH, 0, peak]).fill({ color: roofFacet.roof });
    g.poly([0, 7 - wallH, 17, -wallH, 0, peak]).fill({ color: roofFacet.right });
    // Front porch awning
    g.poly([-12, 5, -2, 10, -2, 6, -12, 1]).fill({ color: facet.trim });
    g.rect(4, -wallH / 2, 5, 4).fill({ color: warmWindow });
  }

  // Extra upper floor / dormer for level 3 and 4
  if (level >= 3) {
    g.poly([-4, -wallH - 2, 4, -wallH + 2, 0, -wallH - 6]).fill({ color: roofFacet.roof });
    g.circle(0, -wallH - 1, 1.5).fill({ color: warmWindow });
  }
}

/**
 * Draws the 6 large, unmistakable sector landmark buildings with high detail,
 * light direction, and ruined versions.
 */
export function drawSectorBuildingGraphics(
  g: Graphics,
  sectorKind: string,
  level: number,
  ruined: boolean,
  pal: ArcPalette
): void {
  // 1. Soft drop shadow
  drawDropShadow(g, 28, 14, 0.35);

  const facet = getFacetColors(pal.primary, ruined);
  const roofFacet = getFacetColors(pal.secondary, ruined);
  const wallH = 16 + level * 4;
  const lit = !ruined;
  const warmGlow = lit ? 0xf5b041 : 0x443a30;

  if (sectorKind === "food") {
    // 1. FARM: Big red/timber gambrel barn, tall cylindrical silo, crop rows, and windmill
    // Main Barn
    g.poly([-20, 0, 0, 10, 0, 10 - wallH, -20, -wallH]).fill({ color: facet.left });
    g.poly([0, 10, 18, 1, 18, 1 - wallH, 0, 10 - wallH]).fill({ color: facet.right });
    // Gambrel Barn Roof
    g.poly([-22, -wallH, 0, 10 - wallH, -5, -wallH - 14]).fill({ color: roofFacet.roof });
    g.poly([0, 10 - wallH, 20, 1 - wallH, 8, -wallH - 12]).fill({ color: roofFacet.right });
    // Barn double doors
    g.poly([-12, 4, -4, 8, -4, 8 - 10, -12, 4 - 10]).fill({ color: facet.trim });

    // Round Grain Silo (right side)
    g.rect(19, -wallH - 4, 8, wallH + 6).fill({ color: 0x5a554c });
    g.poly([19, -wallH - 4, 27, -wallH - 4, 23, -wallH - 11]).fill({ color: 0x8a7f70 });

    // Crop Furrows (left side)
    g.poly([-32, 2, -22, 7, -26, 12, -36, 7]).fill({ color: 0x4a3c26 });
    g.poly([-30, 4, -22, 8]).stroke({ color: 0x6e9c49, width: 1.5 });
    g.poly([-32, 7, -24, 11]).stroke({ color: 0x6e9c49, width: 1.5 });

    // Windmill (above barn or rear)
    g.rect(-6, -wallH - 24, 4, 12).fill({ color: 0x73634e });
    // Windmill 4 blades
    g.poly([-18, -wallH - 22, 8, -wallH - 14]).stroke({ color: 0xd9cebe, width: 1.8 });
    g.poly([-2, -wallH - 28, -6, -wallH - 8]).stroke({ color: 0xd9cebe, width: 1.8 });
  } else if (sectorKind === "ore") {
    // 2. MINE: Heavy timber-framed shaft entrance, gantry crane, ore cart on rails, rock pile
    // Stone embankment backdrop
    g.poly([-22, 0, 0, 11, 22, 0, 0, -16]).fill({ color: 0x3d352b });
    // Dark mine portal
    g.poly([-12, 5, -12, -15, 0, -9, 0, 10]).fill({ color: 0x0f0c09 });
    // Heavy timber framing posts
    g.poly([-14, 6, -14, -18, 2, -10, 2, 11]).stroke({ color: 0x543e26, width: 3 });
    g.poly([-14, -8, 2, -1]).stroke({ color: 0x6b4f31, width: 2.5 });

    // Mine tracks extending forward
    g.poly([0, 10, 12, 16]).stroke({ color: 0x6e685f, width: 2 });
    g.poly([3, 8, 15, 14]).stroke({ color: 0x6e685f, width: 2 });
    // Ore Cart
    g.poly([7, 10, 15, 6, 15, 0, 7, 4]).fill({ color: 0x6e5e48 });
    g.circle(9, 12, 2).fill({ color: 0x1a1612 });
    g.circle(13, 9, 2).fill({ color: 0x1a1612 });
    // Glittering ore pile
    g.poly([-24, 3, -15, 6, -18, -2]).fill({ color: 0x635749 });
    if (lit) g.circle(-18, 1, 1.5).fill({ color: pal.accent });
  } else if (sectorKind === "forge") {
    // 3. FORGE: Heavy masonry smithy, huge stone chimney, glowing furnace window, anvil
    g.poly([-22, 0, 0, 11, 0, 11 - wallH, -22, -wallH]).fill({ color: facet.left });
    g.poly([0, 11, 18, 2, 18, 2 - wallH, 0, 11 - wallH]).fill({ color: facet.right });
    // Sloped slate roof
    g.poly([-24, -wallH, 0, 11 - wallH, 0, -wallH - 9]).fill({ color: roofFacet.roof });
    g.poly([0, 11 - wallH, 20, 2 - wallH, 0, -wallH - 9]).fill({ color: roofFacet.right });
    // Large glowing furnace mouth
    g.poly([-14, 5, -5, 9, -5, 2, -14, -2]).fill({ color: warmGlow });
    if (lit) g.poly([-11, 6, -7, 8, -7, 4, -11, 2]).fill({ color: 0xffe066 });
    // Industrial chimney stack
    g.rect(10, -wallH - 22, 7, 24).fill({ color: 0x3d3429 }).stroke({ color: 0x1c1712, width: 1.2 });
    // Blacksmith anvil outside
    g.rect(-10, 8, 4, 3).fill({ color: 0x221d18 });
  } else if (sectorKind === "alchemy") {
    // 4. ALCHEMY: Cylindrical arcane tower, glass observation dome, bubbling vat, coiled pipes
    const towerH = wallH + 10;
    g.poly([-14, 0, 0, 7, 0, 7 - towerH, -14, -towerH]).fill({ color: facet.left });
    g.poly([0, 7, 14, 0, 14, -towerH, 0, 7 - towerH]).fill({ color: facet.right });
    // Glass dome
    g.circle(0, -towerH, 12).fill({ color: lit ? 0x2e594d : 0x24332d }).stroke({ color: 0x5ea38c, width: 1.5 });
    if (lit) {
      g.circle(0, -towerH, 7).fill({ color: pal.accent });
      g.circle(2, -towerH - 2, 2.5).fill({ color: 0xffffff, alpha: 0.7 });
    }
    // Copper condenser spiral pipe
    g.poly([14, -towerH + 4, 18, -towerH + 9, 14, -towerH + 14]).stroke({ color: 0xb86e37, width: 2 });
  } else if (sectorKind === "harbor") {
    // 5. HARBOR: Timber wharf dock, moored boat with mast, cargo crane derrick
    // Broad wooden wharf pier
    g.poly([-26, 3, 10, 21, 10, 15, -26, -3]).fill({ color: 0x473724 });
    // Shed warehouse
    g.poly([-16, -2, 0, 6, 0, 6 - wallH, -16, -wallH - 2]).fill({ color: facet.left });
    g.poly([0, 6, 14, -1, 14, -wallH - 1, 0, 6 - wallH]).fill({ color: facet.right });
    g.poly([-18, -wallH - 2, 0, 6 - wallH, 16, -wallH - 1, 0, -wallH - 9]).fill({ color: roofFacet.roof });
    // Moored cargo boat
    g.poly([12, 12, 26, 5, 24, 0, 10, 7]).fill({ color: 0x594129 });
    // Boat mast
    g.rect(17, -8, 2, 12).fill({ color: 0x2e2114 });
    // Dockside crane
    g.poly([-20, 1, -20, -18, -10, -12]).stroke({ color: 0x6e502f, width: 2 });
  } else {
    // 6. TOWER (sector 5): Tall tapering citadel spire, battlements, glowing arcane beacon, pennant
    const spireH = wallH + 20;
    g.poly([-12, 0, 0, 6, 0, 6 - spireH, -12, -spireH]).fill({ color: facet.left });
    g.poly([0, 6, 12, 0, 12, -spireH, 0, 6 - spireH]).fill({ color: facet.right });
    // Battlements
    g.rect(-14, -spireH - 2, 4, 3).fill({ color: facet.left });
    g.rect(10, -spireH - 2, 4, 3).fill({ color: facet.right });
    // Steep spire
    const apex = -spireH - 24;
    g.poly([-13, -spireH, 0, 6 - spireH, 0, apex]).fill({ color: roofFacet.roof });
    g.poly([0, 6 - spireH, 13, -spireH, 0, apex]).fill({ color: roofFacet.right });
    // Arcane beacon gem at apex
    if (lit) {
      g.poly([0, apex - 6, 3, apex - 2, 0, apex + 2, -3, apex - 2]).fill({ color: pal.accent });
    }
    // Pennant flag waving
    g.poly([0, apex - 6, 8, apex - 10, 0, apex - 14]).fill({ color: 0xf26868 });
  }

  // Ruined details: broken roof gap, leaning beams, grey dust
  if (ruined) {
    // Broken roof gap showing interior dark void
    g.poly([-6, -wallH - 7, 6, -wallH - 2, 0, -wallH + 6]).fill({ color: 0x0f0d0b });
    // Leaning splintered timber beam
    g.poly([-10, -wallH - 2, 4, -wallH - 14]).stroke({ color: 0x3d3124, width: 2.2 });
    // Red structural collapsed marker
    g.poly([-7, -wallH - 16, 7, -wallH - 16, 0, -wallH - 9]).fill({ color: 0xf26868 });
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
