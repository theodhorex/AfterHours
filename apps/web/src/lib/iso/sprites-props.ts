/**
 * Procedural isometric props, trees (3 types with drop shadows),
 * and mobile actors (citizens, carts) for PixiJS v8.
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
 * Type 0: Fir / Pine (layered cone)
 * Type 1: Oak / Broadleaf (leafy clump)
 * Type 2: Fantasy Birch / Willow (tall slender crown)
 */
export function drawTreeGraphics(
  g: Graphics,
  treeType: number,
  pal: ArcPalette
): void {
  // 1. Soft drop shadow
  drawDropShadow(g, 10, 5, 0.3);

  // 2. Trunk
  const trunkCol = 0x3d2b1a;
  g.rect(-2, -14, 4, 14).fill({ color: trunkCol });

  // 3. Foliage based on type
  if (treeType === 0) {
    // Conifer / Pine: 3 layered triangular tiers
    const fDark = pal.forest;
    const fLight = pal.grass;

    // Bottom tier
    g.poly([0, -22, 12, -10, 0, -8, -12, -10]).fill({ color: fDark });
    // Middle tier
    g.poly([0, -28, 9, -17, 0, -15, -9, -17]).fill({ color: fDark });
    // Top crown with highlight
    g.poly([0, -35, 7, -24, -7, -24]).fill({ color: fLight });
  } else if (treeType === 1) {
    // Oak / Broadleaf: clumpy lush canopy
    const fBase = pal.forest;
    const fHighlight = pal.grass;

    // Back dark clump
    g.circle(0, -22, 11).fill({ color: fBase });
    // Left sunlit lobe
    g.circle(-5, -24, 8).fill({ color: fHighlight });
    // Right shadowed lobe
    g.circle(5, -20, 7).fill({ color: fBase });
    // Top highlight
    g.circle(0, -28, 6).fill({ color: fHighlight });
  } else {
    // Slender Willow / Birch: tall tapered teardrop crown
    const paleTrunk = 0x6e685a;
    g.rect(-1.5, -20, 3, 20).fill({ color: paleTrunk });

    const fMain = pal.grass;
    g.ellipse(0, -26, 8, 16).fill({ color: fMain });
    // Silver leaf / moonlit accent tip
    g.ellipse(-2, -30, 4, 8).fill({ color: pal.accent, alpha: 0.6 });
  }
}

/**
 * Draws a tiny animated citizen sprite (6x12).
 */
export function drawCitizenGraphics(g: Graphics, pal: ArcPalette): void {
  // Drop shadow
  g.ellipse(0, 0, 4, 2).fill({ color: 0x000000, alpha: 0.35 });
  // Legs / feet
  g.rect(-2, -4, 1.5, 4).fill({ color: 0x221a12 });
  g.rect(0.5, -4, 1.5, 4).fill({ color: 0x221a12 });
  // Tunic body
  g.rect(-2.5, -9, 5, 5).fill({ color: pal.primary });
  // Head
  g.circle(0, -11, 2).fill({ color: 0xf5cfb0 });
  // Cap / hair
  g.poly([-2.5, -12, 2.5, -12, 0, -14]).fill({ color: pal.accent });
}

/**
 * Draws a tiny merchant cart sprite (12x10).
 */
export function drawCartGraphics(g: Graphics, pal: ArcPalette): void {
  // Drop shadow
  g.ellipse(0, 0, 8, 4).fill({ color: 0x000000, alpha: 0.35 });
  // Wooden wheels
  g.circle(-5, -2, 2.5).fill({ color: 0x1f160e });
  g.circle(5, -2, 2.5).fill({ color: 0x1f160e });
  // Cart bed
  g.poly([-7, -4, 7, -4, 6, -9, -6, -9]).fill({ color: 0x59422a });
  // Cargo mound
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
