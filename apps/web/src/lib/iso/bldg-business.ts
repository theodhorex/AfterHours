/**
 * Procedural pixel-art business landmark buildings (up to 112x112 px canvas).
 * Sectors: food, ore, forge, alchemy, harbor, tower.
 * Clearly larger and richer than houses, growing in height and detail across levels 0..3+,
 * with distinct silhouettes, signature details, and ruined state (cracks, broken roof, no lit windows).
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
} from "./bldg-ramp.ts";

export const BUILDING_CANVAS_SIZE = 112;

function drawBldgWindow(
  grid: PixelGrid,
  dx: number,
  dy: number,
  w: number,
  h: number,
  lit: boolean,
  mat: BldgMaterials
): void {
  for (let iy = 0; iy < h; iy++) {
    for (let ix = 0; ix < w; ix++) {
      const isBorder = ix === 0 || ix === w - 1 || iy === 0 || iy === h - 1;
      if (isBorder) {
        setPx(grid, dx + ix, dy + iy, mat.stone[2], 5);
      } else if (lit) {
        const c = iy <= 2 && ix === 1 ? mat.windowLit[2] : mat.windowLit[1];
        setPx(grid, dx + ix, dy + iy, c, 9);
      } else {
        setPx(grid, dx + ix, dy + iy, mat.windowDark, 5);
      }
    }
  }
}

function drawRuinedCracksAndRubble(
  grid: PixelGrid,
  wL: number,
  wR: number,
  wallH: number,
  mat: BldgMaterials
): void {
  // Diagonal wall cracks
  for (let i = 0; i < Math.min(14, wallH - 3); i++) {
    const cxL = -Math.floor(wL * 0.5) + ((i * 3) % 5) - 2;
    const cyL = -wallH + 3 + i;
    setPx(grid, cxL, cyL, 0x1a1512, 5);
    const cxR = Math.floor(wR * 0.45) - ((i * 2) % 4);
    const cyR = -wallH + 4 + i;
    setPx(grid, cxR, cyR, 0x161210, 5);
  }
  // Rubble pile at base
  const rubbleOffsets = [-wL + 2, -6, 4, wR - 3, -12, 10];
  for (let i = 0; i < rubbleOffsets.length; i++) {
    const rx = rubbleOffsets[i];
    const ry = 3 + (i % 3);
    fillRectPx(grid, rx, ry, 3, 2, mat.stone[i % 2 === 0 ? 2 : 1], 5);
  }
  grid.litWindowPixels = 0;
}

function drawFoodBuilding(grid: PixelGrid, lv: number, ruined: boolean, mat: BldgMaterials): void {
  const wL = 22 + lv;
  const wR = 20 + lv;
  const wallH = 18 + lv * 3;
  const ridgeH = 12 + lv;
  const lit = !ruined;

  drawIsoCuboid(grid, wL, wR, wallH, mat.wall, mat.stone, mat.wood, {
    timberFrame: true,
    ruined,
  });
  drawGableRoof(grid, wL, wR, wallH, ridgeH, mat.roof, {
    hasSnow: mat.hasSnow,
    snowRamp: mat.snow,
    ruined,
  });

  // Cylindrical windmill tower & conical roof on right-back
  const millX = 11;
  const millH = wallH + 10 + lv * 2;
  for (let y = -millH; y <= -4; y++) {
    for (let dx = -6; dx <= 6; dx++) {
      const col = dx < 0 ? mat.stone[4] : mat.stone[2];
      setPx(grid, millX + dx, y, Math.abs(dx) === 6 ? selectiveOutline(col) : col, 3);
    }
  }
  drawDomeRoof(grid, 8, 7, -millH - 1, mat.roofAlt, {
    ox: millX,
    hasSnow: mat.hasSnow,
    snowRamp: mat.snow,
  });

  // Windmill 4 diagonal lattice sails (distinct X silhouette)
  const hubX = millX - 2;
  const hubY = -millH + 4;
  const bladeLen = 14 + lv;
  for (let s = -bladeLen; s <= bladeLen; s++) {
    if (ruined && s > 4 && s % 2 === 0) continue;
    setPx(grid, hubX + s, hubY + Math.round(s * 0.5), mat.wood[4], 6);
    setPx(grid, hubX + s, hubY + Math.round(s * 0.5) + 1, mat.bone[3], 6);
    setPx(grid, hubX + Math.round(s * 0.5), hubY - s, mat.wood[4], 6);
    setPx(grid, hubX + Math.round(s * 0.5) + 1, hubY - s, mat.bone[3], 6);
  }
  fillRectPx(grid, hubX - 1, hubY - 1, 3, 3, mat.copper[3], 6);

  // Striped awning & grain sacks at base
  for (let dx = -15; dx <= -4; dx++) {
    const ay = -6 + Math.floor(Math.abs(dx + 10) / 3);
    const stripe = (dx & 1) === 0 ? mat.accent : mat.bone[4];
    fillRectPx(grid, dx, ay, 1, 3, ruined ? mat.wood[2] : stripe, 5);
  }
  for (let s = 0; s < 3 + Math.min(2, lv); s++) {
    const sx = -14 + s * 4;
    const sy = 2 + (s % 2);
    fillRectPx(grid, sx, sy, 3, 4, mat.bone[3], 6);
    setPx(grid, sx + 1, sy, mat.wood[2], 6);
  }

  drawBldgWindow(grid, -12, -wallH + 5, 4, 5, lit, mat);
  drawBldgWindow(grid, 4, -wallH + 6, 4, 5, lit, mat);
}

function drawOreBuilding(grid: PixelGrid, lv: number, ruined: boolean, mat: BldgMaterials): void {
  const wL = 24 + lv;
  const wR = 22 + lv;
  const wallH = 19 + lv * 3;
  const lit = !ruined;

  // Craggy terraced rock hillside mass
  drawIsoCuboid(grid, wL, wR, wallH, mat.stone, mat.stone, mat.wood, {
    foundationH: 5,
    timberFrame: true,
    ruined,
  });
  drawDomeRoof(grid, wL - 1, 10 + lv, -wallH, mat.stone, {
    hasSnow: mat.hasSnow,
    snowRamp: mat.snow,
  });

  // Dark mine tunnel portal with heavy timber frame on left face
  for (let dy = -11; dy <= 2; dy++) {
    for (let dx = -15; dx <= -4; dx++) {
      const isFrame = dx <= -14 || dx >= -5 || dy <= -10;
      const col = isFrame ? mat.wood[3] : 0x100e12;
      setPx(grid, dx, dy + Math.floor(Math.abs(dx) / 3), col, 5);
    }
  }

  // Timber A-frame headframe & hoist wheel above portal
  const frameTop = -wallH - 14 - lv * 2;
  for (let y = frameTop; y <= -wallH + 2; y++) {
    fillRectPx(grid, -14, y, 2, 1, mat.wood[3], 6);
    fillRectPx(grid, -5, y, 2, 1, mat.wood[2], 6);
  }
  fillRectPx(grid, -15, frameTop, 13, 2, mat.wood[4], 6);
  fillRectPx(grid, -10, frameTop - 3, 4, 4, mat.copper[2], 6);

  // Iron mine rails & ore cart in front
  for (let r = 0; r < 14; r++) {
    const rx = -8 + r;
    const ry = 3 + Math.floor(r / 2);
    setPx(grid, rx, ry, mat.stone[1], 6);
    setPx(grid, rx + 4, ry - 1, mat.stone[1], 6);
  }
  fillRectPx(grid, 2, 2, 9, 6, mat.wood[2], 6);
  fillRectPx(grid, 3, 0, 7, 3, lit ? mat.accent : mat.stone[2], lit ? 9 : 6);
  setPx(grid, 3, 8, 0x1c1816, 6);
  setPx(grid, 9, 8, 0x1c1816, 6);

  if (lit) {
    drawBldgWindow(grid, 7, -wallH + 6, 4, 5, true, mat);
  }
}

function drawForgeBuilding(grid: PixelGrid, lv: number, ruined: boolean, mat: BldgMaterials): void {
  const wL = 23 + lv;
  const wR = 21 + lv;
  const wallH = 19 + lv * 3;
  const ridgeH = 11 + lv;
  const lit = !ruined;

  drawIsoCuboid(grid, wL, wR, wallH, mat.wall, mat.stone, mat.wood, {
    foundationH: 5,
    timberFrame: false,
    ruined,
  });
  drawGableRoof(grid, wL, wR, wallH, ridgeH, mat.roofAlt, {
    hasSnow: mat.hasSnow,
    snowRamp: mat.snow,
    ruined,
  });

  // Tall tapering brick/stone chimney stack (double stack on lv >= 2)
  const stackTop = -wallH - ridgeH - 15 - lv * 2;
  for (let y = stackTop; y <= -wallH + 2; y++) {
    for (let dx = 8; dx <= 15; dx++) {
      const col = dx < 12 ? mat.stone[3] : mat.stone[1];
      setPx(grid, dx, y, dx === 8 || dx === 15 ? selectiveOutline(col) : col, 5);
    }
  }
  fillRectPx(grid, 7, stackTop, 10, 2, mat.stone[4], 5);
  if (lv >= 2) {
    fillRectPx(grid, 1, stackTop + 5, 5, -wallH - stackTop - 3, mat.stone[2], 5);
    fillRectPx(grid, 0, stackTop + 4, 7, 2, mat.stone[4], 5);
  }
  grid.hasChimney = true;

  // Blazing furnace mouth on front-left wall
  for (let dy = -9; dy <= 1; dy++) {
    for (let dx = -16; dx <= -6; dx++) {
      const isArch = dx === -16 || dx === -6 || dy === -9;
      if (isArch) {
        setPx(grid, dx, dy + 3, mat.stone[1], 5);
      } else if (lit) {
        const core = dy >= -4 && dx >= -13 && dx <= -9;
        setPx(grid, dx, dy + 3, core ? mat.windowLit[2] : mat.windowLit[0], 9);
      } else {
        setPx(grid, dx, dy + 3, 0x1a1614, 5);
      }
    }
  }

  // Outdoor anvil on timber block
  fillRectPx(grid, -19, 4, 5, 3, mat.wood[2], 6);
  fillRectPx(grid, -20, 2, 7, 2, mat.stone[4], 6);
  drawBldgWindow(grid, 6, -wallH + 6, 4, 5, lit, mat);
}

function drawAlchemyBuilding(grid: PixelGrid, lv: number, ruined: boolean, mat: BldgMaterials): void {
  const wL = 19 + lv;
  const wR = 19 + lv;
  const wallH = 22 + lv * 3;
  const lit = !ruined;

  drawIsoCuboid(grid, wL, wR, wallH, mat.wall, mat.stone, mat.wood, {
    timberFrame: true,
    ruined,
  });
  drawDomeRoof(grid, wL + 1, 13 + lv, -wallH - 1, mat.roof, {
    hasSnow: mat.hasSnow,
    snowRamp: mat.snow,
  });

  // Copper vats on right side platform
  for (const vx of [11, 18]) {
    for (let dy = -9; dy <= 2; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        const c = dy === -4 || dy === 0 ? mat.copper[1] : dx < 0 ? mat.copper[4] : mat.copper[2];
        setPx(grid, vx + dx, dy + 2, c, 6);
      }
    }
  }

  // Curved copper roof pipe & bright green bubbling vapour
  const pipeTop = -wallH - 17 - lv * 2;
  for (let y = pipeTop; y <= -wallH - 4; y++) {
    fillRectPx(grid, -8, y, 3, 1, mat.copper[3], 6);
  }
  fillRectPx(grid, -11, pipeTop, 6, 2, mat.copper[4], 6);
  if (lit) {
    fillRectPx(grid, -11, pipeTop - 3, 3, 3, 0x22c55e, 9);
    fillRectPx(grid, -8, pipeTop - 6, 3, 3, 0x86efac, 9);
    setPx(grid, -10, pipeTop - 2, 0xbbf7d0, 9);
  }

  drawBldgWindow(grid, -10, -wallH + 6, 4, 5, lit, mat);
  drawBldgWindow(grid, 3, -wallH + 6, 4, 5, lit, mat);
}

function drawHarborBuilding(grid: PixelGrid, lv: number, ruined: boolean, mat: BldgMaterials): void {
  const wL = 21 + lv;
  const wR = 20 + lv;
  const wallH = 18 + lv * 3;
  const ridgeH = 12 + lv;
  const lit = !ruined;

  // Timber dock planks on pilings jutting out in front
  for (let dy = 1; dy <= 11; dy++) {
    for (let dx = -26; dx <= 18; dx++) {
      if (Math.abs(dx) + dy * 2 > 38) continue;
      const isSeam = dy % 3 === 0 || dx % 6 === 0;
      setPx(grid, dx, dy, isSeam ? mat.wood[1] : mat.wood[3], 6);
    }
  }
  for (const px of [-22, -10, 2, 14]) {
    fillRectPx(grid, px, 8, 2, 5, mat.wood[0], 6);
  }

  drawIsoCuboid(grid, wL, wR, wallH, mat.wall, mat.stone, mat.wood, {
    timberFrame: true,
    ruined,
  });
  drawGableRoof(grid, wL, wR, wallH, ridgeH, mat.roof, {
    hasSnow: mat.hasSnow,
    snowRamp: mat.snow,
    ruined,
  });

  // Cargo crane derrick & crates on dock
  for (let i = 0; i < 16 + lv * 2; i++) {
    setPx(grid, -wL - 2, -i, mat.wood[3], 6);
    if (i > 8) setPx(grid, -wL - 2 - (i - 8), -i, mat.wood[4], 6);
  }
  fillRectPx(grid, -16, 3, 5, 4, mat.wood[4], 6);
  fillRectPx(grid, -10, 4, 5, 4, mat.wood[2], 6);
  fillRectPx(grid, 6, 3, 5, 4, mat.copper[2], 6);

  drawBldgWindow(grid, -10, -wallH + 5, 4, 5, lit, mat);
  drawBldgWindow(grid, 5, -wallH + 5, 4, 5, lit, mat);
}

function drawTowerBuilding(grid: PixelGrid, lv: number, ruined: boolean, mat: BldgMaterials): void {
  const wL = 16 + Math.floor(lv / 2);
  const wR = 16 + Math.floor(lv / 2);
  const wallH = 30 + lv * 5;
  const spireH = 19 + lv * 3;
  const lit = !ruined;

  drawIsoCuboid(grid, wL, wR, wallH, mat.stone, mat.stone, mat.wood, {
    foundationH: 6,
    ruined,
  });

  // Crenellated battlements
  for (let dx = -wL - 1; dx <= wR + 1; dx += 3) {
    const by = -wallH + Math.floor((wL - Math.abs(dx)) / 2);
    fillRectPx(grid, dx, by - 3, 2, 3, mat.stone[4], 5);
  }

  // Tall conical/gabled stone spire roof
  drawGableRoof(grid, wL, wR, wallH, spireH, mat.roof, {
    hasSnow: mat.hasSnow,
    snowRamp: mat.snow,
    ruined,
  });

  // Beacon finial at apex & tiered lit windows
  const apexY = -wallH - spireH;
  fillRectPx(grid, -1, apexY - 5, 3, 5, mat.copper[3], 6);
  if (lit) {
    fillRectPx(grid, -2, apexY - 8, 5, 4, mat.windowLit[2], 9);
  }
  for (let tier = 0; tier < 2 + Math.min(2, lv); tier++) {
    const wy = -10 - tier * 9;
    drawBldgWindow(grid, -8, wy, 4, 5, lit, mat);
    drawBldgWindow(grid, 5, wy, 4, 5, lit, mat);
  }
}

/**
 * Bakes a business building into a 112x112 PixelGrid with anchor at (56, 95) = (0.5, 0.85).
 */
export function bakeBuildingPixels(
  sectorKind: string,
  level: number,
  ruined: boolean,
  arcId: string,
  season = 0
): PixelGrid {
  const grid = createPixelGrid(BUILDING_CANVAS_SIZE, BUILDING_CANVAS_SIZE);
  const lv = Math.max(0, Math.min(4, Math.floor(level)));
  const mat = getArcMaterials(arcId, season, ruined);

  drawCastShadow(grid, 29, 14, 0.25);

  if (sectorKind === "food") {
    drawFoodBuilding(grid, lv, ruined, mat);
  } else if (sectorKind === "ore") {
    drawOreBuilding(grid, lv, ruined, mat);
  } else if (sectorKind === "forge") {
    drawForgeBuilding(grid, lv, ruined, mat);
  } else if (sectorKind === "alchemy") {
    drawAlchemyBuilding(grid, lv, ruined, mat);
  } else if (sectorKind === "harbor") {
    drawHarborBuilding(grid, lv, ruined, mat);
  } else {
    drawTowerBuilding(grid, lv, ruined, mat);
  }

  if (ruined) {
    drawRuinedCracksAndRubble(grid, 20, 20, 20 + lv * 3, mat);
  }

  return finalizePixelGrid(grid);
}
