/**
 * Deterministic municipal city layout generator.
 * Places 6 sector districts, connecting roads, bridges across rivers,
 * landmark & supporting buildings, distributed houses, central market plaza,
 * and rural landscape features based on simulation state and stage.
 */

import type { TerrainMap } from "./terrain.ts";
import type { CityView } from "../sim-view.ts";
import type {
  BuildingLayout,
  HouseLayout,
  RoadTile,
  SidewalkTile,
  SupportingBuilding,
  MarketStall,
  RuralFeature,
  SectorZone,
  CityLayout,
  BlockLayout,
  PropLayout,
} from "./layout-types.ts";
import { generateRoadNetwork } from "./layout-roads.ts";
import { findRoadAdjacentLot, getFacingToRoad, identifyBlocks } from "./layout-blocks.ts";

export type {
  BuildingLayout,
  HouseLayout,
  RoadTile,
  SidewalkTile,
  SupportingBuilding,
  MarketStall,
  RuralFeature,
  SectorZone,
  CityLayout,
  BlockLayout,
};

/**
 * Parses stage index from stage_id (0: hamlet, 1: village, 2: town, 3: city, 4: grand_city).
 */
export function getStageIndex(stageId: string): number {
  const s = (stageId || "").toLowerCase();
  if (s.includes("hamlet") || s.includes("genesis") || s.includes("camp") || s === "0") return 0;
  if (s.includes("village") || s.includes("settlement") || s.includes("clan_hold") || s.includes("enclosure") || s.includes("haven") || s === "1") return 1;
  if (s.includes("town") || s.includes("stronghold") || s === "2") return 2;
  if (s.includes("city") || s.includes("metropolis") || s.includes("citadel") || s.includes("sanctuary") || s === "3") return 3;
  if (s.includes("grand") || s.includes("high_hold") || s.includes("apex_vale") || s.includes("high_grove") || s === "4") return 4;
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
          const tile = terrain.tiles[ny][nx];
          if (!occupied.has(key) && !roads.has(key) && tile !== "water" && tile !== "rock") {
            occupied.add(key);
            return { x: nx, y: ny };
          }
        }
      }
    }
  }
  return null;
}

/**
 * Computes deterministic layout of districts, roads, landmark/supporting buildings,
 * distributed citizen houses, market plaza, and landscape features.
 */
export function layoutCity(terrain: TerrainMap, view: CityView): CityLayout {
  const size = terrain.size;
  const mid = Math.floor(size / 2);
  const occupiedTiles = new Set<string>();

  // 1. Central Plaza (must not be water or rock)
  let plaza = { x: mid, y: mid };
  for (let r = 0; r < size; r++) {
    let found = false;
    for (let dy = -r; dy <= r && !found; dy++) {
      for (let dx = -r; dx <= r && !found; dx++) {
        const nx = mid + dx;
        const ny = mid + dy;
        if (nx >= 1 && nx < size - 1 && ny >= 1 && ny < size - 1) {
          const t = terrain.tiles[ny][nx];
          if (t !== "water" && t !== "rock") {
            plaza = { x: nx, y: ny };
            found = true;
          }
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

  const stageIndex = getStageIndex(view.stage_id);
  const stageLevel = stageIndex + 1;
  const arcId = terrain.arcId || view.arc_id || "goblin_warrens";

  // 2. Locate District Anchors
  const districtAnchors: Array<{ x: number; y: number; sectorIdx: number }> = [];
  const sectors: SectorZone[] = [];

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
            const t = terrain.tiles[ny][nx];
            if (!occupiedTiles.has(k) && t !== "water" && t !== "rock") {
              anchor = { x: nx, y: ny };
              found = true;
            }
          }
        }
      }
      if (found) break;
    }
    occupiedTiles.add(`${anchor.x},${anchor.y}`);
    districtAnchors.push({ x: anchor.x, y: anchor.y, sectorIdx: sec.idx });

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
  }

  // 3. Generate Road Network & Sidewalks
  const roadNet = generateRoadNetwork(terrain, plaza, districtAnchors, arcId, stageIndex);
  const roadMap = roadNet.roadMap;
  const sidewalkSet = new Set<string>((roadNet.sidewalks ?? []).map((s) => `${s.x},${s.y}`));

  // Reserve sidewalk tiles in occupiedTiles so buildings aren't placed on sidewalks
  for (const sw of roadNet.sidewalks) {
    occupiedTiles.add(`${sw.x},${sw.y}`);
  }

  // 4. Businesses: Landmark at district center, other businesses in supporting ring along roads
  const buildings: BuildingLayout[] = [];
  for (let sIdx = 0; sIdx < view.sectors.length; sIdx++) {
    const sec = view.sectors[sIdx];
    const anchor = districtAnchors[sIdx];
    const sortedBiz = [...sec.businesses].sort((a, b) => a.id.localeCompare(b.id));

    for (let bIdx = 0; bIdx < sortedBiz.length; bIdx++) {
      const biz = sortedBiz[bIdx];
      const isLandmark = bIdx === 0;
      let pos: { x: number; y: number };
      let facing: "N" | "E" | "S" | "W";

      if (isLandmark) {
        pos = { x: anchor.x, y: anchor.y };
        facing = getFacingToRoad(anchor.x, anchor.y, roadMap, sidewalkSet);
      } else {
        const lot = findRoadAdjacentLot(anchor.x, anchor.y, terrain, occupiedTiles, roadMap, roadNet.sidewalks, size);
        if (lot) {
          pos = { x: lot.x, y: lot.y };
          facing = lot.facing;
        } else {
          const free = findFreeLandTile(anchor.x, anchor.y, terrain, occupiedTiles, roadMap, size);
          pos = free ?? { x: anchor.x, y: anchor.y };
          facing = getFacingToRoad(pos.x, pos.y, roadMap, sidewalkSet);
        }
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
        facing,
      });
    }
  }

  // 5. Supporting Buildings per District (farm barns, ore shacks, forge chimneys, etc.)
  const supportingBuildings: SupportingBuilding[] = [];
  {
    const countPerDistrict = stageIndex <= 1 ? 2 : stageIndex === 2 ? 3 : 4;
    for (const sec of sectors) {
      const kinds = DISTRICT_SUPPORT_KINDS[sec.kind] ?? ["workshop", "shack"];
      for (let i = 0; i < countPerDistrict; i++) {
        const lot = findRoadAdjacentLot(sec.centerX, sec.centerY, terrain, occupiedTiles, roadMap, roadNet.sidewalks, size);
        if (lot) {
          supportingBuildings.push({
            id: `supp_${sec.idx}_${i}`,
            sectorIdx: sec.idx,
            kind: kinds[i % kinds.length],
            tileX: lot.x,
            tileY: lot.y,
            facing: lot.facing,
          });
        }
      }
    }
  }

  // 7. Central Market Plaza Stalls (count = in-stock commodities)
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

  // 6. Distributed Houses along roads & across districts
  const population = view.citizens?.population ?? 40;
  const targetHouses = Math.max(16, Math.floor(population / 3));
  const houses: HouseLayout[] = [];
  const centralCount = Math.min(targetHouses, Math.max(2, Math.floor(targetHouses * 0.25)));

  // Central ring houses around plaza
  for (let i = 0; i < centralCount; i++) {
    const lot = findRoadAdjacentLot(plaza.x, plaza.y, terrain, occupiedTiles, roadMap, roadNet.sidewalks, size);
    if (lot) {
      houses.push({
        id: `house_c_${i}`,
        tileX: lot.x,
        tileY: lot.y,
        level: Math.min(4, Math.max(1, stageLevel)),
        districtIdx: -1,
        facing: lot.facing,
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
        const lot = findRoadAdjacentLot(sec.centerX, sec.centerY, terrain, occupiedTiles, roadMap, roadNet.sidewalks, size);
        if (lot) {
          houses.push({
            id: `house_d_${sec.idx}_${j}`,
            tileX: lot.x,
            tileY: lot.y,
            level: Math.min(4, Math.max(1, stageLevel)),
            districtIdx: sec.idx,
            facing: lot.facing,
          });
        }
      }
      if (allocated >= remainingHouses) break;
    }
  }

  // 8. Rural Landscape Features near districts (farmland, orchards, fences, wells, ponds)
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

  // 9. Roadside trees in leftover gaps next to roads (deterministic, capped)
  const props: PropLayout[] = [];
  const treeCap = 90 + stageIndex * 20;
  for (const r of roadNet.roads) {
    if (props.length >= treeCap) break;
    if (r.isBridge) continue;
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const nx = r.x + dx;
      const ny = r.y + dy;
      const key = `${nx},${ny}`;
      if (nx < 1 || ny < 1 || nx >= size - 1 || ny >= size - 1) continue;
      if (occupiedTiles.has(key) || roadMap.has(key)) continue;
      const t = terrain.tiles[ny][nx];
      if (t === "water" || t === "rock") continue;
      if (((nx * 73856093) ^ (ny * 19349663)) % 3 !== 0) continue;
      occupiedTiles.add(key);
      props.push({ id: `tree_${nx}_${ny}`, kind: "tree", tileX: nx, tileY: ny });
      if (props.length >= treeCap) break;
    }
  }

  const allLots = [
    ...buildings.map((b) => ({ x: b.tileX, y: b.tileY, sectorIdx: b.sectorIdx })),
    ...houses.map((h) => ({ x: h.tileX, y: h.tileY, sectorIdx: h.districtIdx })),
    ...supportingBuildings.map((s) => ({ x: s.tileX, y: s.tileY, sectorIdx: s.sectorIdx })),
  ];
  const blocks = identifyBlocks(allLots, size);

  return {
    sectors,
    buildings,
    houses,
    roads: roadNet.roads,
    plaza,
    supportingBuildings,
    marketStalls,
    ruralFeatures,
    sidewalks: roadNet.sidewalks,
    props,
    blocks,
  };
}
