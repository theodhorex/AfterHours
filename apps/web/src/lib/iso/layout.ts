/**
 * Deterministic municipal city layout generator.
 * Places 6 sector districts, connecting roads, bridges across rivers,
 * landmark & supporting buildings, distributed houses, central market plaza,
 * and rural landscape features based on simulation state and stage.
 */

import type { TerrainMap, TileKind } from "./terrain.ts";
import type { CityView } from "../sim-view.ts";
import type {
  BuildingLayout,
  HouseLayout,
  RoadTile,
  SupportingBuilding,
  MarketStall,
  RuralFeature,
  SectorZone,
  CityLayout,
} from "./layout-types.ts";

export type {
  BuildingLayout,
  HouseLayout,
  RoadTile,
  SupportingBuilding,
  MarketStall,
  RuralFeature,
  SectorZone,
  CityLayout,
};

/**
 * Parses stage index from stage_id (0: hamlet, 1: village, 2: town, 3: city, 4: grand_city).
 */
export function getStageIndex(stageId: string): number {
  const s = (stageId || "").toLowerCase();
  if (s.includes("hamlet") || s.includes("genesis") || s === "0") return 0;
  if (s.includes("village") || s.includes("settlement") || s === "1") return 1;
  if (s.includes("town") || s === "2") return 2;
  if (s.includes("grand") || s === "4") return 4;
  if (s.includes("city") || s.includes("metropolis") || s === "3") return 3;
  return 1;
}

const DISTRICT_SUPPORT_KINDS: Record<string, string[]> = {
  food: ["field", "barn", "fence", "crop_plot"],
  ore: ["shack", "cart_track", "rock_pile", "shack"],
  forge: ["workshop", "chimney", "workshop", "anvil_station"],
  alchemy: ["domed_hut", "herb_garden", "domed_hut", "alembic_shed"],
  harbor: ["warehouse", "pier", "warehouse", "boat_slip"],
  tower: ["courtyard", "watch_post", "courtyard", "ward_stone"],
};

const RURAL_KINDS: Array<RuralFeature["kind"]> = ["farmland", "orchard", "fence", "well", "pond"];

function findFreeLandTile(
  targetX: number,
  targetY: number,
  terrain: TerrainMap,
  occupied: Set<string>,
  roads: Map<string, RoadTile>,
  maxR = 16
): { x: number; y: number } | null {
  const size = terrain.size;
  for (let r = 0; r <= maxR; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const nx = targetX + dx;
        const ny = targetY + dy;
        if (nx >= 1 && nx < size - 1 && ny >= 1 && ny < size - 1) {
          const key = `${nx},${ny}`;
          if (!occupied.has(key) && !roads.has(key) && terrain.tiles[ny][nx] !== "water") {
            occupied.add(key);
            return { x: nx, y: ny };
          }
        }
      }
    }
  }
  return null;
}

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
    if (currX !== toX) currX += toX > currX ? 1 : -1;
    else if (currY !== toY) currY += toY > currY ? 1 : -1;

    // Do not pave over the destination anchor itself (landmark building sits there)
    if (currX === toX && currY === toY) break;

    const key = `${currX},${currY}`;
    const tileKind: TileKind = terrain.tiles[currY][currX];
    if (!roadMap.has(key)) {
      roadMap.set(key, { x: currX, y: currY, isBridge: tileKind === "water" });
    }
  }
}

/**
 * Computes deterministic layout of districts, roads, landmark/supporting buildings,
 * distributed citizen houses, market plaza, and landscape features.
 */
export function layoutCity(terrain: TerrainMap, view: CityView): CityLayout {
  const size = terrain.size;
  const mid = Math.floor(size / 2);
  const occupiedTiles = new Set<string>();
  const roadMap = new Map<string, RoadTile>();

  // 1. Central Plaza
  let plaza = { x: mid, y: mid };
  for (let r = 0; r < size; r++) {
    let found = false;
    for (let dy = -r; dy <= r && !found; dy++) {
      for (let dx = -r; dx <= r && !found; dx++) {
        const nx = mid + dx;
        const ny = mid + dy;
        if (nx >= 1 && nx < size - 1 && ny >= 1 && ny < size - 1 && terrain.tiles[ny][nx] !== "water") {
          plaza = { x: nx, y: ny };
          found = true;
        }
      }
    }
    if (found) break;
  }
  occupiedTiles.add(`${plaza.x},${plaza.y}`);

  const sectorOffsets = [
    { dx: -10, dy: -8 }, // 0: food (NW)
    { dx: -10, dy: 8 },  // 1: ore (SW)
    { dx: 0, dy: -11 },  // 2: forge (N)
    { dx: 11, dy: -2 },  // 3: alchemy (E)
    { dx: 8, dy: 10 },   // 4: harbor (SE)
    { dx: 7, dy: -9 },   // 5: tower (NE)
  ];

  const sectors: SectorZone[] = [];
  const buildings: BuildingLayout[] = [];
  const stageIndex = getStageIndex(view.stage_id);
  const stageLevel = stageIndex + 1;

  // 2. Locate District Anchors & Roads
  for (let sIdx = 0; sIdx < view.sectors.length; sIdx++) {
    const sec = view.sectors[sIdx];
    const off = sectorOffsets[sIdx % sectorOffsets.length];
    const tx = Math.max(3, Math.min(size - 4, plaza.x + off.dx));
    const ty = Math.max(3, Math.min(size - 4, plaza.y + off.dy));

    let anchor = { x: tx, y: ty };
    for (let r = 0; r < size; r++) {
      let found = false;
      for (let dy = -r; dy <= r && !found; dy++) {
        for (let dx = -r; dx <= r && !found; dx++) {
          const nx = tx + dx;
          const ny = ty + dy;
          if (nx >= 1 && nx < size - 1 && ny >= 1 && ny < size - 1) {
            const k = `${nx},${ny}`;
            if (!occupiedTiles.has(k) && terrain.tiles[ny][nx] !== "water") {
              anchor = { x: nx, y: ny };
              found = true;
            }
          }
        }
      }
      if (found) break;
    }
    occupiedTiles.add(`${anchor.x},${anchor.y}`);
    buildRoad(plaza.x, plaza.y, anchor.x, anchor.y, terrain, roadMap);

    // District Zone tile boundaries
    const zoneTiles: Array<{ x: number; y: number }> = [];
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const zx = anchor.x + dx;
        const zy = anchor.y + dy;
        if (zx >= 0 && zx < size && zy >= 0 && zy < size && terrain.tiles[zy][zx] !== "water") {
          zoneTiles.push({ x: zx, y: zy });
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

    // 3. Businesses: Landmark at district center, other businesses in supporting ring
    const sortedBiz = [...sec.businesses].sort((a, b) => a.id.localeCompare(b.id));
    for (let bIdx = 0; bIdx < sortedBiz.length; bIdx++) {
      const biz = sortedBiz[bIdx];
      const isLandmark = bIdx === 0;
      let pos: { x: number; y: number };
      if (isLandmark) {
        pos = anchor;
      } else {
        const free = findFreeLandTile(anchor.x, anchor.y, terrain, occupiedTiles, roadMap, size);
        pos = free ?? anchor;
      }
      const ruined = !biz.open || (biz.insolvent_steps ?? 0) > 0;
      buildings.push({
        id: biz.id,
        name: biz.name,
        recipe: biz.recipe,
        sectorIdx: sec.idx,
        tileX: pos.x,
        tileY: pos.y,
        level: stageLevel,
        ruined,
        open: biz.open && !ruined,
        isLandmark,
      });
    }
  }

  // 4. Supporting Buildings per District (farm barns, ore shacks, forge chimneys, etc.)
  const supportingBuildings: SupportingBuilding[] = [];
  if (stageIndex >= 1) {
    const countPerDistrict = stageIndex === 1 ? 2 : stageIndex === 2 ? 3 : 4;
    for (const sec of sectors) {
      const kinds = DISTRICT_SUPPORT_KINDS[sec.kind] ?? ["workshop", "shack"];
      for (let i = 0; i < countPerDistrict; i++) {
        const free = findFreeLandTile(sec.centerX, sec.centerY, terrain, occupiedTiles, roadMap, 5);
        if (free) {
          supportingBuildings.push({
            id: `supp_${sec.idx}_${i}`,
            sectorIdx: sec.idx,
            kind: kinds[i % kinds.length],
            tileX: free.x,
            tileY: free.y,
          });
        }
      }
    }
  }

  // 5. Distributed Houses along roads & across districts
  const population = view.citizens?.population ?? 40;
  const targetHouses = Math.max(4, Math.floor(population / 6));
  const houses: HouseLayout[] = [];
  const centralCount = Math.min(targetHouses, Math.max(2, Math.floor(targetHouses * 0.25)));

  // Central ring houses around plaza
  for (let i = 0; i < centralCount; i++) {
    const free = findFreeLandTile(plaza.x, plaza.y, terrain, occupiedTiles, roadMap, size);
    if (free) {
      houses.push({
        id: `house_c_${i}`,
        tileX: free.x,
        tileY: free.y,
        level: Math.min(4, Math.max(1, stageLevel)),
        districtIdx: -1,
      });
    }
  }

  // District houses distributed proportionally to open businesses
  const remainingHouses = targetHouses - houses.length;
  if (remainingHouses > 0 && sectors.length > 0) {
    const weights = sectors.map((s) => {
      const secData = view.sectors.find((v) => v.idx === s.idx);
      const openCount = secData?.businesses.filter((b) => b.open && (b.insolvent_steps ?? 0) === 0).length ?? 0;
      return Math.max(1, openCount);
    });
    const totalW = weights.reduce((a, b) => a + b, 0);

    let allocated = 0;
    for (let sIdx = 0; sIdx < sectors.length; sIdx++) {
      const sec = sectors[sIdx];
      const isLast = sIdx === sectors.length - 1;
      const share = isLast
        ? remainingHouses - allocated
        : Math.max(1, Math.round(remainingHouses * (weights[sIdx] / totalW)));
      const count = Math.min(remainingHouses - allocated, share);
      allocated += count;

      for (let j = 0; j < count; j++) {
        const free = findFreeLandTile(sec.centerX, sec.centerY, terrain, occupiedTiles, roadMap, size);
        if (free) {
          houses.push({
            id: `house_d_${sec.idx}_${j}`,
            tileX: free.x,
            tileY: free.y,
            level: Math.min(4, Math.max(1, stageLevel)),
            districtIdx: sec.idx,
          });
        }
      }
      if (allocated >= remainingHouses) break;
    }
  }

  // 6. Central Market Plaza Stalls (count = in-stock commodities)
  const marketStalls: MarketStall[] = [];
  const inStock = (view.market || []).filter((m) => (m.stock ?? 0) > 0);
  for (const item of inStock) {
    const free = findFreeLandTile(plaza.x, plaza.y, terrain, occupiedTiles, roadMap, 6);
    if (free) {
      marketStalls.push({
        id: `stall_${item.id}`,
        itemId: item.id,
        tileX: free.x,
        tileY: free.y,
      });
    }
  }

  // 7. Rural Landscape Features near districts (farmland, orchards, fences, wells, ponds)
  const ruralFeatures: RuralFeature[] = [];
  const ruralCountPerSec = stageIndex === 0 ? 1 : stageIndex === 1 ? 2 : 3 + stageIndex;
  for (const sec of sectors) {
    for (let i = 0; i < ruralCountPerSec; i++) {
      const free = findFreeLandTile(sec.centerX, sec.centerY, terrain, occupiedTiles, roadMap, 8);
      if (free) {
        ruralFeatures.push({
          id: `rural_${sec.idx}_${i}`,
          kind: RURAL_KINDS[(sec.idx + i) % RURAL_KINDS.length],
          tileX: free.x,
          tileY: free.y,
        });
      }
    }
  }

  return {
    sectors,
    buildings,
    houses,
    roads: Array.from(roadMap.values()),
    plaza,
    supportingBuildings,
    marketStalls,
    ruralFeatures,
  };
}
