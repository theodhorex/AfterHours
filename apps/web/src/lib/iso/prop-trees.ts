/**
 * Shaded pixel-art tree generator (up to 56x72 px, anchor 0.5, 0.88).
 * 3 distinct variants per arc, 5-6 step hue-shifted canopy ramps (lit upper-left,
 * cool shadow lower-right), dithered edge clumps, outlined trunk, and baked soft
 * blue-tinted ground shadow ellipse (alpha ~0.25).
 * Deterministic: zero Math.random or Date.
 */

import {
  buildHueRamp,
  propOutlineColor,
  ditherStep,
  coordHash,
  pickTreeVariant,
  createPixelSurface,
  setPx,
  drawSoftShadow,
  computeSilhouetteHash,
  type PixelSurface,
} from "./prop-helpers.ts";

export const TREE_MAX_W = 56;
export const TREE_MAX_H = 72;
export const TREE_ANCHOR_X = 28;
export const TREE_ANCHOR_Y = 63; // 63 / 72 = 0.875 (~0.88 anchor)

export interface BakedTreeResult extends PixelSurface {
  opaquePixels: number;
  shadowPixels: number;
  canopyColors: Set<number>;
  silhouetteHash: number;
}

/**
 * Draws a shaded trunk with dark selective outline and root flare.
 */
function drawTrunk(
  surf: PixelSurface, baseX: number, topY: number, bottomW: number, topW: number, leanX: number, barkHex: number
): void {
  const ramp = buildHueRamp(barkHex, 6);
  const outline = propOutlineColor(ramp[1]);
  const height = Math.max(4, -topY);

  for (let y = 1; y >= topY; y--) {
    const t = Math.max(0, Math.min(1, -y / height));
    const curve = Math.sin(t * Math.PI) * leanX;
    const cx = baseX + curve;
    const flare = y >= -2 ? (3 + y) * 0.9 : 0;
    const halfW = Math.max(1.5, (bottomW * (1 - t) + topW * t) * 0.5 + flare);
    const xMin = Math.round(cx - halfW);
    const xMax = Math.round(cx + halfW);

    for (let x = xMin; x <= xMax; x++) {
      if (x === xMin || x === xMax || y === 1) {
        setPx(surf, x, y, outline);
      } else {
        const relX = (x - cx) / Math.max(1, halfW);
        const barkGrain = (coordHash(x, y, 17) - 0.5) * 0.18;
        const lit = 0.52 - relX * 0.35 + barkGrain;
        const step = ditherStep(lit, 6, x + 28, y + 63);
        setPx(surf, x, y, ramp[step]);
      }
    }
  }
}

/**
 * Draws a dithered, shaded foliage clump with 6-step hue-shifted ramp and selective dark outline.
 */
function drawCanopyClump(
  surf: PixelSurface, cx: number, cy: number, rx: number, ry: number, ramp: number[],
  canopyColors: Set<number>, salt: number, snowCap = false, accentHex?: number
): void {
  const outline = propOutlineColor(ramp[0]);
  const snowRamp = snowCap ? buildHueRamp(0xe6eff6, 6) : null;
  const minX = Math.floor(cx - rx - 2);
  const maxX = Math.ceil(cx + rx + 2);
  const minY = Math.floor(cy - ry - 2);
  const maxY = Math.ceil(cy + ry + 2);

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const nx = (x - cx) / Math.max(1, rx);
      const ny = (y - cy) / Math.max(1, ry);
      const angleSalt = Math.floor((Math.atan2(ny, nx) + Math.PI) * 3.5);
      const clumpJit = (coordHash(angleSalt, salt, 31) - 0.5) * 0.22;
      const ditherEdge = (coordHash(x, y, salt + 7) - 0.5) * 0.16;
      const dist = Math.sqrt(nx * nx + ny * ny) + clumpJit + ditherEdge;

      if (dist > 1.04) continue;
      if (dist > 0.91) {
        // Selective dark outline (darker on lower-right, softer on upper-left)
        const edgeCol = nx + ny < -0.2 ? ramp[1] : outline;
        setPx(surf, x, y, edgeCol);
        canopyColors.add(edgeCol);
        continue;
      }

      // Upper-left light source: (-nx - ny) is positive in upper-left, negative in lower-right
      const dirLight = (-nx * 0.55 - ny * 0.65) * 0.48 + 0.52;
      const dome = Math.max(0, 1 - dist * 0.55) * 0.15;
      const leafTex = (coordHash(x >> 1, y >> 1, salt + 19) - 0.5) * 0.18;
      const lum = Math.max(0.02, Math.min(0.98, dirLight + dome + leafTex));

      if (snowRamp && ny < -0.18 + (coordHash(x, y, salt + 41) - 0.5) * 0.25) {
        const sStep = ditherStep(Math.min(0.98, lum + 0.15), 6, x + 28, y + 63);
        const sCol = snowRamp[sStep];
        setPx(surf, x, y, sCol);
        canopyColors.add(sCol);
      } else if (accentHex && lum > 0.58 && coordHash(x, y, salt + 53) > 0.86) {
        setPx(surf, x, y, accentHex);
        canopyColors.add(accentHex);
      } else {
        const step = ditherStep(lum, ramp.length, x + 28, y + 63, 0.52);
        const col = ramp[step];
        setPx(surf, x, y, col);
        canopyColors.add(col);
      }
    }
  }
}

/**
 * Draws bare winter branches with snow caps along upper surfaces.
 */
function drawBareBranchesWithSnow(
  surf: PixelSurface, cx: number, topY: number, spreadX: number,
  barkHex: number, canopyColors: Set<number>, salt: number
): void {
  const barkRamp = buildHueRamp(barkHex, 6);
  const snowRamp = buildHueRamp(0xe8f1f8, 6);
  const outline = propOutlineColor(barkRamp[0]);
  const branches = [
    { dx: -spreadX, dy: -14, mx: -spreadX * 0.5, my: -6 },
    { dx: spreadX, dy: -13, mx: spreadX * 0.5, my: -5 },
    { dx: -spreadX * 0.65, dy: -22, mx: -spreadX * 0.3, my: -13 },
    { dx: spreadX * 0.65, dy: -21, mx: spreadX * 0.3, my: -12 },
    { dx: -2, dy: -25, mx: 1, my: -14 },
  ];

  for (let b = 0; b < branches.length; b++) {
    const br = branches[b];
    const steps = 20;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const u = 1 - t;
      const x = Math.round(cx + 2 * u * t * br.mx + t * t * br.dx);
      const y = Math.round(topY + 2 * u * t * br.my + t * t * br.dy);
      setPx(surf, x, y, barkRamp[3]);
      setPx(surf, x + 1, y, barkRamp[1]);
      setPx(surf, x, y + 1, outline);
      // Snow cap perched above branch
      const sCol = snowRamp[ditherStep(0.65 + (1 - t) * 0.25, 6, x + 28, y + 63)];
      setPx(surf, x, y - 1, sCol);
      if (i % 2 === 0) setPx(surf, x - 1, y - 1, snowRamp[4]);
      canopyColors.add(sCol);
      canopyColors.add(barkRamp[3]);
      canopyColors.add(barkRamp[1]);
    }
  }
  // Small snow-dusted twig clusters at branch tips
  drawCanopyClump(surf, cx - spreadX * 0.6, topY - 19, 6, 4, barkRamp, canopyColors, salt + 1, true);
  drawCanopyClump(surf, cx + spreadX * 0.55, topY - 18, 6, 4, barkRamp, canopyColors, salt + 2, true);
  drawCanopyClump(surf, cx, topY - 23, 7, 4, barkRamp, canopyColors, salt + 3, true);
}

/**
 * Draws a spotted toadstool cap + stalk for goblin_warrens.
 */
function drawToadstool(
  surf: PixelSurface, cx: number, baseY: number, stalkH: number, rx: number, ry: number,
  capBaseHex: number, spotHex: number, snowCap: boolean, canopyColors: Set<number>, salt: number
): void {
  const stalkRamp = buildHueRamp(0xb5a68e, 6);
  const stalkOut = propOutlineColor(stalkRamp[1]);
  const gillCol = 0x2c221c;

  for (let y = baseY; y >= baseY - stalkH; y--) {
    const t = (baseY - y) / Math.max(1, stalkH);
    const hw = Math.max(2, Math.round(3.2 - t * 0.8 + (y > baseY - 3 ? 1 : 0)));
    for (let x = cx - hw; x <= cx + hw; x++) {
      if (x === cx - hw || x === cx + hw) setPx(surf, x, y, stalkOut);
      else {
        const s = ditherStep(0.55 - ((x - cx) / hw) * 0.3, 6, x + 28, y + 63);
        setPx(surf, x, y, stalkRamp[s]);
      }
    }
  }

  // Dark underside gills
  const capCy = baseY - stalkH - 2;
  for (let x = cx - rx + 2; x <= cx + rx - 2; x++) {
    setPx(surf, x, capCy + 2, gillCol);
    setPx(surf, x, capCy + 3, stalkOut);
  }

  // Shaded toadstool cap dome
  const capRamp = buildHueRamp(capBaseHex, 6);
  drawCanopyClump(surf, cx, capCy - 2, rx, ry, capRamp, canopyColors, salt, snowCap);

  // Contrasting wart spots on cap
  const spots = [
    { dx: -Math.round(rx * 0.45), dy: -Math.round(ry * 0.35), r: 2.1 },
    { dx: Math.round(rx * 0.38), dy: -Math.round(ry * 0.2), r: 1.8 },
    { dx: 0, dy: -Math.round(ry * 0.55), r: 1.9 },
    { dx: -Math.round(rx * 0.2), dy: Math.round(ry * 0.1), r: 1.5 },
  ];
  const spotRamp = buildHueRamp(spotHex, 5);
  for (const sp of spots) {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (dx * dx + dy * dy <= sp.r * sp.r) {
          const c = dx + dy <= 0 ? spotRamp[4] : spotRamp[2];
          setPx(surf, cx + sp.dx + dx, capCy - 2 + sp.dy, c);
          canopyColors.add(c);
        }
      }
    }
  }
}

/**
 * Bakes a shaded pixel tree into a 56x72 PixelSurface with metadata for unit tests.
 */
export function bakeTreePixels(
  treeType: number, arcId: string, season = 0
): BakedTreeResult {
  const surf = createPixelSurface(TREE_MAX_W, TREE_MAX_H, TREE_ANCHOR_X, TREE_ANCHOR_Y);
  const variant = pickTreeVariant(treeType, arcId, season);
  const sIdx = ((Math.floor(season) % 4) + 4) % 4;
  const isSpring = sIdx === 0;
  const isSummer = sIdx === 1;
  const isAutumn = sIdx === 2;
  const isWinter = sIdx === 3;

  const shadowPixels = drawSoftShadow(surf, 0, 0, 14, 6, 0.25);
  const canopyColors = new Set<number>();
  const salt = variant * 37 + sIdx * 13;

  if (arcId === "goblin_warrens") {
    const bogLeafHex = isAutumn ? 0x9c5426 : isSummer ? 0x436630 : 0x527a3c;
    const leafRamp = buildHueRamp(bogLeafHex, 6);
    if (variant === 0) {
      // Bent bog tree
      drawTrunk(surf, 0, -24, 6, 3, 4.5, 0x4f3e2e);
      if (isWinter) {
        drawBareBranchesWithSnow(surf, 2, -22, 14, 0x4f3e2e, canopyColors, salt);
      } else {
        drawCanopyClump(surf, -6, -28, 11, 8, leafRamp, canopyColors, salt + 1, false, isSpring ? 0xa3d95b : undefined);
        drawCanopyClump(surf, 7, -25, 10, 7, leafRamp, canopyColors, salt + 2);
        drawCanopyClump(surf, 0, -35, 12, 8, leafRamp, canopyColors, salt + 3);
      }
    } else if (variant === 1) {
      // Giant spotted toadstool
      const capHex = isAutumn ? 0xa64b24 : isSpring ? 0x8f4236 : 0x7d4e2d;
      drawToadstool(surf, 0, 0, 20, 16, 10, capHex, 0xefe2c2, isWinter, canopyColors, salt + 5);
    } else {
      // Leaning bog willow + twin toadstools at base
      drawTrunk(surf, -3, -20, 6, 3, -3.5, 0x4a3b2c);
      if (isWinter) {
        drawBareBranchesWithSnow(surf, -5, -19, 12, 0x4a3b2c, canopyColors, salt + 7);
      } else {
        drawCanopyClump(surf, -6, -27, 12, 8, leafRamp, canopyColors, salt + 8);
        drawCanopyClump(surf, 3, -23, 9, 6, leafRamp, canopyColors, salt + 9);
      }
      drawToadstool(surf, 8, 1, 9, 8, 5, 0x96482b, 0xf2e4c6, isWinter, canopyColors, salt + 10);
    }
  } else if (arcId === "cave_hold") {
    const pineHex = isAutumn ? 0x5e5838 : isSummer ? 0x2f4d40 : 0x3b6150;
    const pineRamp = buildHueRamp(pineHex, 6);
    const cryRamp = buildHueRamp(isAutumn ? 0xe08238 : 0x48b4cc, 6);
    if (variant === 0) {
      // Dark layered cavern/alpine pine
      drawTrunk(surf, 0, -16, 5, 3, 0, 0x42352b);
      drawCanopyClump(surf, 0, -20, 15, 7, pineRamp, canopyColors, salt + 1, isWinter);
      drawCanopyClump(surf, 0, -30, 12, 7, pineRamp, canopyColors, salt + 2, isWinter);
      drawCanopyClump(surf, 0, -39, 9, 6, pineRamp, canopyColors, salt + 3, isWinter);
      drawCanopyClump(surf, 0, -46, 5, 5, pineRamp, canopyColors, salt + 4, isWinter);
    } else if (variant === 1) {
      // Crystal-tipped dead tree
      drawTrunk(surf, 0, -22, 6, 3, 1.5, 0x3d3530);
      drawBareBranchesWithSnow(surf, 0, -20, 13, 0x3d3530, canopyColors, salt + 5);
      drawCanopyClump(surf, -11, -32, 5, 6, cryRamp, canopyColors, salt + 6, isWinter, 0xd8f8ff);
      drawCanopyClump(surf, 10, -30, 5, 6, cryRamp, canopyColors, salt + 7, isWinter, 0xd8f8ff);
      drawCanopyClump(surf, 0, -40, 6, 7, cryRamp, canopyColors, salt + 8, isWinter, 0xd8f8ff);
    } else {
      // Twin dark pines with basal crystal cluster
      drawTrunk(surf, -5, -14, 4, 2, 0, 0x3e3229);
      drawCanopyClump(surf, -5, -20, 11, 6, pineRamp, canopyColors, salt + 9, isWinter);
      drawCanopyClump(surf, -5, -29, 8, 6, pineRamp, canopyColors, salt + 10, isWinter);
      drawTrunk(surf, 6, -11, 4, 2, 0, 0x3e3229);
      drawCanopyClump(surf, 6, -16, 9, 5, pineRamp, canopyColors, salt + 11, isWinter);
      drawCanopyClump(surf, 1, -5, 5, 5, cryRamp, canopyColors, salt + 12, isWinter, 0xd8f8ff);
    }
  } else if (arcId === "dino_vale") {
    const frondHex = isAutumn ? 0xb56d22 : isWinter ? 0x6f8044 : isSummer ? 0x457d2a : 0x589438;
    const frondRamp = buildHueRamp(frondHex, 6);
    if (variant === 0) {
      // Tall tropical palm
      drawTrunk(surf, 0, -38, 5, 3, 3.5, 0x6e5236);
      // Palm frond arcs
      const angles = [-2.6, -2.0, -1.3, -0.5, 0.2, 0.9, 2.2];
      for (let a = 0; a < angles.length; a++) {
        const ang = angles[a];
        const fx = Math.round(Math.cos(ang) * 12);
        const fy = -39 + Math.round(Math.sin(ang) * 6) + 2;
        drawCanopyClump(surf, fx, fy, 8, 4, frondRamp, canopyColors, salt + a);
      }
      drawCanopyClump(surf, 0, -41, 7, 5, frondRamp, canopyColors, salt + 15);
    } else if (variant === 1) {
      // Giant prehistoric tree fern / cycad
      drawTrunk(surf, 0, -17, 7, 5, 0, 0x593e25);
      drawCanopyClump(surf, -12, -21, 10, 5, frondRamp, canopyColors, salt + 21);
      drawCanopyClump(surf, 12, -20, 10, 5, frondRamp, canopyColors, salt + 22);
      drawCanopyClump(surf, -6, -27, 9, 5, frondRamp, canopyColors, salt + 23);
      drawCanopyClump(surf, 6, -26, 9, 5, frondRamp, canopyColors, salt + 24);
      drawCanopyClump(surf, 0, -23, 11, 6, frondRamp, canopyColors, salt + 25, false, isSpring ? 0xa3e635 : undefined);
    } else {
      // Double tropical palm & low fern
      drawTrunk(surf, -5, -34, 4, 2.5, -2.5, 0x6b4f34);
      drawCanopyClump(surf, -8, -36, 11, 6, frondRamp, canopyColors, salt + 31);
      drawTrunk(surf, 6, -22, 4, 2.5, 2.0, 0x6b4f34);
      drawCanopyClump(surf, 8, -25, 10, 5, frondRamp, canopyColors, salt + 32);
      drawCanopyClump(surf, 0, -9, 8, 4, frondRamp, canopyColors, salt + 33);
    }
  } else {
    // elf_grove: broad round oaks with glow-blossom accent in spring and gold in autumn
    const isBlossomSort = isSpring && variant === 1;
    const oakBaseHex = isAutumn
      ? variant === 0 ? 0xd98616 : variant === 1 ? 0xe59c18 : 0xc96e14
      : isBlossomSort
        ? 0xd9689a
        : isSummer
          ? 0x3b7d44
          : 0x4a9152;
    const oakRamp = buildHueRamp(oakBaseHex, 6);
    const blossomAccent = isSpring ? 0xfce7f3 : isAutumn ? 0xfef08a : undefined;

    drawTrunk(surf, 0, -22, 8, 4, variant === 2 ? -1.5 : 0.8, 0x544232);
    if (variant === 2) {
      // Warm lit window/lantern hollow in elder trunk
      setPx(surf, 0, -10, 0xfef08a);
      setPx(surf, 1, -10, 0xf59e0b);
      setPx(surf, 0, -11, 0xfef08a);
    }

    if (isWinter) {
      drawBareBranchesWithSnow(surf, 0, -20, 15, 0x544232, canopyColors, salt + 40);
    } else if (variant === 0) {
      drawCanopyClump(surf, -9, -29, 11, 9, oakRamp, canopyColors, salt + 41, false, blossomAccent);
      drawCanopyClump(surf, 9, -28, 11, 9, oakRamp, canopyColors, salt + 42, false, blossomAccent);
      drawCanopyClump(surf, 0, -37, 14, 10, oakRamp, canopyColors, salt + 43, false, blossomAccent);
    } else if (variant === 1) {
      drawCanopyClump(surf, -10, -31, 12, 10, oakRamp, canopyColors, salt + 44, false, blossomAccent);
      drawCanopyClump(surf, 10, -30, 12, 10, oakRamp, canopyColors, salt + 45, false, blossomAccent);
      drawCanopyClump(surf, 0, -40, 15, 11, oakRamp, canopyColors, salt + 46, false, blossomAccent);
    } else {
      drawCanopyClump(surf, -12, -27, 11, 8, oakRamp, canopyColors, salt + 47, false, blossomAccent);
      drawCanopyClump(surf, 11, -26, 11, 8, oakRamp, canopyColors, salt + 48, false, blossomAccent);
      drawCanopyClump(surf, -4, -36, 13, 9, oakRamp, canopyColors, salt + 49, false, blossomAccent);
      drawCanopyClump(surf, 5, -35, 12, 9, oakRamp, canopyColors, salt + 50, false, blossomAccent);
    }
  }

  let opaquePixels = 0;
  for (let i = 3; i < surf.rgba.length; i += 4) {
    if (surf.rgba[i] > 180) opaquePixels++;
  }

  return {
    ...surf,
    opaquePixels,
    shadowPixels,
    canopyColors,
    silhouetteHash: computeSilhouetteHash(surf.rgba),
  };
}
