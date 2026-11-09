/**
 * Procedural isometric props, shaded pixel-art trees (mushrooms, crystals, ferns, great trees),
 * small props (bushes, boulders, fences, lamp posts, wells, barrels, crates),
 * stalls, and actors with selective dark outlines and nearest-neighbour scaling.
 */

import { Graphics, type Renderer, type Texture } from "pixi.js";
import type { ArcPalette } from "./sprites-ground.ts";
import { shade, outlineColor, getTheme, type ThemeTokens } from "./theme.ts";
import { drawSurfaceToGraphics } from "./prop-helpers.ts";
import { bakeTreePixels } from "./prop-trees.ts";
import {
  SMALL_PROP_KINDS,
  bakeSmallPropPixels,
  drawSmallPropGraphics,
  type SmallPropKind,
} from "./prop-small.ts";

export { SMALL_PROP_KINDS, drawSmallPropGraphics, type SmallPropKind };

export function drawDropShadow(g: Graphics, rx = 12, ry = 6, alpha = 0.25): void {
  g.ellipse(0, 0, rx, ry).fill({ color: 0x162238, alpha });
}

export interface ElfTreeFoliage {
  color: number;
  highlightColor: number;
  shadowColor: number;
  isBlossom: boolean;
  isAutumnGold: boolean;
  sortName:
    | "green_broadleaf"
    | "pink_blossom"
    | "elder_broadleaf"
    | "autumn_gold"
    | "frost_evergreen";
}

/**
 * Returns tree foliage color, blossom flag, and sort name for Elf Grove.
 * Mixes 3 sorts: green broadleaf, pink blossom ONLY in spring, gold in autumn, plain green other seasons.
 */
export function getElfTreeFoliage(sort: number, season: number): ElfTreeFoliage {
  const normSort = ((Math.floor(sort) % 3) + 3) % 3;
  const seasonIdx = ((Math.floor(season) % 4) + 4) % 4;

  if (seasonIdx === 0) {
    if (normSort === 1) {
      const color = 0xf472b6;
      return {
        color,
        highlightColor: 0xfbcfe8,
        shadowColor: 0xdb2777,
        isBlossom: true,
        isAutumnGold: false,
        sortName: "pink_blossom",
      };
    }
    if (normSort === 2) {
      const color = 0x48bb78;
      return {
        color,
        highlightColor: shade(color, 1.2),
        shadowColor: shade(color, 0.8),
        isBlossom: false,
        isAutumnGold: false,
        sortName: "elder_broadleaf",
      };
    }
    const color = 0x2d6a4f;
    return {
      color,
      highlightColor: shade(color, 1.2),
      shadowColor: shade(color, 0.8),
      isBlossom: false,
      isAutumnGold: false,
      sortName: "green_broadleaf",
    };
  }

  if (seasonIdx === 1) {
    const greens = [0x2d6a4f, 0x38a050, 0x40916c];
    const color = greens[normSort];
    return {
      color,
      highlightColor: shade(color, 1.2),
      shadowColor: shade(color, 0.8),
      isBlossom: false,
      isAutumnGold: false,
      sortName: normSort === 0 ? "green_broadleaf" : "elder_broadleaf",
    };
  }

  if (seasonIdx === 2) {
    const golds = [0xeab308, 0xf59e0b, 0xd97706];
    const color = golds[normSort];
    return {
      color,
      highlightColor: shade(color, 1.2),
      shadowColor: shade(color, 0.8),
      isBlossom: false,
      isAutumnGold: true,
      sortName: "autumn_gold",
    };
  }

  const color = 0x8ca89a;
  return {
    color,
    highlightColor: shade(color, 1.2),
    shadowColor: shade(color, 0.8),
    isBlossom: false,
    isAutumnGold: false,
    sortName: "frost_evergreen",
  };
}

function resolveArcId(pal: ArcPalette | ThemeTokens): string {
  if ("arcId" in pal && typeof pal.arcId === "string") return pal.arcId;
  if ("treeStyle" in pal) {
    if (pal.treeStyle === "crystal") return "cave_hold";
    if (pal.treeStyle === "fern") return "dino_vale";
    if (pal.treeStyle === "great_tree") return "elf_grove";
  }
  return "goblin_warrens";
}

/**
 * Draws shaded pixel-art arc-specific tree (3 variants per arc, 5-6 step hue-shifted canopy ramp,
 * dithered edge clumps, outlined trunk, and soft blue-tinted ground shadow ellipse).
 */
export function drawTreeGraphics(
  g: Graphics,
  treeType: number,
  pal: ArcPalette | ThemeTokens,
  season = 0
): void {
  const arcId = resolveArcId(pal);
  const sIdx = "seasonIndex" in pal ? pal.seasonIndex : season;
  const baked = bakeTreePixels(treeType, arcId, sIdx);
  drawSurfaceToGraphics(g, baked);
}

export function drawBushGraphics(
  g: Graphics,
  pal: ArcPalette | ThemeTokens,
  variant = 0,
  season = 0
): void {
  drawSurfaceToGraphics(g, bakeSmallPropPixels("bush", resolveArcId(pal), variant, season));
}

export function drawBoulderGraphics(
  g: Graphics,
  pal: ArcPalette | ThemeTokens,
  variant = 0,
  season = 0
): void {
  drawSurfaceToGraphics(g, bakeSmallPropPixels("boulder", resolveArcId(pal), variant, season));
}

export function drawFenceGraphics(
  g: Graphics,
  pal: ArcPalette | ThemeTokens,
  variant = 0,
  season = 0
): void {
  drawSurfaceToGraphics(g, bakeSmallPropPixels("fence", resolveArcId(pal), variant, season));
}

export function drawLampPostGraphics(
  g: Graphics,
  pal: ArcPalette | ThemeTokens,
  variant = 0,
  season = 0
): void {
  drawSurfaceToGraphics(g, bakeSmallPropPixels("lamp_post", resolveArcId(pal), variant, season));
}

export function drawWellGraphics(
  g: Graphics,
  pal: ArcPalette | ThemeTokens,
  variant = 0,
  season = 0
): void {
  drawSurfaceToGraphics(g, bakeSmallPropPixels("well", resolveArcId(pal), variant, season));
}

export function drawBarrelGraphics(
  g: Graphics,
  pal: ArcPalette | ThemeTokens,
  variant = 0,
  season = 0
): void {
  drawSurfaceToGraphics(g, bakeSmallPropPixels("barrel", resolveArcId(pal), variant, season));
}

export function drawCrateGraphics(
  g: Graphics,
  pal: ArcPalette | ThemeTokens,
  variant = 0,
  season = 0
): void {
  drawSurfaceToGraphics(g, bakeSmallPropPixels("crate", resolveArcId(pal), variant, season));
}

/**
 * Draws district supporting buildings with 1px dark outlines.
 */
export function drawSupportingBuildingGraphics(
  g: Graphics,
  kind: string,
  pal: ArcPalette
): void {
  drawDropShadow(g, 16, 8, 0.25);
  const wallCol = pal.primary;
  const roofCol = pal.secondary;
  const wallBorder = outlineColor(wallCol);
  const roofBorder = outlineColor(roofCol);

  if (kind === "barn") {
    g.poly([-12, 0, 0, 6, 0, -10, -12, -16]).fill({ color: wallCol }).stroke({ color: wallBorder, width: 1 });
    g.poly([0, 6, 12, 0, 12, -16, 0, -10]).fill({ color: shade(wallCol, 0.75) }).stroke({ color: wallBorder, width: 1 });
    g.poly([-14, -16, 0, -10, 0, -20]).fill({ color: roofCol }).stroke({ color: roofBorder, width: 1 });
    g.poly([0, -10, 14, -16, 0, -20]).fill({ color: shade(roofCol, 0.75) }).stroke({ color: roofBorder, width: 1 });
  } else if (kind === "workshop" || kind === "alembic_shed") {
    g.poly([-10, 0, 0, 5, 0, -10, -10, -15]).fill({ color: 0x4a453d }).stroke({ color: 0x221e1a, width: 1 });
    g.poly([0, 5, 10, 0, 10, -15, 0, -10]).fill({ color: 0x332f29 }).stroke({ color: 0x221e1a, width: 1 });
    g.poly([-11, -15, 0, -10, 11, -15, 0, -19]).fill({ color: 0x1f1a14 }).stroke({ color: 0x0f0c09, width: 1 });
    g.rect(4, -22, 3, 9).fill({ color: 0x261f17 });
  } else {
    g.poly([-10, 0, 0, 5, 0, -9, -10, -14]).fill({ color: wallCol }).stroke({ color: wallBorder, width: 1 });
    g.poly([0, 5, 10, 0, 10, -9, 0, -5]).fill({ color: shade(wallCol, 0.75) }).stroke({ color: wallBorder, width: 1 });
    g.poly([-11, -14, 0, -9, 11, -14, 0, -17]).fill({ color: roofCol }).stroke({ color: roofBorder, width: 1 });
  }
}

/**
 * Draws market stall with striped awning and 1px dark outlines.
 */
export function drawMarketStallGraphics(
  g: Graphics,
  itemId: string,
  pal: ArcPalette
): void {
  void itemId;
  drawDropShadow(g, 12, 6, 0.25);
  g.poly([-8, 0, 0, 4, 8, 0, 0, -4]).fill({ color: 0x423120 }).stroke({ color: 0x1c140c, width: 1 });
  g.rect(-7, -10, 1.5, 10).fill({ color: 0x22180e });
  g.rect(6, -10, 1.5, 10).fill({ color: 0x22180e });
  g.poly([-10, -10, 0, -6, 10, -10, 0, -14]).fill({ color: pal.primary }).stroke({ color: outlineColor(pal.primary), width: 1 });
  g.poly([-5, -8, 0, -6, 5, -8, 0, -11]).fill({ color: pal.accent });
  g.poly([-3, 1, 1, 3, 3, 1, -1, -1]).fill({ color: 0x7a6042 });
}

/**
 * Draws rural features (farmland, orchard, fence, well, pond, etc.).
 */
export function drawRuralFeatureGraphics(
  g: Graphics,
  kind: string,
  pal: ArcPalette
): void {
  if (kind === "farmland") {
    g.poly([-14, 0, 0, 7, 14, 0, 0, -7]).fill({ color: 0x3a2c1a }).stroke({ color: 0x1a1309, width: 1 });
    g.poly([-10, 1, 0, 5, 10, 1]).stroke({ color: pal.grass, width: 1.5 });
  } else if (kind === "bone_fences" || kind === "fence") {
    drawFenceGraphics(g, pal);
  } else if (kind === "eggs" || kind === "nests") {
    g.ellipse(0, 0, 9, 5).fill({ color: 0x5c4224 });
    g.ellipse(-3, -2, 2.5, 3.5).fill({ color: 0xfef9c3 }).stroke({ color: 0xca8a04, width: 0.5 });
    g.ellipse(3, -2, 2.5, 3.5).fill({ color: 0xfef9c3 }).stroke({ color: 0xca8a04, width: 0.5 });
  } else if (kind === "ore_carts") {
    drawDropShadow(g, 8, 4, 0.25);
    g.rect(-6, -7, 12, 5).fill({ color: 0x334455 }).stroke({ color: 0x1e293b, width: 1 });
    g.circle(-4, -2, 2).fill({ color: 0x0f172a });
    g.circle(4, -2, 2).fill({ color: 0x0f172a });
    g.circle(0, -8, 2.5).fill({ color: 0x38bdf8 });
  } else if (kind === "mine_entrances") {
    g.poly([-12, 0, 0, 6, 12, 0, 0, -6]).fill({ color: 0x1e293b });
    g.poly([-10, 0, 0, -18, 10, 0]).stroke({ color: 0x5a4225, width: 3 });
  } else if (kind === "rope_bridges") {
    g.poly([-14, -2, 0, 4, 14, -2]).stroke({ color: 0x92400e, width: 1.5 });
    g.poly([-14, -8, 0, -3, 14, -8]).stroke({ color: 0xb45309, width: 1.5 });
  } else if (kind === "flower_beds") {
    g.ellipse(0, 0, 8, 4).fill({ color: 0x1b4332 });
    g.circle(-3, -2, 1.5).fill({ color: 0xf472b6 });
    g.circle(3, -2, 1.5).fill({ color: 0x38bdf8 });
  } else if (kind === "orchard") {
    drawTreeGraphics(g, 1, pal);
  } else if (kind === "well") {
    drawWellGraphics(g, pal);
  } else if (kind === "bush") {
    drawBushGraphics(g, pal);
  } else if (kind === "boulder") {
    drawBoulderGraphics(g, pal);
  } else if (kind === "lamp_post" || kind === "lanterns") {
    drawLampPostGraphics(g, pal);
  } else if (kind === "barrel") {
    drawBarrelGraphics(g, pal);
  } else if (kind === "crate") {
    drawCrateGraphics(g, pal);
  } else {
    g.ellipse(0, 0, 12, 6).fill({ color: pal.water }).stroke({ color: outlineColor(pal.water), width: 1 });
  }
}

/**
 * Draws municipal plaza fountain for stage 3+.
 */
export function drawFountainGraphics(g: Graphics, pal: ArcPalette): void {
  drawDropShadow(g, 22, 11, 0.28);
  g.ellipse(0, 0, 18, 9).fill({ color: 0x47443e }).stroke({ color: 0x1c1a16, width: 1 });
  g.ellipse(0, -1, 14, 7).fill({ color: pal.water });
  g.rect(-4, -12, 8, 11).fill({ color: 0x5a544b });
  g.ellipse(0, -12, 9, 4.5).fill({ color: 0x736c61 });
  g.poly([0, -13, 0, -21]).stroke({ color: pal.waterFoam, width: 2 });
}

/**
 * Tiny animated citizen (6x12) with 1px outline.
 */
export function drawCitizenGraphics(g: Graphics, pal: ArcPalette): void {
  g.ellipse(0, 0, 4, 2).fill({ color: 0x162238, alpha: 0.25 });
  g.rect(-2, -4, 1.5, 4).fill({ color: 0x140e09 });
  g.rect(0.5, -4, 1.5, 4).fill({ color: 0x140e09 });
  g.rect(-2.5, -9, 5, 5).fill({ color: pal.primary }).stroke({ color: outlineColor(pal.primary), width: 0.75 });
  g.circle(0, -11, 2).fill({ color: 0xf5cfb0 });
  g.poly([-2.5, -12, 2.5, -12, 0, -14]).fill({ color: pal.accent });
}

/**
 * Tiny merchant cart (12x10).
 */
export function drawCartGraphics(g: Graphics, pal: ArcPalette): void {
  g.ellipse(0, 0, 8, 4).fill({ color: 0x162238, alpha: 0.25 });
  g.circle(-5, -2, 2.5).fill({ color: 0x140d07 });
  g.circle(5, -2, 2.5).fill({ color: 0x140d07 });
  g.poly([-7, -4, 7, -4, 6, -9, -6, -9]).fill({ color: 0x4a3621 }).stroke({ color: 0x1f140a, width: 1 });
  g.poly([-4, -9, 4, -9, 0, -13]).fill({ color: pal.accent });
}

/**
 * Texture cache for props, trees, small props, and mobile actors with nearest-neighbour scaling.
 */
export class PropTextureCache {
  private cache = new Map<string, Texture>();
  private renderer: Renderer;

  constructor(renderer: Renderer) {
    this.renderer = renderer;
  }

  private bakeAndCache(key: string, drawFn: (g: Graphics) => void): Texture {
    let tex = this.cache.get(key);
    if (!tex) {
      const g = new Graphics();
      drawFn(g);
      tex = this.renderer.generateTexture({
        target: g,
        textureSourceOptions: { scaleMode: "nearest" },
        antialias: false,
      });
      tex.source.scaleMode = "nearest";
      this.cache.set(key, tex);
      g.destroy();
    }
    return tex;
  }

  getTreeTexture(treeType: number, arcId: string, pal: ArcPalette, season = 0): Texture {
    void pal;
    const normVariant = ((Math.floor(treeType) % 3) + 3) % 3;
    const key = `tree_${normVariant}_${arcId}_s${season}`;
    return this.bakeAndCache(key, (g) => {
      const theme = getTheme(arcId, season);
      drawTreeGraphics(g, normVariant, theme, season);
    });
  }

  getSmallPropTexture(
    kind: SmallPropKind,
    arcId: string,
    pal: ArcPalette,
    variant = 0,
    season = 0
  ): Texture {
    void pal;
    const key = `sprop_${kind}_${arcId}_v${variant}_s${season}`;
    return this.bakeAndCache(key, (g) => {
      drawSmallPropGraphics(g, kind, arcId, variant, season);
    });
  }

  getBushTexture(arcId: string, pal: ArcPalette, variant = 0, season = 0): Texture {
    return this.getSmallPropTexture("bush", arcId, pal, variant, season);
  }

  getBoulderTexture(arcId: string, pal: ArcPalette, variant = 0, season = 0): Texture {
    return this.getSmallPropTexture("boulder", arcId, pal, variant, season);
  }

  getFenceTexture(arcId: string, pal: ArcPalette, variant = 0, season = 0): Texture {
    return this.getSmallPropTexture("fence", arcId, pal, variant, season);
  }

  getLampPostTexture(arcId: string, pal: ArcPalette, variant = 0, season = 0): Texture {
    return this.getSmallPropTexture("lamp_post", arcId, pal, variant, season);
  }

  getWellTexture(arcId: string, pal: ArcPalette, variant = 0, season = 0): Texture {
    return this.getSmallPropTexture("well", arcId, pal, variant, season);
  }

  getBarrelTexture(arcId: string, pal: ArcPalette, variant = 0, season = 0): Texture {
    return this.getSmallPropTexture("barrel", arcId, pal, variant, season);
  }

  getCrateTexture(arcId: string, pal: ArcPalette, variant = 0, season = 0): Texture {
    return this.getSmallPropTexture("crate", arcId, pal, variant, season);
  }

  getSupportingTexture(kind: string, arcId: string, pal: ArcPalette): Texture {
    return this.bakeAndCache(`supp_${kind}_${arcId}`, (g) => drawSupportingBuildingGraphics(g, kind, pal));
  }

  getStallTexture(itemId: string, arcId: string, pal: ArcPalette): Texture {
    return this.bakeAndCache(`stall_${itemId}_${arcId}`, (g) => drawMarketStallGraphics(g, itemId, pal));
  }

  getRuralTexture(kind: string, arcId: string, pal: ArcPalette): Texture {
    return this.bakeAndCache(`rural_${kind}_${arcId}`, (g) => drawRuralFeatureGraphics(g, kind, pal));
  }

  getFountainTexture(arcId: string, pal: ArcPalette): Texture {
    return this.bakeAndCache(`fountain_${arcId}`, (g) => drawFountainGraphics(g, pal));
  }

  getCitizenTexture(arcId: string, pal: ArcPalette): Texture {
    return this.bakeAndCache(`citizen_${arcId}`, (g) => drawCitizenGraphics(g, pal));
  }

  getCartTexture(arcId: string, pal: ArcPalette): Texture {
    return this.bakeAndCache(`cart_${arcId}`, (g) => drawCartGraphics(g, pal));
  }

  destroy(): void {
    for (const tex of this.cache.values()) {
      tex.destroy(true);
    }
    this.cache.clear();
  }
}
