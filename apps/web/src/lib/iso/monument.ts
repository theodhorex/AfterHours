/**
 * Procedural Century Monument and Patina aging renderer for PixiJS v8.
 * Changes by century: well -> cistern -> statue -> obelisk -> relic monolith.
 */

import { Graphics } from "pixi.js";
import { type CenturyMonumentSpec } from "./growth-render-pure.ts";
import { drawDropShadow } from "./sprites-props.ts";

export function drawCenturyMonument(
  g: Graphics,
  spec: CenturyMonumentSpec
): void {
  drawDropShadow(g, 18, 9, 0.4);

  const { kind, patinaColor, trimColor, hasRunicGlow } = spec;

  switch (kind) {
    case "well": {
      // Founding Timber Well
      g.ellipse(0, 0, 10, 6).fill({ color: trimColor }).stroke({ color: 0x1a1510, width: 1 });
      g.ellipse(0, -6, 10, 6).fill({ color: patinaColor }).stroke({ color: trimColor, width: 1 });
      g.ellipse(0, -6, 6, 3.5).fill({ color: 0x1a2630 }); // water depth
      // Timber posts and canopy
      g.rect(-8, -18, 2, 12).fill({ color: trimColor });
      g.rect(6, -18, 2, 12).fill({ color: trimColor });
      g.poly([-11, -18, 0, -24, 11, -18, 0, -15]).fill({ color: 0x5a4835 }).stroke({ color: trimColor, width: 1 });
      break;
    }

    case "cistern": {
      // Weathered Stone Cistern with moss creepers
      g.poly([-14, 0, 0, 7, 14, 0, 0, -7]).fill({ color: trimColor }).stroke({ color: 0x161c14, width: 1 });
      g.poly([-14, -8, 0, -1, 14, -8, 0, -15]).fill({ color: patinaColor }).stroke({ color: trimColor, width: 1 });
      g.ellipse(0, -8, 9, 4.5).fill({ color: 0x243e42 });
      // Moss creepers
      g.circle(-6, -4, 2).fill({ color: 0x4f7d45 });
      g.circle(7, -6, 2.5).fill({ color: 0x4f7d45 });
      g.circle(0, -2, 1.5).fill({ color: 0x3d6635 });
      break;
    }

    case "statue": {
      // Verdigris Civic Bronze on stone plinth
      g.poly([-12, 0, 0, 6, 12, 0, 0, -6]).fill({ color: 0x222222 }).stroke({ color: 0x111111, width: 1 });
      g.poly([-10, -6, 0, -1, 10, -6, 0, -11]).fill({ color: 0x444444 }).stroke({ color: 0x222222, width: 1 });
      // Bronze figure
      g.rect(-3, -22, 6, 16).fill({ color: patinaColor }).stroke({ color: trimColor, width: 1 });
      g.circle(0, -25, 3.5).fill({ color: patinaColor }).stroke({ color: trimColor, width: 1 });
      // Cape / banner
      g.poly([3, -22, 8, -12, 3, -15]).fill({ color: trimColor });
      break;
    }

    case "obelisk": {
      // Gilded Century Obelisk with pyramidion
      g.poly([-14, 0, 0, 7, 14, 0, 0, -7]).fill({ color: 0x332815 }).stroke({ color: 0x1a1408, width: 1 });
      g.poly([-10, -8, 0, -3, 10, -8, 0, -13]).fill({ color: trimColor }).stroke({ color: 0x1a1408, width: 1 });
      // Spire
      g.poly([-6, -8, 0, -5, 0, -38, -3, -38]).fill({ color: patinaColor }).stroke({ color: trimColor, width: 0.75 });
      g.poly([0, -5, 6, -8, 3, -38, 0, -38]).fill({ color: 0xb59228 }).stroke({ color: trimColor, width: 0.75 });
      // Pyramidion gold tip
      g.poly([-3, -38, 3, -38, 0, -45]).fill({ color: 0xffe066 }).stroke({ color: 0x8a6f1c, width: 1 });
      break;
    }

    case "relic_monolith": {
      // Ancient Monumental Relic with arcane rune glow
      g.poly([-16, 0, 0, 8, 16, 0, 0, -8]).fill({ color: 0x1e1526 }).stroke({ color: 0x0f0a14, width: 1 });
      // Megalith slab
      g.poly([-8, -6, 0, -2, 0, -48, -7, -44]).fill({ color: 0x382d47 }).stroke({ color: trimColor, width: 1 });
      g.poly([0, -2, 8, -6, 7, -44, 0, -48]).fill({ color: 0x2c223a }).stroke({ color: trimColor, width: 1 });
      // Runic carved lines
      if (hasRunicGlow) {
        g.poly([0, -10, -3, -18, 0, -26, 3, -34, 0, -42]).stroke({ color: 0xd8b4fe, width: 1.5 });
        g.circle(0, -44, 2.5).fill({ color: 0xf3e8ff });
        g.circle(0, -26, 2).fill({ color: 0xd8b4fe });
      }
      break;
    }
  }
}
