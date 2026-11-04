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
 * Depth sort key based on isometric row index (x + y), x coordinate tiebreaker, and layer/elevation.
 * Lower keys draw behind higher keys. Stable for adjacent and same-row buildings.
 */
export function depthSortKey(tileX: number, tileY: number, layer = 0): number {
  return (tileX + tileY) * 10000 + tileX * 10 + layer;
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

/**
 * Deterministic hash of integer tile coordinates returning a variant index [0..variants-1].
 */
export function getTileVariant(x: number, y: number, variants = 3): number {
  let h = (x * 374761393 + y * 668265263) ^ 0x5bf03635;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return Math.abs((h ^ (h >>> 16)) % variants);
}

/**
 * Helper to determine if a pointer movement qualifies as a click vs drag.
 */
export function isClick(dx: number, dy: number, threshold = 4): boolean {
  return dx * dx + dy * dy <= threshold * threshold;
}

export interface FitCameraOptions {
  viewportWidth: number;
  viewportHeight: number;
  padding?: number;
  minZoom?: number;
  maxZoom?: number;
}

/**
 * Calculates camera (x, y, zoom) to center and fit a set of tile points into the viewport.
 */
export function calculateFitCamera(
  points: Array<{ x: number; y: number }>,
  options: FitCameraOptions
): { x: number; y: number; zoom: number } {
  const { viewportWidth, viewportHeight, padding = 40, minZoom = 0.4, maxZoom = 3.0 } = options;

  if (points.length === 0) {
    return { x: viewportWidth / 2, y: viewportHeight / 2, zoom: 1.0 };
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const pt of points) {
    const scr = isoToScreen(pt.x, pt.y);
    if (scr.x < minX) minX = scr.x;
    if (scr.x > maxX) maxX = scr.x;
    if (scr.y < minY) minY = scr.y;
    if (scr.y > maxY) maxY = scr.y;
  }

  const halfW = TILE_WIDTH / 2;
  const halfH = TILE_HEIGHT / 2;
  const boxW = Math.max(1, (maxX - minX) + halfW * 2);
  const boxH = Math.max(1, (maxY - minY) + halfH * 2);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  const availW = Math.max(20, viewportWidth - padding * 2);
  const availH = Math.max(20, viewportHeight - padding * 2);

  const rawZoom = Math.min(availW / boxW, availH / boxH);
  const zoom = Math.max(minZoom, Math.min(maxZoom, Math.round(rawZoom * 100) / 100));

  const x = Math.round(viewportWidth / 2 - centerX * zoom);
  const y = Math.round(viewportHeight / 2 - centerY * zoom);

  return { x, y, zoom };
}
