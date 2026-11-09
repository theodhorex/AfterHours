/**
 * Procedural pixel-art texture baking and pooling for pedestrians, carts,
 * chimney smoke, birds, and river sparkles. Nearest-neighbour pixel scaling.
 */

import { Graphics, type Renderer, type Texture } from "pixi.js";
import type { CartKind } from "./life-paths.ts";

export const PEDESTRIAN_COLORS = [
  0x8a7055, // Muted tan / leather
  0x4a6572, // Slate blue
  0x556b2f, // Olive green
  0x8c5e58, // Terracotta / russet
  0x70587c, // Muted plum
  0x5a6351, // Sage grey
];

export function drawPedestrianGraphics(g: Graphics, colorIdx: number, frame: number): void {
  const color = PEDESTRIAN_COLORS[colorIdx % PEDESTRIAN_COLORS.length];
  const bobY = frame === 1 ? -1 : 0;

  // Shadow dot at feet
  g.ellipse(0, 0, 2.5, 1.2).fill({ color: 0x162238, alpha: 0.28 });

  // Feet / legs (1px width)
  if (frame === 1) {
    g.rect(-1.5, -2 + bobY, 1, 2).fill({ color: 0x1e1915 });
    g.rect(0.5, -1 + bobY, 1, 1).fill({ color: 0x1e1915 });
  } else {
    g.rect(-1.5, -1 + bobY, 1, 1).fill({ color: 0x1e1915 });
    g.rect(0.5, -1 + bobY, 1, 1).fill({ color: 0x1e1915 });
  }

  // 2x3 px body
  g.rect(-1.5, -4 + bobY, 3, 3).fill({ color });

  // 2x2 px face
  g.rect(-1, -6 + bobY, 2, 2).fill({ color: 0xd8b58a });

  // Hair / cap (1px dark band)
  g.rect(-1.5, -7 + bobY, 3, 1).fill({ color: 0x2a221b });
}

export function drawCartGraphicsForKind(g: Graphics, kind: CartKind, frame: number): void {
  // Shadow beneath cart
  g.ellipse(-1, 0, 7, 2.5).fill({ color: 0x162238, alpha: 0.28 });

  // Pulling figure in front (x = 4 to 6)
  g.rect(4, -4, 2, 3).fill({ color: 0x42362b });
  g.rect(4.5, -6, 2, 2).fill({ color: 0xd8b58a });
  g.rect(4, -7, 2.5, 1).fill({ color: 0x221a13 });

  // Harness trace
  g.poly([2, -3, 4, -4]).stroke({ color: 0x221a12, width: 0.75 });

  // 6x4 px cart body box
  if (kind === "scrap") {
    // Goblin scrap cart (mossy / rusty iron and scrap wood)
    g.rect(-6, -6, 8, 4).fill({ color: 0x464b38 }).stroke({ color: 0x222619, width: 0.75 });
    g.rect(-5, -5, 3, 2).fill({ color: 0x8b4513 }); // rust patch
    g.poly([-4, -6, -2, -8, 0, -6]).fill({ color: 0x78716c }); // metal junk
  } else if (kind === "ore") {
    // Cave ore cart (dark slate & luminescent ore)
    g.rect(-6, -6, 8, 4).fill({ color: 0x334155 }).stroke({ color: 0x0f172a, width: 0.75 });
    g.circle(-3, -7, 1.5).fill({ color: 0x38bdf8 }); // blue ore
    g.circle(0, -7, 1.2).fill({ color: 0x94a3b8 }); // silver nugget
  } else if (kind === "bone") {
    // Dino bone sled (ivory bone runner with leather)
    g.poly([-7, -3, 2, -3, 3, -5]).stroke({ color: 0xfef08a, width: 1.5 }); // bone runner
    g.rect(-5, -6, 6, 3).fill({ color: 0x60452d }); // leather bundle
    g.poly([-4, -6, -2, -8, 0, -6]).fill({ color: 0xf5f5f4 }); // bone horn
  } else {
    // Elf flower cart (carved wood & blossom baskets)
    g.rect(-6, -6, 8, 4).fill({ color: 0x5c4028 }).stroke({ color: 0x2b1d11, width: 0.75 });
    g.circle(-3, -7, 1.5).fill({ color: 0xf472b6 }); // pink blossom
    g.circle(0, -7, 1.5).fill({ color: 0xfde047 }); // gold blossom
    g.circle(-1, -8, 1.2).fill({ color: 0x22c55e }); // foliage
  }

  // Wheels with flicker based on frame
  const hubColor1 = frame === 0 ? 0x8a7055 : 0x423223;
  const hubColor2 = frame === 0 ? 0x423223 : 0x8a7055;

  // Front wheel
  g.circle(-4, -1, 2.2).fill({ color: 0x1a140e });
  g.circle(-4, -1, 0.8).fill({ color: hubColor1 });

  // Rear wheel
  g.circle(0, -1, 2.2).fill({ color: 0x1a140e });
  g.circle(0, -1, 0.8).fill({ color: hubColor2 });
}

export function drawSmokePuffGraphics(g: Graphics, radius: number): void {
  g.circle(0, 0, radius).fill({ color: 0xdcd5ca, alpha: 0.65 });
  if (radius >= 2) {
    g.circle(0.4, -0.4, Math.max(1, radius - 1)).fill({ color: 0xf4ede5, alpha: 0.45 });
  }
}

export function drawBirdGraphics(g: Graphics, frame: number): void {
  const bodyColor = 0x25201c;
  const wingColor = 0x3f3730;

  if (frame === 0) {
    // Wings up (V flap)
    g.rect(0, 0, 2, 1).fill({ color: bodyColor });
    g.rect(-1, -1, 1, 1).fill({ color: wingColor });
    g.rect(-2, -2, 1, 1).fill({ color: wingColor });
    g.rect(2, -1, 1, 1).fill({ color: wingColor });
    g.rect(3, -2, 1, 1).fill({ color: wingColor });
  } else {
    // Glide / wings down
    g.rect(0, 0, 2, 1).fill({ color: bodyColor });
    g.rect(-2, 0, 2, 1).fill({ color: wingColor });
    g.rect(2, 0, 2, 1).fill({ color: wingColor });
  }
}

export function drawRiverSparkleGraphics(g: Graphics): void {
  g.rect(0, -1, 1, 3).fill({ color: 0xffffff, alpha: 0.85 });
  g.rect(-1, 0, 3, 1).fill({ color: 0xffffff, alpha: 0.85 });
}

export class LifeTextureCache {
  private cache = new Map<string, Texture>();
  private renderer: Renderer;

  constructor(renderer: Renderer) {
    this.renderer = renderer;
  }

  private bake(key: string, drawFn: (g: Graphics) => void): Texture {
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

  getPedestrianTexture(colorIdx: number, frame: number): Texture {
    const normColor = colorIdx % PEDESTRIAN_COLORS.length;
    const normFrame = frame % 2;
    const key = `ped_${normColor}_f${normFrame}`;
    return this.bake(key, (g) => drawPedestrianGraphics(g, normColor, normFrame));
  }

  getCartTexture(kind: CartKind, frame: number): Texture {
    const normFrame = frame % 2;
    const key = `cart_${kind}_f${normFrame}`;
    return this.bake(key, (g) => drawCartGraphicsForKind(g, kind, normFrame));
  }

  getSmokeTexture(radius = 2.5): Texture {
    const key = `smoke_r${radius}`;
    return this.bake(key, (g) => drawSmokePuffGraphics(g, radius));
  }

  getBirdTexture(frame: number): Texture {
    const normFrame = frame % 2;
    const key = `bird_f${normFrame}`;
    return this.bake(key, (g) => drawBirdGraphics(g, normFrame));
  }

  getSparkleTexture(): Texture {
    return this.bake("sparkle", (g) => drawRiverSparkleGraphics(g));
  }

  destroy(): void {
    for (const tex of this.cache.values()) {
      tex.destroy(true);
    }
    this.cache.clear();
  }
}
