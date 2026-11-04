/**
 * Procedural isometric props, trees (mushrooms, crystals, ferns, great trees),
 * lanterns, stalls, and actors with 1px dark outlines and nearest-neighbour scaling.
 */

import { Graphics, type Renderer, type Texture } from "pixi.js";
import type { ArcPalette } from "./sprites-ground.ts";
import { shade, outlineColor, getTheme, type ThemeTokens } from "./theme.ts";

export function drawDropShadow(g: Graphics, rx = 12, ry = 6, alpha = 0.35): void {
  g.ellipse(0, 0, rx, ry).fill({ color: 0x080604, alpha });
}

/**
 * Draws arc-specific tree/foliage (mushrooms, crystals, ferns, great trees) with 1px dark outline.
 */
export function drawTreeGraphics(
  g: Graphics,
  treeType: number,
  pal: ArcPalette | ThemeTokens,
  season = 0
): void {
  drawDropShadow(g, 10, 5, 0.35);

  const theme = "treeStyle" in pal ? pal : getTheme("goblin_warrens", season);
  const treeStyle = theme.treeStyle;
  const hasSnow = theme.hasSnowCaps;

  if (treeStyle === "mushroom") {
    // Goblin Warrens: Giant procedural mushroom
    const stalkCol = 0x3d3042;
    g.rect(-2.5, -16, 5, 16).fill({ color: stalkCol }).stroke({ color: outlineColor(stalkCol), width: 1 });
    // Fungal gills
    g.ellipse(0, -15, 12, 4).fill({ color: 0x221826 });

    // Mushroom Cap
    let capCol = theme.seasonName === "autumn" ? 0x9a3412 : 0x7c3aed;
    if (hasSnow) capCol = 0xf0f8ff;
    g.ellipse(0, -18, 14, 9).fill({ color: capCol }).stroke({ color: outlineColor(capCol), width: 1 });
    // Cap spots
    const spotCol = hasSnow ? 0xbfdbfe : 0xfbbf24;
    g.circle(-5, -20, 1.8).fill({ color: spotCol });
    g.circle(4, -17, 1.5).fill({ color: spotCol });
    g.circle(0, -22, 1.2).fill({ color: spotCol });
  } else if (treeStyle === "crystal") {
    // Cave Hold: Sharp glowing crystal clusters
    const cryCol = 0x38bdf8;
    g.poly([-6, 0, -2, -26, 0, -28, 2, -24, 6, 0])
      .fill({ color: cryCol })
      .stroke({ color: outlineColor(cryCol), width: 1 });
    g.poly([-2, 0, 0, -28, 2, -24, 0, 0]).fill({ color: 0xbae6fd });
    g.poly([4, 0, 8, -16, 12, 0]).fill({ color: 0x0284c7 });
  } else if (treeStyle === "fern") {
    // Dino Vale: Giant cycad / tree fern
    g.rect(-2, -14, 4, 14).fill({ color: 0x3d2b1a }).stroke({ color: 0x1f140a, width: 1 });
    const fCol = theme.seasonName === "autumn" ? 0xb45309 : pal.grass;
    g.poly([0, -14, -12, -20, -16, -14]).stroke({ color: fCol, width: 2 });
    g.poly([0, -14, 12, -20, 16, -14]).stroke({ color: fCol, width: 2 });
    g.poly([0, -14, 0, -26]).stroke({ color: fCol, width: 2.2 });
    g.circle(0, -14, 3).fill({ color: fCol });
  } else if (treeStyle === "great_tree") {
    // Elf Grove: Ancient broad canopy tree with houses in trunks
    g.rect(-4, -18, 8, 18).fill({ color: 0x243326 }).stroke({ color: 0x101a12, width: 1 });
    g.rect(-1.5, -6, 3, 5).fill({ color: 0x152217 });
    g.circle(0, -11, 1.5).fill({ color: 0xfef08a }); // Lit window in trunk

    let leafCol = pal.forest;
    if (hasSnow) leafCol = 0xf0f8ff;
    else if (theme.seasonName === "spring") leafCol = 0xf472b6; // Cherry blossom pink
    else if (theme.seasonName === "autumn") leafCol = 0xeab308; // Gold in autumn
    else if (theme.seasonName === "summer") leafCol = 0x38a050;

    g.circle(0, -22, 13).fill({ color: leafCol }).stroke({ color: outlineColor(leafCol), width: 1 });
    g.circle(-6, -26, 9).fill({ color: shade(leafCol, 1.2) });
    g.circle(6, -24, 8).fill({ color: shade(leafCol, 0.85) });
  } else {
    // Default Pine / Broadleaf / Birch
    g.rect(-2, -14, 4, 14).fill({ color: 0x3d2b1a }).stroke({ color: 0x1a120b, width: 1 });
    const leafCol = hasSnow ? 0xf0f8ff : pal.forest;
    g.poly([0, -22, 12, -10, 0, -8, -12, -10]).fill({ color: leafCol }).stroke({ color: outlineColor(leafCol), width: 1 });
    g.poly([0, -32, 8, -20, -8, -20]).fill({ color: shade(leafCol, 1.15) }).stroke({ color: outlineColor(leafCol), width: 1 });
  }
}

/**
 * Draws district supporting buildings with 1px dark outlines.
 */
export function drawSupportingBuildingGraphics(
  g: Graphics,
  kind: string,
  pal: ArcPalette
): void {
  drawDropShadow(g, 16, 8, 0.32);
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
    // Default shack / store
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
  drawDropShadow(g, 12, 6, 0.3);
  g.poly([-8, 0, 0, 4, 8, 0, 0, -4]).fill({ color: 0x423120 }).stroke({ color: 0x1c140c, width: 1 });
  g.rect(-7, -10, 1.5, 10).fill({ color: 0x22180e });
  g.rect(6, -10, 1.5, 10).fill({ color: 0x22180e });
  g.poly([-10, -10, 0, -6, 10, -10, 0, -14]).fill({ color: pal.primary }).stroke({ color: outlineColor(pal.primary), width: 1 });
  g.poly([-5, -8, 0, -6, 5, -8, 0, -11]).fill({ color: pal.accent });
  g.poly([-3, 1, 1, 3, 3, 1, -1, -1]).fill({ color: 0x7a6042 });
}

/**
 * Draws rural features (farmland, orchard, fence, well, pond).
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
    // Dino Vale: Bone fence
    g.poly([-12, 1, 12, -5]).stroke({ color: 0xf3f4f6, width: 2 });
    g.rect(-10, -8, 2, 9).fill({ color: 0xe5e7eb });
    g.rect(8, -8, 2, 9).fill({ color: 0xe5e7eb });
  } else if (kind === "eggs" || kind === "nests") {
    // Dino Vale: Dinosaur eggs in straw nest
    g.ellipse(0, 0, 9, 5).fill({ color: 0x5c4224 });
    g.ellipse(-3, -2, 2.5, 3.5).fill({ color: 0xfef9c3 }).stroke({ color: 0xca8a04, width: 0.5 });
    g.ellipse(3, -2, 2.5, 3.5).fill({ color: 0xfef9c3 }).stroke({ color: 0xca8a04, width: 0.5 });
  } else if (kind === "ore_carts") {
    // Cave Hold: Ore cart
    drawDropShadow(g, 8, 4, 0.35);
    g.rect(-6, -7, 12, 5).fill({ color: 0x334455 }).stroke({ color: 0x1e293b, width: 1 });
    g.circle(-4, -2, 2).fill({ color: 0x0f172a });
    g.circle(4, -2, 2).fill({ color: 0x0f172a });
    g.circle(0, -8, 2.5).fill({ color: 0x38bdf8 });
  } else if (kind === "mine_entrances") {
    // Cave Hold: Mine entrance
    g.poly([-12, 0, 0, 6, 12, 0, 0, -6]).fill({ color: 0x1e293b });
    g.poly([-10, 0, 0, -18, 10, 0]).stroke({ color: 0x5a4225, width: 3 });
  } else if (kind === "rope_bridges") {
    // Elf Grove: Rope bridge
    g.poly([-14, -2, 0, 4, 14, -2]).stroke({ color: 0x92400e, width: 1.5 });
    g.poly([-14, -8, 0, -3, 14, -8]).stroke({ color: 0xb45309, width: 1.5 });
  } else if (kind === "flower_beds") {
    // Elf Grove: Glowing subtle flower beds
    g.ellipse(0, 0, 8, 4).fill({ color: 0x1b4332 });
    g.circle(-3, -2, 1.5).fill({ color: 0xf472b6 });
    g.circle(3, -2, 1.5).fill({ color: 0x38bdf8 });
  } else if (kind === "orchard") {
    drawTreeGraphics(g, 1, pal);
    g.circle(-3, -22, 1.5).fill({ color: 0xd94f38 });
  } else if (kind === "well") {
    drawDropShadow(g, 8, 4, 0.35);
    g.ellipse(0, 0, 7, 3.5).fill({ color: 0x3d3830 }).stroke({ color: 0x1c1a16, width: 1 });
    g.ellipse(0, -1, 5, 2.5).fill({ color: 0x1b3c50 });
  } else {
    // Pond
    g.ellipse(0, 0, 12, 6).fill({ color: pal.water }).stroke({ color: outlineColor(pal.water), width: 1 });
  }
}

/**
 * Draws municipal plaza fountain for stage 3+.
 */
export function drawFountainGraphics(g: Graphics, pal: ArcPalette): void {
  drawDropShadow(g, 22, 11, 0.38);
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
  g.ellipse(0, 0, 4, 2).fill({ color: 0x000000, alpha: 0.35 });
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
  g.ellipse(0, 0, 8, 4).fill({ color: 0x000000, alpha: 0.35 });
  g.circle(-5, -2, 2.5).fill({ color: 0x140d07 });
  g.circle(5, -2, 2.5).fill({ color: 0x140d07 });
  g.poly([-7, -4, 7, -4, 6, -9, -6, -9]).fill({ color: 0x4a3621 }).stroke({ color: 0x1f140a, width: 1 });
  g.poly([-4, -9, 4, -9, 0, -13]).fill({ color: pal.accent });
}

/**
 * Texture cache for props, trees, and mobile actors with nearest-neighbour scaling.
 */
export class PropTextureCache {
  private cache = new Map<string, Texture>();
  private renderer: Renderer;

  constructor(renderer: Renderer) {
    this.renderer = renderer;
  }

  getTreeTexture(treeType: number, arcId: string, pal: ArcPalette, season = 0): Texture {
    const key = `tree_${treeType}_${arcId}_s${season}`;
    let tex = this.cache.get(key);
    if (!tex) {
      const g = new Graphics();
      const theme = getTheme(arcId, season);
      drawTreeGraphics(g, treeType, theme, season);
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

  getSupportingTexture(kind: string, arcId: string, pal: ArcPalette): Texture {
    const key = `supp_${kind}_${arcId}`;
    let tex = this.cache.get(key);
    if (!tex) {
      const g = new Graphics();
      drawSupportingBuildingGraphics(g, kind, pal);
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

  getStallTexture(itemId: string, arcId: string, pal: ArcPalette): Texture {
    const key = `stall_${itemId}_${arcId}`;
    let tex = this.cache.get(key);
    if (!tex) {
      const g = new Graphics();
      drawMarketStallGraphics(g, itemId, pal);
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

  getRuralTexture(kind: string, arcId: string, pal: ArcPalette): Texture {
    const key = `rural_${kind}_${arcId}`;
    let tex = this.cache.get(key);
    if (!tex) {
      const g = new Graphics();
      drawRuralFeatureGraphics(g, kind, pal);
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

  getFountainTexture(arcId: string, pal: ArcPalette): Texture {
    const key = `fountain_${arcId}`;
    let tex = this.cache.get(key);
    if (!tex) {
      const g = new Graphics();
      drawFountainGraphics(g, pal);
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

  getCitizenTexture(arcId: string, pal: ArcPalette): Texture {
    const key = `citizen_${arcId}`;
    let tex = this.cache.get(key);
    if (!tex) {
      const g = new Graphics();
      drawCitizenGraphics(g, pal);
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

  getCartTexture(arcId: string, pal: ArcPalette): Texture {
    const key = `cart_${arcId}`;
    let tex = this.cache.get(key);
    if (!tex) {
      const g = new Graphics();
      drawCartGraphics(g, pal);
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

  destroy(): void {
    for (const tex of this.cache.values()) {
      tex.destroy(true);
    }
    this.cache.clear();
  }
}
