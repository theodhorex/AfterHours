/**
 * Shaded pixel-art road and bridge tiles for isometric city builder:
 * 5 road styles (dirt, cobble, flagstone, root_path, mine_rails) and timber bridge,
 * lit/shaded kerb edge sets, edge wear blending, and zero purple pixels.
 * Deterministic: zero Math.random or Date.
 */

import { relativeLuminance, type RoadStyle } from "./theme.ts";
import {
  createPixelSurface,
  setPx,
  isPurpleHue,
  coordHash,
  maskToRoadEdges,
  type PixelSurface,
} from "./prop-helpers.ts";

export const ROAD_TILE_W = 64;
export const ROAD_TILE_H = 36;

export interface RoadTileResult extends PixelSurface {
  opaquePixels: number;
  purplePixels: number;
  surfaceHash: number;
  litKerbPixels: number;
  shadedKerbPixels: number;
  edgeWearPixels: number;
  avgLitKerbLum: number;
  avgShadedKerbLum: number;
}

export interface BridgeTileResult extends PixelSurface {
  plankPixels: number;
  ropeRailPixels: number;
  purplePixels: number;
}

function computeFnvHash(rgba: Uint8ClampedArray): number {
  let h = 2166136261;
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3] > 0) {
      h ^= (rgba[i] << 16) | (rgba[i + 1] << 8) | rgba[i + 2];
      h = Math.imul(h, 16777619);
    }
  }
  return h >>> 0;
}

/**
 * Bakes a shaded pixel-art road tile for the given roadStyle and 4-bit connection mask.
 */
export function bakeRoadPixels(
  style: RoadStyle,
  variant: number,
  roadMask: number,
  arcId: string,
  season = 0
): RoadTileResult {
  void arcId;
  void season;
  const surf = createPixelSurface(ROAD_TILE_W, ROAD_TILE_H, 32, 16);
  const edges = maskToRoadEdges(roadMask);

  let opaqueCount = 0;
  let purpleCount = 0;
  let litKerbCount = 0;
  let litKerbLumSum = 0;
  let shadedKerbCount = 0;
  let shadedKerbLumSum = 0;
  let edgeWearCount = 0;

  // Skirt colors
  const leftSkirtCol = 0x42362b;
  const rightSkirtCol = 0x2b221a;
  const skirtBorderCol = 0x19140f;

  // Kerb colors: light lit kerb (N/W) and deep shaded kerb (E/S)
  const litKerbCol = 0xa49e91;
  const shadedKerbCol = 0x3d362e;
  const litKerbLum = relativeLuminance(litKerbCol);
  const shadedKerbLum = relativeLuminance(shadedKerbCol);

  // 1. Skirt drawing on bottom faces
  for (let gx = -32; gx <= 31; gx++) {
    const isLeft = gx < 0;
    const baseGy = isLeft ? Math.round(-gx * 0.5) : Math.round(gx * 0.5);
    for (let dy = 1; dy <= 4; dy++) {
      const gy = baseGy + dy;
      if (gy < ROAD_TILE_H - 16) {
        const col = dy === 4 ? skirtBorderCol : isLeft ? leftSkirtCol : rightSkirtCol;
        setPx(surf, gx, gy, col);
        opaqueCount++;
      }
    }
  }

  // 2. Diamond face and surface details
  for (let gy = -16; gy <= 15; gy++) {
    for (let gx = -32; gx <= 31; gx++) {
      const distN = 16 - (0.5 * gx - gy);
      const distW = 16 - (-0.5 * gx - gy);
      const distE = 16 - (0.5 * gx + gy);
      const distS = 16 - (-0.5 * gx + gy);

      const inDiamond = distN >= 0 && distW >= 0 && distE >= 0 && distS >= 0;

      // Edge wear: just outside or right on border of unconnected edges
      if (!inDiamond) {
        const nearN = !edges.connected.N && gx >= 0 && gy <= 0 && distN >= -1.2 && distN < 0;
        const nearW = !edges.connected.W && gx <= 0 && gy <= 0 && distW >= -1.2 && distW < 0;
        const nearE = !edges.connected.E && gx >= 0 && gy >= 0 && distE >= -1.2 && distE < 0;
        const nearS = !edges.connected.S && gx <= 0 && gy >= 0 && distS >= -1.2 && distS < 0;

        if (nearN || nearW || nearE || nearS) {
          if (coordHash(gx, gy, 83) < 0.55) {
            const wearCol = coordHash(gx, gy, 19) < 0.4 ? 0x756650 : 0x5a4d3b;
            setPx(surf, gx, gy, wearCol);
            opaqueCount++;
            edgeWearCount++;
          }
        }
        continue;
      }

      // Check kerb borders (1.6px band along unconnected edges)
      const isLitKerbN = !edges.connected.N && gx >= 0 && gy <= 0 && distN <= 1.6;
      const isLitKerbW = !edges.connected.W && gx <= 0 && gy <= 0 && distW <= 1.6;
      const isShadedKerbE = !edges.connected.E && gx >= 0 && gy >= 0 && distE <= 1.6;
      const isShadedKerbS = !edges.connected.S && gx <= 0 && gy >= 0 && distS <= 1.6;

      if (isLitKerbN || isLitKerbW) {
        setPx(surf, gx, gy, litKerbCol);
        opaqueCount++;
        litKerbCount++;
        litKerbLumSum += litKerbLum;
        continue;
      }

      if (isShadedKerbE || isShadedKerbS) {
        setPx(surf, gx, gy, shadedKerbCol);
        opaqueCount++;
        shadedKerbCount++;
        shadedKerbLumSum += shadedKerbLum;
        continue;
      }

      // Inside road surface: style-specific texture
      let pxColor = 0x614f3c;

      if (style === "dirt") {
        // Packed earth with wheel ruts and pebbles
        const rut1 = Math.abs(gy - 0.5 * gx + 4) <= 1.2;
        const rut2 = Math.abs(gy - 0.5 * gx - 4) <= 1.2;
        if (rut1 || rut2) {
          pxColor = 0x433324;
        } else if (coordHash(gx, gy, 11) > 0.92) {
          pxColor = 0x8a7f70; // Pebble
        } else if (((gx ^ gy) & 3) === 0) {
          pxColor = 0x6e5a45;
        } else {
          pxColor = 0x594633;
        }
      } else if (style === "cobble") {
        // Irregular stones with dark mortar
        const m1 = ((gx + 2 * gy + 32) % 6 + 6) % 6;
        const m2 = ((gx - 2 * gy + 32) % 6 + 6) % 6;
        const isMortar = m1 === 0 || m2 === 0;
        if (isMortar) {
          pxColor = 0x2e2720; // Dark mortar
        } else if (m1 === 1 || m2 === 1) {
          pxColor = 0x90897d; // Lit stone edge
        } else if (m1 >= 4 || m2 >= 4) {
          pxColor = 0x524c43; // Shaded stone edge
        } else {
          pxColor = 0x736c61; // Stone mid
        }
      } else if (style === "flagstone") {
        // Large slabs with moss in cracks
        const sx = ((gx + Math.round(gy * 1.5) + 64) % 12 + 12) % 12;
        const sy = ((Math.round(gy * 1.5) - gx + 64) % 8 + 8) % 8;
        const isCrack = sx === 0 || sy === 0;
        if (isCrack) {
          if (coordHash(gx, gy, 47) < 0.45) {
            pxColor = 0x466632; // Moss in crack
          } else {
            pxColor = 0x26221c; // Dark crack
          }
        } else if (sx === 1 || sy === 1) {
          pxColor = 0x888377; // Lit slab edge
        } else {
          pxColor = 0x6c675c; // Smooth slab
        }
      } else if (style === "root_path") {
        // Packed earth with roots
        const root1 = Math.abs(gy - Math.sin(gx * 0.22) * 4) <= 1.4;
        const root2 = Math.abs(0.5 * gx + gy - Math.cos(gx * 0.18) * 3) <= 1.2;
        if (root1 || root2) {
          pxColor = ((gx + gy) & 1) === 0 ? 0x54371e : 0x362112; // Bark root
        } else if (coordHash(gx, gy, 55) > 0.88) {
          pxColor = 0x766048;
        } else {
          pxColor = 0x56412b;
        }
      } else if (style === "mine_rails") {
        // Gravel with two iron rails and wooden sleepers
        const tie = ((gx + 2 * gy + 32) % 7 + 7) % 7;
        const isTie = tie <= 1;
        const r1 = Math.abs(gx - 2 * gy - 7) <= 1.0;
        const r2 = Math.abs(gx - 2 * gy + 7) <= 1.0;

        if (r1 || r2) {
          pxColor = ((gx + gy) & 1) === 0 ? 0x9ca5b0 : 0x414750; // Steel rails
        } else if (isTie) {
          pxColor = 0x3a2818; // Wooden sleeper
        } else if (coordHash(gx, gy, 31) > 0.85) {
          pxColor = 0x605c56; // Gravel speck
        } else {
          pxColor = 0x48443e; // Gravel ballast
        }
      }

      if (variant === 1 && style !== "mine_rails" && coordHash(gx, gy, 99) > 0.95) {
        pxColor = 0x827768;
      }

      if (isPurpleHue(pxColor)) {
        purpleCount++;
      }

      setPx(surf, gx, gy, pxColor);
      opaqueCount++;
    }
  }

  const avgLitKerbLum = litKerbCount > 0 ? litKerbLumSum / litKerbCount : 0;
  const avgShadedKerbLum = shadedKerbCount > 0 ? shadedKerbLumSum / shadedKerbCount : 0;
  const surfaceHash = computeFnvHash(surf.rgba);

  return {
    ...surf,
    opaquePixels: opaqueCount,
    purplePixels: purpleCount,
    surfaceHash,
    litKerbPixels: litKerbCount,
    shadedKerbPixels: shadedKerbCount,
    edgeWearPixels: edgeWearCount,
    avgLitKerbLum,
    avgShadedKerbLum,
  };
}

/**
 * Bakes a shaded pixel-art timber plank bridge tile with rope rails over water.
 */
export function bakeBridgePixels(
  variant: number,
  roadMask: number,
  arcId: string,
  season = 0
): BridgeTileResult {
  void arcId;
  void season;
  void variant;
  const surf = createPixelSurface(ROAD_TILE_W, ROAD_TILE_H, 32, 16);
  const edges = maskToRoadEdges(roadMask);

  let plankCount = 0;
  let ropeRailCount = 0;
  let purpleCount = 0;

  // Water background in diamond
  const waterCol = 0x368ba8;
  const waterFoamCol = 0x58afcc;

  for (let gy = -16; gy <= 15; gy++) {
    for (let gx = -32; gx <= 31; gx++) {
      const distN = 16 - (0.5 * gx - gy);
      const distW = 16 - (-0.5 * gx - gy);
      const distE = 16 - (0.5 * gx + gy);
      const distS = 16 - (-0.5 * gx + gy);

      if (distN < 0 || distW < 0 || distE < 0 || distS < 0) continue;

      // Water base underneath
      const isWaterMargin =
        (!edges.connected.N && distN < 2.5) ||
        (!edges.connected.S && distS < 2.5) ||
        (!edges.connected.E && distE < 2.5) ||
        (!edges.connected.W && distW < 2.5);

      if (isWaterMargin) {
        const col = ((gx + gy) & 3) === 0 ? waterFoamCol : waterCol;
        setPx(surf, gx, gy, col);
        continue;
      }

      // Timber planks across the bridge deck
      const plankStep = ((gx + 2 * gy + 64) % 5 + 5) % 5;
      let col = 0x5e452c;
      if (plankStep === 0) {
        col = 0x22170d; // Plank gap shadow
      } else if (plankStep === 1) {
        col = 0x7c5d3d; // Lit plank edge
      } else {
        col = 0x634a31; // Plank wood
      }

      setPx(surf, gx, gy, col);
      plankCount++;
    }
  }

  // Rope rails along unconnected flank edges
  for (let gy = -16; gy <= 15; gy++) {
    for (let gx = -32; gx <= 31; gx++) {
      const distN = 16 - (0.5 * gx - gy);
      const distW = 16 - (-0.5 * gx - gy);
      const distE = 16 - (0.5 * gx + gy);
      const distS = 16 - (-0.5 * gx + gy);

      const isRailW = !edges.connected.W && gx <= 0 && gy <= 0 && distW >= 1.0 && distW <= 3.2;
      const isRailE = !edges.connected.E && gx >= 0 && gy >= 0 && distE >= 1.0 && distE <= 3.2;
      const isRailN = !edges.connected.N && gx >= 0 && gy <= 0 && distN >= 1.0 && distN <= 3.2;
      const isRailS = !edges.connected.S && gx <= 0 && gy >= 0 && distS >= 1.0 && distS <= 3.2;

      if (isRailW || isRailE || isRailN || isRailS) {
        const isPost = ((gx + gy) % 6 + 6) % 6 <= 1;
        const railCol = isPost ? 0x3d2716 : 0xaa8c58; // Post or hemp rope
        setPx(surf, gx, gy, railCol);
        ropeRailCount++;
      }
    }
  }

  for (let i = 0; i < surf.rgba.length; i += 4) {
    if (surf.rgba[i + 3] > 0) {
      const hex = (surf.rgba[i] << 16) | (surf.rgba[i + 1] << 8) | surf.rgba[i + 2];
      if (isPurpleHue(hex)) {
        purpleCount++;
      }
    }
  }

  return {
    ...surf,
    plankPixels: plankCount,
    ropeRailPixels: ropeRailCount,
    purplePixels: purpleCount,
  };
}
