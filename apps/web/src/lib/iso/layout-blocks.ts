/**
 * Block & building lot allocator.
 * Packs building lots tightly along roads and sidewalks into cohesive blocks,
 * computing deterministic road-facing orientations.
 */

import type { TerrainMap } from "./terrain.ts";
import type { RoadTile, SidewalkTile, BlockLayout } from "./layout-types.ts";

export interface LotPlacement {
  x: number;
  y: number;
  facing: "N" | "E" | "S" | "W";
}

/**
 * Determines facing direction ("N" | "E" | "S" | "W") from a lot tile toward an adjacent road or sidewalk.
 */
export function getFacingToRoad(
  x: number,
  y: number,
  roadMap: Map<string, RoadTile>,
  sidewalkSet?: Set<string>
): "N" | "E" | "S" | "W" {
  const directions: Array<{ dir: "N" | "E" | "S" | "W"; dx: number; dy: number }> = [
    { dir: "N", dx: 0, dy: -1 },
    { dir: "E", dx: 1, dy: 0 },
    { dir: "S", dx: 0, dy: 1 },
    { dir: "W", dx: -1, dy: 0 },
  ];

  // 1. Prefer facing an actual road tile first
  for (const { dir, dx, dy } of directions) {
    const k = `${x + dx},${y + dy}`;
    if (roadMap.has(k)) {
      return dir;
    }
  }

  // 2. Fall back to facing a sidewalk tile
  if (sidewalkSet) {
    for (const { dir, dx, dy } of directions) {
      const k = `${x + dx},${y + dy}`;
      if (sidewalkSet.has(k)) {
        return dir;
      }
    }
  }

  return "S";
}

/**
 * Finds the closest unoccupied land tile adjacent to a road or sidewalk.
 */
export function findRoadAdjacentLot(
  targetX: number,
  targetY: number,
  terrain: TerrainMap,
  occupied: Set<string>,
  roadMap: Map<string, RoadTile>,
  sidewalks?: SidewalkTile[],
  maxR = 24
): LotPlacement | null {
  const size = terrain.size;
  const sidewalkSet = new Set<string>((sidewalks ?? []).map((s) => `${s.x},${s.y}`));

  for (let r = 0; r <= maxR; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const nx = targetX + dx;
        const ny = targetY + dy;

        if (nx >= 1 && nx < size - 1 && ny >= 1 && ny < size - 1) {
          const key = `${nx},${ny}`;
          if (occupied.has(key) || roadMap.has(key) || sidewalkSet.has(key)) continue;

          const tileKind = terrain.tiles[ny][nx];
          if (tileKind === "water" || tileKind === "rock") continue;

          // Check if touches road or sidewalk
          const neighbors = [
            `${nx},${ny - 1}`,
            `${nx + 1},${ny}`,
            `${nx},${ny + 1}`,
            `${nx - 1},${ny}`,
          ];

          const touchesRoad = neighbors.some((k) => roadMap.has(k) || sidewalkSet.has(k));
          if (touchesRoad) {
            occupied.add(key);
            const facing = getFacingToRoad(nx, ny, roadMap, sidewalkSet);
            return { x: nx, y: ny, facing };
          }
        }
      }
    }
  }

  return null;
}

/**
 * Computes bounding block areas for districts based on placed lots and roads.
 */
export function identifyBlocks(
  lots: Array<{ x: number; y: number; sectorIdx?: number }>,
  size: number
): BlockLayout[] {
  const blocks: BlockLayout[] = [];
  const sectorGroups = new Map<number, Array<{ x: number; y: number }>>();

  for (const lot of lots) {
    const sIdx = lot.sectorIdx ?? -1;
    if (!sectorGroups.has(sIdx)) {
      sectorGroups.set(sIdx, []);
    }
    sectorGroups.get(sIdx)!.push({ x: lot.x, y: lot.y });
  }

  for (const [sectorIdx, group] of sectorGroups.entries()) {
    if (group.length === 0) continue;
    let minX = size;
    let minY = size;
    let maxX = 0;
    let maxY = 0;
    for (const pt of group) {
      if (pt.x < minX) minX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y > maxY) maxY = pt.y;
    }
    blocks.push({
      id: `block_sec_${sectorIdx}`,
      minX: Math.max(0, minX - 1),
      minY: Math.max(0, minY - 1),
      maxX: Math.min(size - 1, maxX + 1),
      maxY: Math.min(size - 1, maxY + 1),
      sectorIdx,
    });
  }

  return blocks;
}
