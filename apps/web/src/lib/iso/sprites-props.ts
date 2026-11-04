/**
 * Procedural isometric props, supporting buildings, market stalls, rural features,
 * trees (3 types with drop shadows), and mobile actors (citizens, carts) for PixiJS v8.
 */

import { Graphics, type Renderer, type Texture } from "pixi.js";
import type { ArcPalette } from "./sprites-ground.ts";

/**
 * Draws a soft drop shadow isometric ellipse.
 */
export function drawDropShadow(
  g: Graphics,
  rx = 12,
  ry = 6,
  alpha = 0.28
): void {
  g.ellipse(0, 0, rx, ry).fill({ color: 0x0a0806, alpha });
}

/**
 * Draws 1 of 3 distinctive tree types with drop shadow.
 */
export function drawTreeGraphics(
  g: Graphics,
  treeType: number,
  pal: ArcPalette
): void {
  drawDropShadow(g, 10, 5, 0.3);
  const trunkCol = 0x3d2b1a;
  g.rect(-2, -14, 4, 14).fill({ color: trunkCol });

  if (treeType === 0) {
    // Conifer / Pine
    const fDark = pal.forest;
    const fLight = pal.grass;
    g.poly([0, -22, 12, -10, 0, -8, -12, -10]).fill({ color: fDark });
    g.poly([0, -28, 9, -17, 0, -15, -9, -17]).fill({ color: fDark });
    g.poly([0, -35, 7, -24, -7, -24]).fill({ color: fLight });
  } else if (treeType === 1) {
    // Oak / Broadleaf
    const fBase = pal.forest;
    const fHighlight = pal.grass;
    g.circle(0, -22, 11).fill({ color: fBase });
    g.circle(-5, -24, 8).fill({ color: fHighlight });
    g.circle(5, -20, 7).fill({ color: fBase });
    g.circle(0, -28, 6).fill({ color: fHighlight });
  } else {
    // Slender Birch / Willow
    const paleTrunk = 0x6e685a;
    g.rect(-1.5, -20, 3, 20).fill({ color: paleTrunk });
    const fMain = pal.grass;
    g.ellipse(0, -26, 8, 16).fill({ color: fMain });
    g.ellipse(-2, -30, 4, 8).fill({ color: pal.accent, alpha: 0.6 });
  }
}

/**
 * Draws district supporting buildings (barns, workshops, shacks, domed huts, etc.)
 */
export function drawSupportingBuildingGraphics(
  g: Graphics,
  kind: string,
  pal: ArcPalette
): void {
  drawDropShadow(g, 16, 8, 0.28);

  if (kind === "barn") {
    // Secondary timber barn
    g.poly([-12, 0, 0, 6, 0, -10, -12, -16]).fill({ color: pal.primary });
    g.poly([0, 6, 12, 0, 12, -16, 0, -10]).fill({ color: 0x362c21 });
    g.poly([-14, -16, 0, -10, 0, -20]).fill({ color: pal.secondary });
    g.poly([0, -10, 14, -16, 0, -20]).fill({ color: 0x483d30 });
    g.poly([-6, 3, -2, 5, -2, 0, -6, -2]).fill({ color: 0x1a1510 });
  } else if (kind === "workshop" || kind === "alembic_shed") {
    // Small workshop with chimney
    g.poly([-10, 0, 0, 5, 0, -10, -10, -15]).fill({ color: 0x5a554c });
    g.poly([0, 5, 10, 0, 10, -15, 0, -10]).fill({ color: 0x3d3933 });
    g.poly([-11, -15, 0, -10, 11, -15, 0, -19]).fill({ color: 0x24201b });
    g.rect(4, -22, 3, 9).fill({ color: 0x2d2620 });
    g.poly([2, -2, 6, -4, 6, -8, 2, -6]).fill({ color: 0xf5b041 });
  } else if (kind === "domed_hut") {
    // Alchemical domed hut
    g.poly([-10, 0, 0, 5, 10, 0, 0, -5]).fill({ color: 0x40362b });
    g.circle(0, -9, 8).fill({ color: pal.primary }).stroke({ color: pal.accent, width: 1.2 });
    g.circle(0, -12, 2.5).fill({ color: pal.accent });
  } else if (kind === "warehouse" || kind === "boat_slip") {
    // Low pitched storage warehouse
    g.poly([-14, 0, 0, 7, 0, -8, -14, -15]).fill({ color: 0x4d3e2d });
    g.poly([0, 7, 14, 0, 14, -15, 0, -8]).fill({ color: 0x33281c });
    g.poly([-16, -15, 0, -8, 16, -15, 0, -17]).fill({ color: 0x6e5942 });
    g.rect(-4, 0, 8, 6).fill({ color: 0x221a12 });
  } else if (kind === "courtyard" || kind === "watch_post") {
    // Stone walled courtyard
    g.poly([-14, 0, 0, 7, 14, 0, 0, -7]).fill({ color: 0x555047 });
    g.poly([-14, -3, 0, 4, 14, -3]).stroke({ color: 0x332f2a, width: 2.5 });
    g.rect(-3, -14, 6, 14).fill({ color: 0x454038 });
    g.poly([-3, -14, 3, -14, 0, -18]).fill({ color: pal.accent });
  } else if (kind === "rock_pile") {
    // Mining rock & ore mound
    g.poly([-12, 1, 0, 5, 12, 0, 2, -5, -8, -4]).fill({ color: 0x4a453d });
    g.circle(-2, 0, 2).fill({ color: pal.accent });
    g.circle(4, -1, 1.5).fill({ color: 0xffffff, alpha: 0.8 });
  } else if (kind === "cart_track") {
    // Cart tracks with mini ore hopper
    g.poly([-10, -2, 10, 6]).stroke({ color: 0x666055, width: 1.5 });
    g.poly([-8, -4, 12, 4]).stroke({ color: 0x666055, width: 1.5 });
    g.poly([-2, 1, 4, 3, 4, -3, -2, -5]).fill({ color: 0x524230 });
  } else {
    // Default shack / crop plots / fences / piers
    g.poly([-10, 0, 0, 5, 0, -9, -10, -14]).fill({ color: 0x524232 });
    g.poly([0, 5, 10, 0, 10, -14, 0, -9]).fill({ color: 0x382c20 });
    g.poly([-11, -14, 0, -9, 11, -14, 0, -17]).fill({ color: pal.secondary });
  }
}

/**
 * Draws a market stall with cloth awning canopy and commodity crates.
 */
export function drawMarketStallGraphics(
  g: Graphics,
  itemId: string,
  pal: ArcPalette
): void {
  drawDropShadow(g, 12, 6, 0.25);
  // Wooden counter table
  g.poly([-8, 0, 0, 4, 8, 0, 0, -4]).fill({ color: 0x523e2b });
  // Posts
  g.rect(-7, -10, 1.5, 10).fill({ color: 0x2d2117 });
  g.rect(6, -10, 1.5, 10).fill({ color: 0x2d2117 });
  // Striped cloth awning canopy
  g.poly([-10, -10, 0, -6, 10, -10, 0, -14]).fill({ color: pal.primary });
  g.poly([-5, -8, 0, -6, 5, -8, 0, -11]).fill({ color: pal.accent });
  // Goods crate
  g.poly([-3, 1, 1, 3, 3, 1, -1, -1]).fill({ color: 0x8a6f4e });
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
    // Furrowed soil beds with green crops
    g.poly([-14, 0, 0, 7, 14, 0, 0, -7]).fill({ color: 0x423522 });
    g.poly([-10, 1, 0, 5, 10, 1]).stroke({ color: pal.grass, width: 1.5 });
    g.poly([-8, -2, 0, 2, 8, -2]).stroke({ color: pal.grass, width: 1.5 });
  } else if (kind === "orchard") {
    // Two small fruit trees with drop shadows
    drawTreeGraphics(g, 1, pal);
    g.circle(-3, -22, 1.5).fill({ color: 0xd94f38 });
    g.circle(3, -20, 1.5).fill({ color: 0xd94f38 });
  } else if (kind === "fence") {
    // Wooden split-rail fence
    g.poly([-12, 2, 12, -4]).stroke({ color: 0x5e4832, width: 2 });
    g.poly([-12, -2, 12, -8]).stroke({ color: 0x5e4832, width: 2 });
    g.rect(-10, -7, 2, 8).fill({ color: 0x3d2c1c });
    g.rect(8, -13, 2, 8).fill({ color: 0x3d2c1c });
  } else if (kind === "well") {
    // Stone village well with wooden roof
    drawDropShadow(g, 8, 4, 0.3);
    g.ellipse(0, 0, 7, 3.5).fill({ color: 0x4f4940 });
    g.ellipse(0, -1, 5, 2.5).fill({ color: 0x1f465c });
    g.rect(-5, -12, 1.5, 12).fill({ color: 0x38281a });
    g.rect(4, -12, 1.5, 12).fill({ color: 0x38281a });
    g.poly([-7, -12, 0, -9, 7, -12, 0, -15]).fill({ color: 0x634f3a });
  } else {
    // Pond: natural water pool with reed grasses
    g.ellipse(0, 0, 12, 6).fill({ color: pal.water }).stroke({ color: pal.waterFoam, width: 1.2 });
    g.poly([6, -2, 8, -7]).stroke({ color: pal.grass, width: 1.5 });
    g.poly([8, -1, 11, -6]).stroke({ color: pal.grass, width: 1.5 });
  }
}

/**
 * Draws grand municipal plaza fountain for stage 3+.
 */
export function drawFountainGraphics(g: Graphics, pal: ArcPalette): void {
  drawDropShadow(g, 22, 11, 0.35);
  // Outer stone basin
  g.ellipse(0, 0, 18, 9).fill({ color: 0x55524d }).stroke({ color: 0x8a847b, width: 1.5 });
  // Water pool
  g.ellipse(0, -1, 14, 7).fill({ color: pal.water });
  // Central column pedestal
  g.rect(-4, -12, 8, 11).fill({ color: 0x6e6962 });
  // Upper stone tier
  g.ellipse(0, -12, 9, 4.5).fill({ color: 0x8a847b });
  g.ellipse(0, -13, 7, 3.5).fill({ color: pal.water });
  // Water spray apex
  g.poly([0, -13, 0, -21]).stroke({ color: pal.waterFoam, width: 2 });
}

/**
 * Tiny animated citizen (6x12).
 */
export function drawCitizenGraphics(g: Graphics, pal: ArcPalette): void {
  g.ellipse(0, 0, 4, 2).fill({ color: 0x000000, alpha: 0.35 });
  g.rect(-2, -4, 1.5, 4).fill({ color: 0x221a12 });
  g.rect(0.5, -4, 1.5, 4).fill({ color: 0x221a12 });
  g.rect(-2.5, -9, 5, 5).fill({ color: pal.primary });
  g.circle(0, -11, 2).fill({ color: 0xf5cfb0 });
  g.poly([-2.5, -12, 2.5, -12, 0, -14]).fill({ color: pal.accent });
}

/**
 * Tiny merchant cart (12x10).
 */
export function drawCartGraphics(g: Graphics, pal: ArcPalette): void {
  g.ellipse(0, 0, 8, 4).fill({ color: 0x000000, alpha: 0.35 });
  g.circle(-5, -2, 2.5).fill({ color: 0x1f160e });
  g.circle(5, -2, 2.5).fill({ color: 0x1f160e });
  g.poly([-7, -4, 7, -4, 6, -9, -6, -9]).fill({ color: 0x59422a });
  g.poly([-4, -9, 4, -9, 0, -13]).fill({ color: pal.accent });
}

/**
 * Texture cache for props, trees, and mobile actors.
 */
export class PropTextureCache {
  private cache = new Map<string, Texture>();
  private renderer: Renderer;

  constructor(renderer: Renderer) {
    this.renderer = renderer;
  }

  getTreeTexture(treeType: number, arcId: string, pal: ArcPalette): Texture {
    const key = `tree_${treeType}_${arcId}`;
    let tex = this.cache.get(key);
    if (!tex) {
      const g = new Graphics();
      drawTreeGraphics(g, treeType, pal);
      tex = this.renderer.generateTexture({ target: g });
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
      tex = this.renderer.generateTexture({ target: g });
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
      tex = this.renderer.generateTexture({ target: g });
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
      tex = this.renderer.generateTexture({ target: g });
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
      tex = this.renderer.generateTexture({ target: g });
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
      tex = this.renderer.generateTexture({ target: g });
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
