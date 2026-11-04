/**
 * Pure 2:1 isometric projection mathematics, depth sorting, and hit testing.
 * Standard tile dimensions: 64px width, 32px height.
 */

export const TILE_WIDTH = 64;
export const TILE_HEIGHT = 32;

export interface ScreenCoord {
  x: number;
  y: number;
}

export interface IsoCoord {
  x: number;
  y: number;
}

/**
 * Projects grid (tileX, tileY) to isometric screen coordinates.
 */
export function isoToScreen(
  tileX: number,
  tileY: number,
  tileWidth = TILE_WIDTH,
  tileHeight = TILE_HEIGHT
): ScreenCoord {
  const halfW = tileWidth / 2;
  const halfH = tileHeight / 2;
  return {
    x: (tileX - tileY) * halfW,
    y: (tileX + tileY) * halfH,
  };
}

/**
 * Inverts isometric screen coordinates back to continuous grid coordinates.
 */
export function screenToIso(
  screenX: number,
  screenY: number,
  tileWidth = TILE_WIDTH,
  tileHeight = TILE_HEIGHT
): IsoCoord {
  const halfW = tileWidth / 2;
  const halfH = tileHeight / 2;
  return {
    x: (screenX / halfW + screenY / halfH) / 2,
    y: (screenY / halfH - screenX / halfW) / 2,
  };
}

/**
 * Quantizes screen coordinates to integer tile coordinate.
 */
export function screenToTile(
  screenX: number,
  screenY: number,
  tileWidth = TILE_WIDTH,
  tileHeight = TILE_HEIGHT
): { x: number; y: number } {
  const iso = screenToIso(screenX, screenY, tileWidth, tileHeight);
  return {
    x: Math.floor(iso.x),
    y: Math.floor(iso.y),
  };
}

/**
 * Depth sort key based on isometric row index (x + y) and layer/elevation.
 * Lower keys draw behind higher keys.
 */
export function depthSortKey(tileX: number, tileY: number, layer = 0): number {
  return (tileX + tileY) * 100 + layer;
}

/**
 * Calculates world bounding box in screen pixels for an N x M grid.
 */
export function getMapScreenBounds(
  gridWidth: number,
  gridHeight: number,
  tileWidth = TILE_WIDTH,
  tileHeight = TILE_HEIGHT
): { minX: number; maxX: number; minY: number; maxY: number; width: number; height: number } {
  const pTop = isoToScreen(0, 0, tileWidth, tileHeight);
  const pRight = isoToScreen(gridWidth, 0, tileWidth, tileHeight);
  const pBottom = isoToScreen(gridWidth, gridHeight, tileWidth, tileHeight);
  const pLeft = isoToScreen(0, gridHeight, tileWidth, tileHeight);

  const minX = Math.min(pTop.x, pRight.x, pBottom.x, pLeft.x) - tileWidth / 2;
  const maxX = Math.max(pTop.x, pRight.x, pBottom.x, pLeft.x) + tileWidth / 2;
  const minY = Math.min(pTop.y, pRight.y, pBottom.y, pLeft.y);
  const maxY = Math.max(pTop.y, pRight.y, pBottom.y, pLeft.y) + tileHeight;

  return {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}
