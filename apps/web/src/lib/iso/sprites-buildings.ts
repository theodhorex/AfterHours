/**
 * Procedural isometric buildings, citizen houses (arc-specific shapes, mushroom-caps for goblins),
 * and 6 sector landmarks with 1px dark outlines, flat tone steps, and winter snow caps for PixiJS v8.
 */

import { Graphics, type Renderer, type Texture } from "pixi.js";
import type { ArcPalette } from "./sprites-ground.ts";
import { drawDropShadow } from "./sprites-props.ts";
import { shade, outlineColor, getTheme, type ThemeTokens } from "./theme.ts";

function getFacetColors(base: number, ruined: boolean) {
  if (ruined) {
    return {
      left: 0x3d352c,
      right: 0x241e17,
      roof: 0x42382c,
      trim: 0x16120e,
    };
  }
  // 3-4 flat tone steps: top light, left mid, right dark, trim darkest
  return {
    left: shade(base, 1.0),
    right: shade(base, 0.72),
    roof: shade(base, 1.25),
    trim: outlineColor(base),
  };
}

/**
 * Draws residential citizen house with arc-specific architectural shapes.
 * Goblin Warrens features mushroom-cap cottages and subterranean cave huts.
 */
export function drawHouseGraphics(
  g: Graphics,
  variant: number,
  level: number,
  pal: ArcPalette | ThemeTokens,
  season = 0
): void {
  drawDropShadow(g, 21 + level * 2, 10 + level, 0.35);

  const theme = "treeStyle" in pal ? pal : getTheme("goblin_warrens", season);
  const isGoblin = theme.arcId === "goblin_warrens";
  const hasSnow = theme.hasSnowCaps;
  const wallH = 16 + level * 5;
  const facet = getFacetColors(pal.primary, false);
  const roofFacet = getFacetColors(pal.secondary, false);
  const warmWindow = "building" in theme ? theme.building.windowLit : 0xf59e0b;

  const roofCol = hasSnow ? 0xf0f8ff : roofFacet.roof;
  const roofDarkCol = hasSnow ? 0xd0e0ea : roofFacet.right;
  const roofOutline = outlineColor(roofCol);
  const wallOutline = outlineColor(facet.left);

  if (isGoblin && (variant === 0 || variant === 2)) {
    // Goblin Warrens: Mushroom-cap cottage with domed fungal roof
    g.poly([-16, 0, 0, 8, 0, 8 - wallH, -16, -wallH])
      .fill({ color: facet.left })
      .stroke({ color: wallOutline, width: 1 });
    g.poly([0, 8, 16, 0, 16, -wallH, 0, 8 - wallH])
      .fill({ color: facet.right })
      .stroke({ color: wallOutline, width: 1 });

    // Domed mushroom cap roof
    const capH = wallH + 12 + level * 2;
    g.ellipse(0, -capH, 20, 12)
      .fill({ color: roofCol })
      .stroke({ color: roofOutline, width: 1 });
    // Cap spots (poisonous fungal spots)
    g.circle(-7, -capH - 2, 2.5).fill({ color: hasSnow ? 0xd0e8f5 : 0xf59e0b });
    g.circle(7, -capH + 1, 2).fill({ color: hasSnow ? 0xd0e8f5 : 0xf59e0b });
    g.circle(0, -capH - 5, 2).fill({ color: hasSnow ? 0xd0e8f5 : 0xf59e0b });

    // Round lit window with torch glow
    g.circle(5, -wallH / 2, 3)
      .fill({ color: warmWindow })
      .stroke({ color: outlineColor(warmWindow), width: 0.75 });
    // Chimney emitting purple smoke
    g.rect(-10, -capH - 6, 4, 8).fill({ color: 0x2d1f33 }).stroke({ color: 0x180f1c, width: 1 });
  } else if (isGoblin && (variant === 1 || variant === 3)) {
    // Goblin Warrens: Cave-hut sprite with timber stilts and lantern post
    g.poly([-18, 0, 0, 9, 0, 9 - wallH, -18, -wallH])
      .fill({ color: facet.left })
      .stroke({ color: wallOutline, width: 1 });
    g.poly([0, 9, 18, 0, 18, -wallH, 0, 9 - wallH])
      .fill({ color: facet.right })
      .stroke({ color: wallOutline, width: 1 });
    const peak = -wallH - 10;
    g.poly([-20, -wallH, 0, 9 - wallH, 0, peak])
      .fill({ color: roofCol })
      .stroke({ color: roofOutline, width: 1 });
    g.poly([0, 9 - wallH, 20, -wallH, 0, peak])
      .fill({ color: roofDarkCol })
      .stroke({ color: roofOutline, width: 1 });

    // Lit window
    g.rect(4, -wallH / 2 - 2, 6, 5)
      .fill({ color: warmWindow })
      .stroke({ color: outlineColor(warmWindow), width: 0.75 });

    // Lantern post
    g.rect(-22, -6, 2, 10).fill({ color: 0x1a1410 });
    g.circle(-21, -8, 2.5).fill({ color: warmWindow });
  } else if (variant === 0) {
    // Gable cottage
    g.poly([-18, 0, 0, 9, 0, 9 - wallH, -18, -wallH]).fill({ color: facet.left }).stroke({ color: wallOutline, width: 1 });
    g.poly([0, 9, 18, 0, 18, -wallH, 0, 9 - wallH]).fill({ color: facet.right }).stroke({ color: wallOutline, width: 1 });
    const peak = -wallH - 11 - level * 2;
    g.poly([-20, -wallH, 0, 9 - wallH, 0, peak]).fill({ color: roofCol }).stroke({ color: roofOutline, width: 1 });
    g.poly([0, 9 - wallH, 20, -wallH, 0, peak]).fill({ color: roofDarkCol }).stroke({ color: roofOutline, width: 1 });
    g.rect(5, -wallH / 2, 5, 5).fill({ color: warmWindow }).stroke({ color: outlineColor(warmWindow), width: 0.75 });
    g.rect(8, peak + 3, 5, 10).fill({ color: 0x2b221a });
  } else if (variant === 1) {
    // Masonry home with dormer
    g.poly([-20, 0, 0, 10, 0, 10 - wallH, -20, -wallH]).fill({ color: facet.left }).stroke({ color: wallOutline, width: 1 });
    g.poly([0, 10, 16, 2, 16, 2 - wallH, 0, 10 - wallH]).fill({ color: facet.right }).stroke({ color: wallOutline, width: 1 });
    const peak = -wallH - 12;
    g.poly([-22, -wallH, 0, 10 - wallH, 0, peak]).fill({ color: roofCol }).stroke({ color: roofOutline, width: 1 });
    g.poly([0, 10 - wallH, 18, 2 - wallH, 0, peak]).fill({ color: roofDarkCol }).stroke({ color: roofOutline, width: 1 });
    g.rect(4, -wallH / 2, 5, 5).fill({ color: warmWindow }).stroke({ color: outlineColor(warmWindow), width: 0.75 });
  } else if (variant === 2) {
    // Tall townhouse
    const tallH = wallH + 7;
    g.poly([-16, 0, 0, 8, 0, 8 - tallH, -16, -tallH]).fill({ color: facet.left }).stroke({ color: wallOutline, width: 1 });
    g.poly([0, 8, 16, 0, 16, -tallH, 0, 8 - tallH]).fill({ color: facet.right }).stroke({ color: wallOutline, width: 1 });
    const peak = -tallH - 15;
    g.poly([-18, -tallH, 0, 8 - tallH, 0, peak]).fill({ color: roofCol }).stroke({ color: roofOutline, width: 1 });
    g.poly([0, 8 - tallH, 18, -tallH, 0, peak]).fill({ color: roofDarkCol }).stroke({ color: roofOutline, width: 1 });
    g.rect(4, -tallH + 12, 5, 5).fill({ color: warmWindow }).stroke({ color: outlineColor(warmWindow), width: 0.75 });
  } else {
    // Homestead with porch
    g.poly([-19, 0, 0, 9, 0, 9 - wallH, -19, -wallH]).fill({ color: facet.left }).stroke({ color: wallOutline, width: 1 });
    g.poly([0, 9, 19, 0, 19, -wallH, 0, 9 - wallH]).fill({ color: facet.right }).stroke({ color: wallOutline, width: 1 });
    const peak = -wallH - 11;
    g.poly([-21, -wallH, 0, 9 - wallH, 0, peak]).fill({ color: roofCol }).stroke({ color: roofOutline, width: 1 });
    g.poly([0, 9 - wallH, 21, -wallH, 0, peak]).fill({ color: roofDarkCol }).stroke({ color: roofOutline, width: 1 });
    g.rect(5, -wallH / 2, 6, 5).fill({ color: warmWindow }).stroke({ color: outlineColor(warmWindow), width: 0.75 });
  }

  // Extra upper dormer for stage growth (level >= 3)
  if (level >= 3) {
    g.poly([-5, -wallH - 3, 5, -wallH + 3, 0, -wallH - 8]).fill({ color: roofCol }).stroke({ color: roofOutline, width: 1 });
    g.circle(0, -wallH - 1, 2).fill({ color: warmWindow });
  }
}

/**
 * Draws the 6 large sector landmarks with 1px dark outlines, flat 3-4 tone steps,
 * and arc/season variants.
 */
export function drawSectorBuildingGraphics(
  g: Graphics,
  sectorKind: string,
  level: number,
  ruined: boolean,
  pal: ArcPalette | ThemeTokens,
  season = 0
): void {
  drawDropShadow(g, 42, 21, 0.38);

  const theme = "treeStyle" in pal ? pal : getTheme("goblin_warrens", season);
  const facet = getFacetColors(pal.primary, ruined);
  const roofFacet = getFacetColors(pal.secondary, ruined);
  const wallH = 24 + level * 6;
  const lit = !ruined;
  const warmGlow = lit ? ("building" in theme ? theme.building.windowLit : 0xf59e0b) : 0x2a221a;
  const hasSnow = !ruined && theme.hasSnowCaps;
  const isGrand = level >= 3;

  const roofCol = hasSnow ? 0xf0f8ff : roofFacet.roof;
  const roofDarkCol = hasSnow ? 0xd0e0ea : roofFacet.right;
  const roofOutline = outlineColor(roofCol);
  const wallOutline = outlineColor(facet.left);

  if (sectorKind === "food") {
    // 1. FARM: Gambrel barn, grain silo, crop rows, windmill
    g.poly([-32, 0, 0, 16, 0, 16 - wallH, -32, -wallH]).fill({ color: facet.left }).stroke({ color: wallOutline, width: 1 });
    g.poly([0, 16, 28, 2, 28, 2 - wallH, 0, 16 - wallH]).fill({ color: facet.right }).stroke({ color: wallOutline, width: 1 });
    const peak = -wallH - (isGrand ? 28 : 22);
    g.poly([-34, -wallH, 0, 16 - wallH, -8, peak]).fill({ color: roofCol }).stroke({ color: roofOutline, width: 1 });
    g.poly([0, 16 - wallH, 30, 2 - wallH, 12, peak + 3]).fill({ color: roofDarkCol }).stroke({ color: roofOutline, width: 1 });

    // Silo
    const siloH = wallH + (isGrand ? 16 : 9);
    g.rect(30, -siloH, 12, siloH + 8).fill({ color: 0x4a453d }).stroke({ color: 0x221e1a, width: 1 });
    g.poly([30, -siloH, 42, -siloH, 36, -siloH - 10]).fill({ color: hasSnow ? 0xf0f8ff : 0x8a7f70 }).stroke({ color: 0x221e1a, width: 1 });

    // Crop Furrows
    g.poly([-48, 3, -34, 10, -40, 18, -54, 10]).fill({ color: 0x3d2f1d });
    g.poly([-46, 6, -34, 12]).stroke({ color: hasSnow ? 0xd8edf5 : 0x5a8a3c, width: 2 });

    // Windmill
    const millPeak = -wallH - (isGrand ? 42 : 36);
    g.rect(-9, millPeak, 6, 18).fill({ color: 0x5a4835 }).stroke({ color: 0x221a12, width: 1 });
    g.poly([-28, millPeak + 3, 12, millPeak + 15]).stroke({ color: 0xd9cebe, width: 2.2 });
    g.poly([-3, millPeak - 6, -9, millPeak + 24]).stroke({ color: 0xd9cebe, width: 2.2 });
  } else if (sectorKind === "ore") {
    // 2. MINE: Timber shaft headframe, ore cart, rock mound
    g.poly([-35, 0, 0, 17, 35, 0, 0, -24]).fill({ color: 0x332b22 }).stroke({ color: 0x1a1510, width: 1 });
    g.poly([-19, 8, -19, -23, 0, -14, 0, 15]).fill({ color: 0x080604 });
    g.poly([-22, 9, -22, -28, 3, -15, 3, 17]).stroke({ color: 0x4a341e, width: 3.5 });

    // Tracks & Ore Cart
    g.poly([0, 15, 18, 24]).stroke({ color: 0x555047, width: 2.5 });
    g.poly([4, 12, 22, 21]).stroke({ color: 0x555047, width: 2.5 });
    g.poly([11, 15, 23, 9, 23, 0, 11, 6]).fill({ color: 0x594a36 }).stroke({ color: 0x221a12, width: 1 });
    if (lit) g.circle(-27, 2, 2.5).fill({ color: pal.accent });
  } else if (sectorKind === "forge") {
    // 3. FORGE: Heavy smithy, industrial chimney stack, blazing furnace mouth
    g.poly([-34, 0, 0, 17, 0, 17 - wallH, -34, -wallH]).fill({ color: facet.left }).stroke({ color: wallOutline, width: 1 });
    g.poly([0, 17, 28, 3, 28, 3 - wallH, 0, 17 - wallH]).fill({ color: facet.right }).stroke({ color: wallOutline, width: 1 });
    const peak = -wallH - 14;
    g.poly([-37, -wallH, 0, 17 - wallH, 0, peak]).fill({ color: roofCol }).stroke({ color: roofOutline, width: 1 });
    g.poly([0, 17 - wallH, 31, 3 - wallH, 0, peak]).fill({ color: roofDarkCol }).stroke({ color: roofOutline, width: 1 });
    g.poly([-22, 8, -8, 14, -8, 3, -22, -3]).fill({ color: warmGlow });
    if (lit) g.poly([-17, 9, -11, 12, -11, 6, -17, 3]).fill({ color: 0xffd54f });

    // Industrial chimney
    g.rect(15, -wallH - 35, 11, 38).fill({ color: 0x2d241c }).stroke({ color: 0x140e09, width: 1.5 });
    if (isGrand) {
      g.rect(3, -wallH - 42, 9, 30).fill({ color: 0x2d241c }).stroke({ color: 0x140e09, width: 1.5 });
    }
  } else if (sectorKind === "alchemy") {
    // 4. ALCHEMY: Arcane tower, observation dome, alchemical piping
    const towerH = wallH + (isGrand ? 22 : 15);
    g.poly([-22, 0, 0, 11, 0, 11 - towerH, -22, -towerH]).fill({ color: facet.left }).stroke({ color: wallOutline, width: 1 });
    g.poly([0, 11, 22, 0, 22, -towerH, 0, 11 - towerH]).fill({ color: facet.right }).stroke({ color: wallOutline, width: 1 });
    g.circle(0, -towerH, 18).fill({ color: lit ? 0x224239 : 0x192420 }).stroke({ color: 0x4d8a75, width: 2 });
    if (lit) {
      g.circle(0, -towerH, 11).fill({ color: pal.accent });
    }
    g.poly([22, -towerH + 6, 28, -towerH + 14, 22, -towerH + 22]).stroke({ color: 0x9c592b, width: 2.5 });
  } else if (sectorKind === "harbor") {
    // 5. HARBOR: Timber wharf dock, moored boat hull, cargo crane derrick
    g.poly([-40, 5, 16, 32, 16, 23, -40, -4]).fill({ color: 0x3d2f1f }).stroke({ color: 0x1a130b, width: 1 });
    g.poly([-25, -3, 0, 9, 0, 9 - wallH, -25, -wallH - 3]).fill({ color: facet.left }).stroke({ color: wallOutline, width: 1 });
    g.poly([0, 9, 22, -1, 22, -wallH - 1, 0, 9 - wallH]).fill({ color: facet.right }).stroke({ color: wallOutline, width: 1 });
    g.poly([-28, -wallH - 3, 0, 9 - wallH, 25, -wallH - 1, 0, -wallH - 14]).fill({ color: roofCol }).stroke({ color: roofOutline, width: 1 });
    g.poly([19, 19, 41, 8, 38, 0, 16, 11]).fill({ color: 0x4d3822 }).stroke({ color: 0x1a130b, width: 1 });
    g.poly([-31, 2, -31, -28, -16, -19]).stroke({ color: 0x5a4023, width: 2.5 });
  } else {
    // 6. TOWER: Citadel spire, battlements, arcane beacon
    const spireH = wallH + (isGrand ? 42 : 30);
    g.poly([-19, 0, 0, 9, 0, 9 - spireH, -19, -spireH]).fill({ color: facet.left }).stroke({ color: wallOutline, width: 1 });
    g.poly([0, 9, 19, 0, 19, -spireH, 0, 9 - spireH]).fill({ color: facet.right }).stroke({ color: wallOutline, width: 1 });
    const apex = -spireH - (isGrand ? 42 : 36);
    g.poly([-20, -spireH, 0, 9 - spireH, 0, apex]).fill({ color: roofCol }).stroke({ color: roofOutline, width: 1 });
    g.poly([0, 9 - spireH, 20, -spireH, 0, apex]).fill({ color: roofDarkCol }).stroke({ color: roofOutline, width: 1 });
    if (lit) {
      g.poly([0, apex - 9, 5, apex - 3, 0, apex + 3, -5, apex - 3]).fill({ color: pal.accent });
    }
  }

  // Tier roof architecture and crowning crests (tier 0..3 -> level 1..4)
  if (!ruined && level >= 2) {
    // Tier 1+: Decorative ridge trim
    g.poly([-10, -wallH - 6, 10, -wallH - 6]).stroke({ color: roofOutline, width: 1.5 });
  }
  if (!ruined && level >= 3) {
    // Tier 2+: Grand dormer pediment and lit attic rose window
    g.poly([-5, -wallH - 10, 5, -wallH - 10, 0, -wallH - 16])
      .fill({ color: roofCol })
      .stroke({ color: roofOutline, width: 1 });
    g.circle(0, -wallH - 11, 2).fill({ color: warmGlow });
  }
  if (!ruined && level >= 4) {
    // Tier 3: Monumental gilded roof finial & weather vane
    g.poly([0, -wallH - 22, 0, -wallH - 32]).stroke({ color: 0xffe066, width: 2 });
    g.circle(0, -wallH - 33, 2.5).fill({ color: 0xffd54f }).stroke({ color: 0x8a6f1c, width: 1 });
  }

  // Ruined details
  if (ruined) {
    g.poly([-9, -wallH - 11, 9, -wallH - 3, 0, -wallH + 9]).fill({ color: 0x0a0806 });
    g.poly([-15, -wallH - 3, 6, -wallH - 21]).stroke({ color: 0x2b2218, width: 2.5 });
  }
}

/**
 * Texture cache for building graphics with nearest-neighbour scaling.
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
    const key = `house_v${variant}_lvl${level}_${arcId}_s${season}`;
    let tex = this.cache.get(key);
    if (!tex) {
      const g = new Graphics();
      const theme = getTheme(arcId, season);
      drawHouseGraphics(g, variant, level, theme, season);
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

  getBuildingTexture(
    sectorKind: string,
    level: number,
    ruined: boolean,
    arcId: string,
    pal: ArcPalette,
    season = 0
  ): Texture {
    const key = `bldg_${sectorKind}_lvl${level}_${ruined ? "ruin" : "ok"}_${arcId}_s${season}`;
    let tex = this.cache.get(key);
    if (!tex) {
      const g = new Graphics();
      const theme = getTheme(arcId, season);
      drawSectorBuildingGraphics(g, sectorKind, level, ruined, theme, season);
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
