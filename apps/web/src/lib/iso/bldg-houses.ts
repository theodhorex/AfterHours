/**
 * Procedural pixel-art citizen house sprites (up to 80x80 px canvas).
 * 4 variants x levels 0..3+ per arc with 2:1 cuboid base, shingled gabled/domed roofs,
 * lit left / shaded right walls, doors, 1..3 windows (lit amber on odd variants),
 * garden/fence on level >= 1, chimney on level >= 2, and soft blue-tinted cast shadow.
 */

import {
  type BldgMaterials,
  type PixelGrid,
  createPixelGrid,
  getArcMaterials,
  drawCastShadow,
  drawIsoCuboid,
  drawGableRoof,
  drawDomeRoof,
  setPx,
  fillRectPx,
  selectiveOutline,
  finalizePixelGrid,
  pickVariantChoice,
} from "./bldg-ramp.ts";

export const HOUSE_CANVAS_SIZE = 80;

function drawHouseDoor(
  grid: PixelGrid,
  dxCenter: number,
  wL: number,
  wR: number,
  mat: BldgMaterials,
  isArched = false
): void {
  const isLeft = dxCenter < 0;
  const dist = Math.abs(dxCenter);
  const baseY = Math.floor((isLeft ? wL - dist : wR - dist) / 2);
  const doorW = 4;
  const doorH = 7;

  for (let ix = -2; ix < doorW - 2; ix++) {
    const x = dxCenter + ix;
    const slopeY = baseY + Math.floor(ix / 2) * (isLeft ? -1 : 1);
    setPx(grid, x, slopeY + 1, mat.stone[3], 5);
    for (let iy = 0; iy < doorH; iy++) {
      if (isArched && iy === doorH - 1 && (ix === -2 || ix === doorW - 3)) continue;
      const y = slopeY - iy;
      const isFrame = ix === -2 || ix === doorW - 3 || iy === doorH - 1;
      const col = isFrame ? mat.wood[1] : mat.wood[isLeft ? 3 : 2];
      setPx(grid, x, y, col, 5);
    }
  }
  setPx(grid, dxCenter + 1, baseY - 3, mat.copper[3], 5);
}

function drawHouseWindow(
  grid: PixelGrid,
  dxCenter: number,
  yCenter: number,
  lit: boolean,
  mat: BldgMaterials,
  hangingFlowers = false
): void {
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 1; dx++) {
      const isFrame = dy === -2 || dy === 2 || dx === -2 || dx === 1;
      if (isFrame) {
        setPx(grid, dxCenter + dx, yCenter + dy, dy === 2 ? mat.stone[3] : mat.wood[1], 5);
      } else if (lit) {
        const glow = dy <= 0 && dx === -1 ? mat.windowLit[2] : mat.windowLit[1];
        setPx(grid, dxCenter + dx, yCenter + dy, glow, 9);
      } else {
        setPx(grid, dxCenter + dx, yCenter + dy, mat.windowDark, 5);
      }
    }
  }
  if (hangingFlowers) {
    setPx(grid, dxCenter - 2, yCenter + 3, mat.foliage[2], 6);
    setPx(grid, dxCenter - 1, yCenter + 3, mat.accent, 6);
    setPx(grid, dxCenter, yCenter + 3, mat.foliage[3], 6);
    setPx(grid, dxCenter, yCenter + 4, mat.accent, 6);
  }
}

function drawHouseChimney(
  grid: PixelGrid,
  dx: number,
  topY: number,
  mat: BldgMaterials
): void {
  const h = 9;
  for (let iy = 0; iy < h; iy++) {
    for (let ix = 0; ix < 4; ix++) {
      const col = ix < 2 ? mat.stone[3] : mat.stone[1];
      setPx(grid, dx + ix, topY + iy, iy === 0 ? selectiveOutline(col) : col, 5);
    }
  }
  fillRectPx(grid, dx - 1, topY, 6, 2, mat.hasSnow ? mat.snow[3] : mat.stone[4], 5);
  setPx(grid, dx + 1, topY - 1, 0x1a1618, 5);
  setPx(grid, dx + 2, topY - 1, 0x1a1618, 5);
  grid.hasChimney = true;
}

function drawHouseGardenOrFence(
  grid: PixelGrid,
  wL: number,
  wR: number,
  arcId: string,
  mat: BldgMaterials,
  variant: number
): void {
  const sideLeft = variant % 2 === 0;
  const startX = sideLeft ? -wL - 7 : wR + 2;
  const baseY = 2;

  for (let i = 0; i < 6; i++) {
    const fx = startX + i;
    const fy = baseY + Math.floor(i / 2) * (sideLeft ? 1 : -1);
    setPx(grid, fx, fy + 1, mat.foliage[1], 6);
    setPx(grid, fx, fy, mat.foliage[2], 6);

    const postCol = arcId === "dino_vale" ? mat.bone[3] : arcId === "cave_hold" ? mat.stone[3] : mat.wood[3];
    if (i % 2 === 0) {
      setPx(grid, fx, fy - 1, postCol, 6);
      setPx(grid, fx, fy - 2, postCol, 6);
      setPx(grid, fx, fy - 3, selectiveOutline(postCol), 6);
    }
    setPx(grid, fx, fy - 1, postCol, 6);
  }

  const propX = sideLeft ? startX + 2 : startX + 3;
  setPx(grid, propX, baseY - 2, mat.accent, 6);
  setPx(grid, propX + 1, baseY - 1, mat.foliage[3], 6);
  grid.hasGardenOrFence = true;
}

/**
 * Bakes a single house sprite into an 80x80 PixelGrid with anchor at (40, 68) = (0.5, 0.85).
 */
export function bakeHousePixels(
  variant: number,
  level: number,
  arcId: string,
  season = 0
): PixelGrid {
  const grid = createPixelGrid(HOUSE_CANVAS_SIZE, HOUSE_CANVAS_SIZE);
  const v = ((Math.floor(variant) % 4) + 4) % 4;
  const lv = Math.max(0, Math.min(4, Math.floor(level)));
  const mat = getArcMaterials(arcId, season, false);

  const dims = [
    { wL: 13, wR: 13, wallH: 13 },
    { wL: 15, wR: 12, wallH: 14 },
    { wL: 12, wR: 14, wallH: 16 },
    { wL: 15, wR: 15, wallH: 14 },
  ][v];

  const wL = dims.wL + Math.min(2, Math.floor(lv / 2));
  const wR = dims.wR + Math.min(2, Math.floor(lv / 2));
  const wallH = dims.wallH + lv * 3;
  const ridgeH = 9 + Math.min(4, lv);
  const isOdd = v % 2 === 1;

  // 1. Soft blue-tinted cast shadow at the base (alpha ~0.25)
  drawCastShadow(grid, wL + 6, Math.round((wL + wR) * 0.28) + 3, 0.25);

  // 2. Garden or fence detail on level >= 1
  if (lv >= 1) {
    drawHouseGardenOrFence(grid, wL, wR, arcId, mat, v);
  }

  // 3. Isometric cuboid walls & arc-specific roof
  const isTimber = arcId === "elf_grove" || (arcId === "goblin_warrens" && isOdd);
  drawIsoCuboid(grid, wL, wR, wallH, mat.wall, mat.stone, mat.wood, {
    foundationH: arcId === "cave_hold" ? 4 : 3,
    timberFrame: isTimber,
  });

  if (arcId === "goblin_warrens" && !isOdd) {
    // Goblin mushroom-cap cottage
    drawDomeRoof(grid, wL + 4, ridgeH + 3, -wallH - 2, mat.roof, {
      hasSnow: mat.hasSnow,
      snowRamp: mat.snow,
      spotColor: mat.accent,
    });
  } else if (arcId === "dino_vale") {
    // Dino Vale thatched round/oval hut with bone trims
    drawDomeRoof(grid, wL + 3, ridgeH + 2, -wallH - 2, mat.roof, {
      hasSnow: mat.hasSnow,
      snowRamp: mat.snow,
      boneTrimRamp: mat.bone,
    });
    // Bone horn crest at apex
    setPx(grid, -2, -wallH - ridgeH - 3, mat.bone[4], 5);
    setPx(grid, -3, -wallH - ridgeH - 4, mat.bone[3], 5);
    setPx(grid, 2, -wallH - ridgeH - 3, mat.bone[4], 5);
    setPx(grid, 3, -wallH - ridgeH - 4, mat.bone[3], 5);
  } else {
    // Gabled shingle roof (scrap-wood patched for odd goblin, slate for cave_hold, leaf-shingle for elf_grove)
    drawGableRoof(grid, wL, wR, wallH, ridgeH, mat.roof, {
      hasSnow: mat.hasSnow,
      snowRamp: mat.snow,
      patchedRamp: arcId === "goblin_warrens" ? mat.roofAlt : undefined,
    });
  }

  // 4. Door & 1..3 Windows (lit amber on odd variants)
  const doorOnLeft = pickVariantChoice(arcId, lv, v, "doorSide", [true, false]);
  const doorX = doorOnLeft ? -Math.floor(wL * 0.45) : Math.floor(wR * 0.45);
  drawHouseDoor(grid, doorX, wL, wR, mat, arcId === "elf_grove" || arcId === "cave_hold");

  const hanging = arcId === "elf_grove";
  const winY = -Math.floor(wallH * 0.52);
  const win1X = doorOnLeft ? Math.floor(wR * 0.48) : -Math.floor(wL * 0.48);
  drawHouseWindow(grid, win1X, winY, isOdd, mat, hanging);

  if (lv >= 1 || v >= 2) {
    const win2X = doorOnLeft ? -Math.floor(wL * 0.78) : Math.floor(wR * 0.78);
    drawHouseWindow(grid, win2X, winY - 1, isOdd, mat, hanging);
  }
  if (lv >= 2) {
    drawHouseWindow(grid, 0, -wallH + 3, isOdd, mat, false);
  }

  // 5. Arc signature hanging flowers / cave lantern
  if (arcId === "cave_hold") {
    const lx = -wL - 2;
    const ly = -Math.floor(wallH * 0.55);
    fillRectPx(grid, lx, ly - 2, 3, 1, mat.copper[2], 5);
    fillRectPx(grid, lx, ly - 1, 2, 3, mat.windowLit[1], 9);
    setPx(grid, lx, ly, mat.windowLit[2], 9);
  } else if (arcId === "elf_grove") {
    for (let dx = -wL; dx <= wR; dx += 4) {
      const ey = -wallH + Math.floor(Math.abs(dx) / 2) + 2;
      setPx(grid, dx, ey, mat.foliage[3], 6);
      setPx(grid, dx + 1, ey + 1, mat.accent, 6);
    }
  }

  // 6. Chimney on level >= 2
  if (lv >= 2) {
    const chimX = v % 2 === 0 ? Math.floor(wR * 0.45) : -Math.floor(wL * 0.55);
    const chimTopY = -wallH - ridgeH - 2;
    drawHouseChimney(grid, chimX, chimTopY, mat);
  }

  // 7. Upper gable dormer on level >= 3
  if (lv >= 3) {
    fillRectPx(grid, -3, -wallH - 5, 6, 5, mat.wall[4], 5);
    setPx(grid, -1, -wallH - 3, isOdd ? mat.windowLit[2] : mat.windowDark, isOdd ? 9 : 5);
    setPx(grid, 0, -wallH - 3, isOdd ? mat.windowLit[1] : mat.windowDark, isOdd ? 9 : 5);
  }

  return finalizePixelGrid(grid);
}
