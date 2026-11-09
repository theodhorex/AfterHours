/**
 * Shaded pixel-art small props (bush, boulder, fence, lamp_post, well, barrel, crate).
 * Uses 5-6 step hue-shifted ramps (lit upper-left, cool shadow lower-right),
 * selective dark outlines, and a tiny soft blue-tinted ground shadow ellipse.
 * Deterministic: zero Math.random or Date.
 */

import type { Graphics } from "pixi.js";
import {
  buildHueRamp,
  propOutlineColor,
  ditherStep,
  coordHash,
  createPixelSurface,
  setPx,
  drawSoftShadow,
  drawSurfaceToGraphics,
  type PixelSurface,
} from "./prop-helpers.ts";

export const SMALL_PROP_KINDS = [
  "bush",
  "boulder",
  "fence",
  "lamp_post",
  "well",
  "barrel",
  "crate",
] as const;

export type SmallPropKind = (typeof SMALL_PROP_KINDS)[number];

export const SMALL_PROP_W = 36;
export const SMALL_PROP_H = 40;
export const SMALL_PROP_ANCHOR_X = 18;
export const SMALL_PROP_ANCHOR_Y = 32;

export interface BakedSmallPropResult extends PixelSurface {
  kind: SmallPropKind;
  opaquePixels: number;
  shadowPixels: number;
  warmGlowPixels: number;
}

function drawShadedBlob(
  surf: PixelSurface,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  ramp: number[],
  salt: number,
  snowCap = false,
  berryHex?: number
): void {
  const outline = propOutlineColor(ramp[0]);
  const snowRamp = snowCap ? buildHueRamp(0xe8f1f8, 6) : null;
  for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) {
    for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
      const nx = (x - cx) / Math.max(1, rx);
      const ny = (y - cy) / Math.max(1, ry);
      const jit = (coordHash(x, y, salt) - 0.5) * 0.18;
      const d = Math.sqrt(nx * nx + ny * ny) + jit;
      if (d > 1.02) continue;
      if (d > 0.86) {
        setPx(surf, x, y, nx + ny < -0.2 ? ramp[1] : outline);
        continue;
      }
      const lum = Math.max(0.05, Math.min(0.96, (-nx * 0.55 - ny * 0.65) * 0.46 + 0.52));
      if (snowRamp && ny < -0.15) {
        setPx(surf, x, y, snowRamp[ditherStep(lum + 0.15, 6, x + 18, y + 32)]);
      } else if (berryHex && coordHash(x, y, salt + 19) > 0.89 && lum > 0.45) {
        setPx(surf, x, y, berryHex);
      } else {
        setPx(surf, x, y, ramp[ditherStep(lum, ramp.length, x + 18, y + 32)]);
      }
    }
  }
}

/**
 * Bakes any of the 7 small props into a 36x40 PixelSurface.
 */
export function bakeSmallPropPixels(
  kind: SmallPropKind,
  arcId: string,
  variant = 0,
  season = 0
): BakedSmallPropResult {
  const surf = createPixelSurface(SMALL_PROP_W, SMALL_PROP_H, SMALL_PROP_ANCHOR_X, SMALL_PROP_ANCHOR_Y);
  const sIdx = ((Math.floor(season) % 4) + 4) % 4;
  const isWinter = sIdx === 3 && arcId !== "dino_vale";
  const isAutumn = sIdx === 2;
  const isSpring = sIdx === 0;
  const salt = (variant & 7) * 29 + sIdx * 11;

  let shadowPixels = 0;
  let warmGlowPixels = 0;

  if (kind === "bush") {
    shadowPixels = drawSoftShadow(surf, 0, 0, 9, 4, 0.25);
    const leafBase = isAutumn ? 0xa85d24 : arcId === "cave_hold" ? 0x3d6250 : 0x4c823e;
    const ramp = buildHueRamp(leafBase, 6);
    const berry = isSpring ? (arcId === "elf_grove" ? 0xf472b6 : 0xfacc15) : isAutumn ? 0xd94f38 : undefined;
    drawShadedBlob(surf, -4, -4, 6, 5, ramp, salt + 1, isWinter, berry);
    drawShadedBlob(surf, 4, -4, 6, 5, ramp, salt + 2, isWinter, berry);
    drawShadedBlob(surf, 0, -7, 7, 6, ramp, salt + 3, isWinter, berry);
  } else if (kind === "boulder") {
    shadowPixels = drawSoftShadow(surf, 0, 0, 10, 5, 0.25);
    const stoneBase = arcId === "cave_hold" ? 0x687482 : arcId === "dino_vale" ? 0x827868 : 0x747672;
    const ramp = buildHueRamp(stoneBase, 6);
    const out = propOutlineColor(ramp[0]);
    for (let y = -11; y <= 2; y++) {
      for (let x = -9; x <= 9; x++) {
        const nx = x / 8.5;
        const ny = (y + 4.5) / 6.5;
        const facetCut = Math.abs(nx) * 0.35 + Math.abs(ny) * 0.65;
        if (nx * nx + ny * ny > 1.0 && facetCut > 0.78) continue;
        if (nx * nx + ny * ny > 0.82) {
          setPx(surf, x, y, out);
          continue;
        }
        // Faceted rock planes: upper-left bright, top-right mid, lower-right shadow
        const plane = x - y < -2 ? 0.82 : x + y > 2 ? 0.22 : 0.54;
        const grain = (coordHash(x, y, salt + 5) - 0.5) * 0.16;
        const step = ditherStep(plane + grain, 6, x + 18, y + 32);
        setPx(surf, x, y, isWinter && y < -6 ? 0xe6eff6 : ramp[step]);
      }
    }
  } else if (kind === "fence") {
    shadowPixels = drawSoftShadow(surf, 0, 0, 11, 4, 0.22);
    const woodBase = arcId === "dino_vale" ? 0xb8ad98 : 0x78593c;
    const ramp = buildHueRamp(woodBase, 6);
    const out = propOutlineColor(ramp[0]);
    // Isometric rails from (-10, 2) to (10, -8)
    for (let x = -10; x <= 10; x++) {
      const railY = Math.round(-x * 0.5);
      for (const offset of [-3, -7]) {
        const ry = railY + offset;
        setPx(surf, x, ry - 1, ramp[4]);
        setPx(surf, x, ry, ramp[2]);
        setPx(surf, x, ry + 1, out);
      }
    }
    // Two vertical fence posts at x = -8 and x = +8
    for (const px of [-8, 0, 8]) {
      const baseY = Math.round(-px * 0.5) + 1;
      for (let y = baseY; y >= baseY - 10; y--) {
        setPx(surf, px - 1, y, ramp[4]);
        setPx(surf, px, y, ramp[2]);
        setPx(surf, px + 1, y, out);
      }
      setPx(surf, px, baseY - 11, isWinter ? 0xe8f1f8 : ramp[5]);
    }
  } else if (kind === "lamp_post") {
    shadowPixels = drawSoftShadow(surf, 0, 0, 7, 3, 0.25);
    const ironRamp = buildHueRamp(0x464c54, 6);
    const out = propOutlineColor(ironRamp[0]);
    // Plinth base
    for (let y = 0; y >= -3; y--) {
      for (let x = -2; x <= 2; x++) {
        setPx(surf, x, y, x === -2 || x === 2 ? out : x < 0 ? ironRamp[4] : ironRamp[1]);
      }
    }
    // Vertical post
    for (let y = -4; y >= -21; y--) {
      setPx(surf, -1, y, ironRamp[4]);
      setPx(surf, 0, y, ironRamp[2]);
      setPx(surf, 1, y, out);
    }
    // Cross-arm + hanging warm lit lantern head
    for (let x = -1; x <= 4; x++) {
      setPx(surf, x, -21, ironRamp[3]);
      setPx(surf, x, -22, isWinter ? 0xe8f1f8 : ironRamp[5]);
    }
    // Warm glowing lantern housing at (3, -18..-15)
    const glowCore = 0xfef08a;
    const glowMid = 0xf59e0b;
    const glowEdge = 0xd97706;
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        const d2 = dx * dx + dy * dy;
        const lx = 3 + dx;
        const ly = -18 + dy;
        if (d2 <= 2) {
          setPx(surf, lx, ly, glowCore);
          warmGlowPixels++;
        } else if (d2 <= 5) {
          setPx(surf, lx, ly, glowMid);
          warmGlowPixels++;
        } else if (d2 <= 9) {
          setPx(surf, lx, ly, glowEdge, 0.45);
          warmGlowPixels++;
        }
      }
    }
    // Lantern cap
    for (let x = 1; x <= 5; x++) setPx(surf, x, -20, out);
  } else if (kind === "well") {
    shadowPixels = drawSoftShadow(surf, 0, 0, 11, 5, 0.26);
    const stoneRamp = buildHueRamp(0x76746e, 6);
    const woodRamp = buildHueRamp(0x6e5036, 6);
    const out = propOutlineColor(stoneRamp[0]);
    // Circular stone well wall + dark water core
    for (let y = -7; y <= 3; y++) {
      for (let x = -8; x <= 8; x++) {
        const nx = x / 8;
        const topDist = Math.sqrt(nx * nx + Math.pow((y + 5) / 3.5, 2));
        if (topDist <= 0.72) {
          setPx(surf, x, y, 0x264e68);
        } else if (Math.abs(x) <= 8 && y >= -5 && y <= 2) {
          if (Math.abs(x) === 8 || y === 2) setPx(surf, x, y, out);
          else {
            const lit = 0.55 - nx * 0.35 + ((x + y) % 3 === 0 ? -0.12 : 0.06);
            setPx(surf, x, y, stoneRamp[ditherStep(lit, 6, x + 18, y + 32)]);
          }
        }
      }
    }
    // Timber support posts & pitched well roof
    for (let y = -5; y >= -16; y--) {
      setPx(surf, -6, y, woodRamp[3]);
      setPx(surf, -5, y, out);
      setPx(surf, 5, y, woodRamp[2]);
      setPx(surf, 6, y, out);
    }
    for (let y = -16; y >= -21; y--) {
      const span = 8 - (-16 - y) * 1.4;
      for (let x = -Math.round(span); x <= Math.round(span); x++) {
        const col = isWinter && y < -18 ? 0xe8f1f8 : x < 0 ? woodRamp[4] : woodRamp[2];
        setPx(surf, x, y, Math.abs(x) === Math.round(span) ? out : col);
      }
    }
  } else if (kind === "barrel") {
    shadowPixels = drawSoftShadow(surf, 0, 0, 7, 3, 0.25);
    const woodRamp = buildHueRamp(0x7c5636, 6);
    const ironCol = 0x363b42;
    const out = propOutlineColor(woodRamp[0]);
    for (let y = 1; y >= -11; y--) {
      const bulge = Math.sin(((1 - y) / 12) * Math.PI) * 1.2;
      const hw = Math.round(4.2 + bulge);
      for (let x = -hw; x <= hw; x++) {
        if (x === -hw || x === hw || y === 1 || y === -11) {
          setPx(surf, x, y, out);
        } else if (y === -2 || y === -8) {
          setPx(surf, x, y, x < 0 ? 0x525862 : ironCol);
        } else if (y <= -9) {
          setPx(surf, x, y, woodRamp[4]);
        } else {
          const lit = 0.56 - (x / hw) * 0.36;
          setPx(surf, x, y, woodRamp[ditherStep(lit, 6, x + 18, y + 32)]);
        }
      }
    }
  } else {
    // crate: isometric wooden cargo box with diagonal plank brace
    shadowPixels = drawSoftShadow(surf, 0, 0, 8, 4, 0.25);
    const woodRamp = buildHueRamp(0x88623e, 6);
    const out = propOutlineColor(woodRamp[0]);
    for (let y = -12; y <= 2; y++) {
      for (let x = -7; x <= 7; x++) {
        // Isometric cube bounds: top diamond centered at (0, -8), vertical walls down to y=2
        const topDiamond = Math.abs(x) / 7 + Math.abs(y + 8) / 3.5;
        if (y <= -5 && topDiamond <= 1.0) {
          const isEdge = topDiamond > 0.82;
          setPx(surf, x, y, isEdge ? out : woodRamp[ditherStep(0.78, 6, x + 18, y + 32)]);
        } else if (y > -8 && Math.abs(x) <= 6 && y <= 2 - Math.abs(x) * 0.45 + 3) {
          const bottomY = Math.round(2 - Math.abs(x) * 0.4);
          if (y > bottomY) continue;
          if (Math.abs(x) === 6 || x === 0 || y === bottomY) {
            setPx(surf, x, y, out);
          } else {
            const isLeft = x < 0;
            const diag = Math.abs(Math.abs(x) - (-y - 1)) <= 0;
            const baseTone = isLeft ? 0.58 : 0.3;
            const step = ditherStep(diag ? baseTone + 0.14 : baseTone, 6, x + 18, y + 32);
            setPx(surf, x, y, woodRamp[step]);
          }
        }
      }
    }
  }

  let opaquePixels = 0;
  for (let i = 3; i < surf.rgba.length; i += 4) {
    if (surf.rgba[i] > 180) opaquePixels++;
  }

  return {
    ...surf,
    kind,
    opaquePixels,
    shadowPixels,
    warmGlowPixels,
  };
}

export function drawSmallPropGraphics(
  g: Graphics,
  kind: SmallPropKind,
  arcId = "goblin_warrens",
  variant = 0,
  season = 0
): void {
  const baked = bakeSmallPropPixels(kind, arcId, variant, season);
  drawSurfaceToGraphics(g, baked);
}
