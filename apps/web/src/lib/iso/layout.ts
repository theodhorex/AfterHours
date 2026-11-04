/**
 * Deterministic municipal city layout generator.
 * Places 6 sector zones, connecting roads, bridges across rivers,
 * business buildings, and citizen houses based on simulation state.
 */

import type { TerrainMap, TileKind } from "./terrain.ts";
import type { CityView } from "../sim-view.ts";

export interface BuildingLayout {
  id: string;
  name: string;
  recipe: string;
  sectorIdx: number;
  tileX: number;
  tileY: number;
  level: number;
  ruined: boolean;
  open: boolean;
}

export interface HouseLayout {
  id: string;
  tileX: number;
  tileY: number;
  level: number;
}

export interface RoadTile {
  x: number;
  y: number;
  isBridge: boolean;
}

export interface SectorZone {
  idx: number;
  kind: string;
  name: string;
  centerX: number;
  centerY: number;
  tiles: Array<{ x: number; y: number }>;
}

export interface CityLayout {
  sectors: SectorZone[];
  buildings: BuildingLayout[];
  houses: HouseLayout[];
  roads: RoadTile[];
  plaza: { x: number; y: number };
}

/**
 * Parses stage index from stage_id (e.g., "genesis"->0, "settlement"->1, "town"->2, "city"->3).
 */
function getStageLevel(stageId: string): number {
  const normalized = stageId.toLowerCase();
  if (normalized.includes("genesis") || normalized.includes("0")) return 1;
  if (normalized.includes("settlement") || normalized.includes("1")) return 2;
  if (normalized.includes("town") || normalized.includes("2")) return 3;
  if (normalized.includes("city") || normalized.includes("3") || normalized.includes("metropolis")) return 4;
  return 2;
}

/**
 * Finds the nearest land tile to a given coordinate.
 */
function findNearestLand(
  targetX: number,
  targetY: number,
  terrain: TerrainMap,
  occupied: Set<string>
): { x: number; y: number } | null {
  const size = terrain.size;
  const maxRadius = Math.max(targetX, size - targetX, targetY, size - targetY);

  for (let r = 0; r <= maxRadius; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const nx = targetX + dx;
        const ny = targetY + dy;
        if (nx >= 1 && nx < size - 1 && ny >= 1 && ny < size - 1) {
          const kind: TileKind = terrain.tiles[ny][nx];
          if (kind !== "water" && !occupied.has(`${nx},${ny}`)) {
            return { x: nx, y: ny };
          }
        }
      }
    }
  }
  return null;
}

/**
 * Traces a road path between two points.
 * Where the road intersects water, it becomes a bridge.
 */
function buildRoad(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  terrain: TerrainMap,
  roadMap: Map<string, RoadTile>
) {
  let currX = fromX;
  let currY = fromY;

  while (currX !== toX || currY !== toY) {
    if (currX !== toX) {
      currX += toX > currX ? 1 : -1;
    } else if (currY !== toY) {
      currY += toY > currY ? 1 : -1;
    }

    const key = `${currX},${currY}`;
    const tileKind = terrain.tiles[currY][currX];
    const isBridge = tileKind === "water";

    if (!roadMap.has(key)) {
      roadMap.set(key, { x: currX, y: currY, isBridge });
    }
  }
}

/**
 * Computes deterministic layout of sectors, roads, businesses, and houses.
 */
export function layoutCity(terrain: TerrainMap, view: CityView): CityLayout {
  const size = terrain.size;
  const mid = Math.floor(size / 2);

  // 1. Locate Central Plaza on land
  const occupiedTiles = new Set<string>();
  const plazaCandidate = findNearestLand(mid, mid, terrain, occupiedTiles);
  const plaza = plazaCandidate ?? { x: mid, y: mid };
  occupiedTiles.add(`${plaza.x},${plaza.y}`);

  // Sector relative positions around plaza
  const sectorOffsets = [
    { dx: -10, dy: -8 }, // 0: food (NW)
    { dx: -10, dy: 8 },  // 1: ore (SW)
    { dx: 0, dy: -11 },  // 2: forge (N)
    { dx: 11, dy: -2 },  // 3: alchemy (E)
    { dx: 8, dy: 10 },   // 4: harbor (SE)
    { dx: 7, dy: -9 },   // 5: tower (NE)
  ];

  const sectors: SectorZone[] = [];
  const roadMap = new Map<string, RoadTile>();
  const buildingList: BuildingLayout[] = [];
  const stageLevel = getStageLevel(view.stage_id);

  // 2. Place Sector Anchors & Connect Roads to Plaza
  for (let sIdx = 0; sIdx < view.sectors.length; sIdx++) {
    const sec = view.sectors[sIdx];
    const off = sectorOffsets[sIdx % sectorOffsets.length];
    const targetX = Math.max(3, Math.min(size - 4, plaza.x + off.dx));
    const targetY = Math.max(3, Math.min(size - 4, plaza.y + off.dy));

    const anchor = findNearestLand(targetX, targetY, terrain, occupiedTiles) ?? {
      x: targetX,
      y: targetY,
    };

    occupiedTiles.add(`${anchor.x},${anchor.y}`);

    // Connect anchor to plaza with road/bridge
    buildRoad(plaza.x, plaza.y, anchor.x, anchor.y, terrain, roadMap);

    // Build zone tiles around anchor
    const zoneTiles: Array<{ x: number; y: number }> = [];
    const zoneRadius = 4;
    for (let dy = -zoneRadius; dy <= zoneRadius; dy++) {
      for (let dx = -zoneRadius; dx <= zoneRadius; dx++) {
        const zx = anchor.x + dx;
        const zy = anchor.y + dy;
        if (zx >= 0 && zx < size && zy >= 0 && zy < size) {
          if (terrain.tiles[zy][zx] !== "water") {
            zoneTiles.push({ x: zx, y: zy });
          }
        }
      }
    }

    sectors.push({
      idx: sec.idx,
      kind: sec.kind,
      name: sec.name,
      centerX: anchor.x,
      centerY: anchor.y,
      tiles: zoneTiles,
    });

    // 3. Place Businesses deterministically inside/adjacent to sector zone
    // Sort businesses strictly by id for stability
    const sortedBiz = [...sec.businesses].sort((a, b) => a.id.localeCompare(b.id));

    for (const biz of sortedBiz) {
      // Find closest unassigned land tile to anchor
      let chosenTile: { x: number; y: number } | null = null;
      for (let r = 1; r < size; r++) {
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
            const bx = anchor.x + dx;
            const by = anchor.y + dy;
            if (bx >= 1 && bx < size - 1 && by >= 1 && by < size - 1) {
              const key = `${bx},${by}`;
              if (
                terrain.tiles[by][bx] !== "water" &&
                !occupiedTiles.has(key) &&
                !roadMap.has(key)
              ) {
                chosenTile = { x: bx, y: by };
                break;
              }
            }
          }
          if (chosenTile) break;
        }
        if (chosenTile) break;
      }

      if (!chosenTile) {
        // Fallback: any land tile
        chosenTile = findNearestLand(anchor.x, anchor.y, terrain, occupiedTiles)!;
      }

      occupiedTiles.add(`${chosenTile.x},${chosenTile.y}`);

      const ruined = !biz.open || (biz.insolvent_steps ?? 0) > 0;

      buildingList.push({
        id: biz.id,
        name: biz.name,
        recipe: biz.recipe,
        sectorIdx: sec.idx,
        tileX: chosenTile.x,
        tileY: chosenTile.y,
        level: stageLevel,
        ruined,
        open: biz.open && !ruined,
      });
    }
  }

  // 4. Place Houses: count = f(population), approx population / 6, min 4, capped by land
  const population = view.citizens?.population ?? 40;
  const rawHouseCount = Math.floor(population / 6);
  const targetHouses = Math.max(4, rawHouseCount);

  const houses: HouseLayout[] = [];
  let houseIndex = 0;

  // Search in expanding rings from plaza along roadsides
  for (let r = 1; r < size && houses.length < targetHouses; r++) {
    for (let dy = -r; dy <= r && houses.length < targetHouses; dy++) {
      for (let dx = -r; dx <= r && houses.length < targetHouses; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const hx = plaza.x + dx;
        const hy = plaza.y + dy;
        if (hx >= 1 && hx < size - 1 && hy >= 1 && hy < size - 1) {
          const key = `${hx},${hy}`;
          if (
            terrain.tiles[hy][hx] !== "water" &&
            !occupiedTiles.has(key) &&
            !roadMap.has(key)
          ) {
            occupiedTiles.add(key);
            houses.push({
              id: `house_${houseIndex}`,
              tileX: hx,
              tileY: hy,
              level: Math.min(4, Math.max(1, stageLevel)),
            });
            houseIndex++;
          }
        }
      }
    }
  }

  const roads = Array.from(roadMap.values());

  return {
    sectors,
    buildings: buildingList,
    houses,
    roads,
    plaza,
  };
}
