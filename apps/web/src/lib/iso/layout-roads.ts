/**
 * Deterministic road graph & sidewalk generator per arc flavour.
 * Enforces calm road density (12-18% cap at largest stage, less earlier),
 * single connected component, straight avenues with branches, no 2-wide carpets,
 * and monotonic growth across stages.
 */

import type { TerrainMap, TileKind } from "./terrain.ts";
import type { RoadTile, SidewalkTile } from "./layout-types.ts";
import { createRng, type PRNG } from "./rng.ts";

export interface RoadNetworkResult {
  roads: RoadTile[];
  sidewalks: SidewalkTile[];
  roadMap: Map<string, RoadTile>;
}

interface PathNode {
  x: number;
  y: number;
  g: number;
  f: number;
  parent?: PathNode;
  dir?: number;
}

function dist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.abs(x1 - x2) + Math.abs(y1 - y2);
}

/**
 * A* pathfinding that prioritizes reusing existing roads, penalizes turns,
 * and strongly penalizes running parallel/adjacent to existing roads.
 */
function findRoadPath(
  startX: number,
  startY: number,
  targetX: number,
  targetY: number,
  terrain: TerrainMap,
  existingRoads: Map<string, RoadTile>,
  arcId: string,
  reserved?: Set<string>
): Array<{ x: number; y: number }> | null {
  const size = terrain.size;
  const isGrid = arcId === "cave_hold" || arcId === "dino_vale";
  const openSet: PathNode[] = [];
  const closedSet = new Set<string>();
  const nodeMap = new Map<string, PathNode>();

  const startNode: PathNode = { x: startX, y: startY, g: 0, f: dist(startX, startY, targetX, targetY) };
  openSet.push(startNode);
  nodeMap.set(`${startX},${startY}`, startNode);

  const dxs = [0, 1, 0, -1];
  const dys = [-1, 0, 1, 0];

  while (openSet.length > 0) {
    let bestIdx = 0;
    for (let i = 1; i < openSet.length; i++) {
      if (openSet[i].f < openSet[bestIdx].f) bestIdx = i;
    }
    const current = openSet.splice(bestIdx, 1)[0];
    closedSet.add(`${current.x},${current.y}`);

    if (current.x === targetX && current.y === targetY) {
      const path: Array<{ x: number; y: number }> = [];
      let curr: PathNode | undefined = current;
      while (curr) {
        path.unshift({ x: curr.x, y: curr.y });
        curr = curr.parent;
      }
      return path;
    }

    for (let d = 0; d < 4; d++) {
      const nx = current.x + dxs[d];
      const ny = current.y + dys[d];
      if (nx < 1 || nx >= size - 1 || ny < 1 || ny >= size - 1) continue;
      const nKey = `${nx},${ny}`;
      if (closedSet.has(nKey)) continue;

      const tk: TileKind = terrain.tiles[ny][nx];
      if (tk === "rock") continue;
      if (reserved?.has(nKey) && !(nx === targetX && ny === targetY)) continue;

      let cost = 2.0;
      if (existingRoads.has(nKey)) {
        cost = 0.15; // Strongly prefer reusing existing roads
      } else if (tk === "water") {
        cost = 22.0; // Bridges only when necessary
      } else {
        // Penalize tiles adjacent to existing roads to prevent parallel side-by-side streets
        let parallelCount = 0;
        for (let od = 0; od < 4; od++) {
          const onx = nx + dxs[od];
          const ony = ny + dys[od];
          if (existingRoads.has(`${onx},${ony}`) && (onx !== current.x || ony !== current.y)) {
            parallelCount++;
          }
        }
        if (parallelCount > 0) cost += 4.5 * parallelCount;
      }

      // Turn penalty creates straight, readable streets
      if (current.dir !== undefined && current.dir !== d) {
        cost += isGrid ? 2.5 : 1.5;
      }
      if (isGrid && (nx % 4 === 0 || ny % 4 === 0)) {
        cost -= 0.3;
      }

      const tentativeG = current.g + cost;
      const existing = nodeMap.get(nKey);
      if (!existing || tentativeG < existing.g) {
        const h = dist(nx, ny, targetX, targetY);
        const nextNode: PathNode = { x: nx, y: ny, g: tentativeG, f: tentativeG + h, parent: current, dir: d };
        nodeMap.set(nKey, nextNode);
        if (!existing) openSet.push(nextNode);
      }
    }
  }
  return null;
}

/**
 * Checks if placing a road at (x, y) would complete any 2x2 square of road tiles.
 */
function forms2x2(x: number, y: number, roadMap: Map<string, RoadTile>): boolean {
  const corners = [
    [ [1, 0], [0, 1], [1, 1] ],
    [ [-1, 0], [0, 1], [-1, 1] ],
    [ [1, 0], [0, -1], [1, -1] ],
    [ [-1, 0], [0, -1], [-1, -1] ],
  ];
  for (const [[dx1, dy1], [dx2, dy2], [dx3, dy3]] of corners) {
    if (
      roadMap.has(`${x + dx1},${y + dy1}`) &&
      roadMap.has(`${x + dx2},${y + dy2}`) &&
      roadMap.has(`${x + dx3},${y + dy3}`)
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Carves an A* road path, strictly avoiding 2-wide carpets and observing budget caps.
 */
function carveRoad(
  startX: number,
  startY: number,
  targetX: number,
  targetY: number,
  terrain: TerrainMap,
  roadMap: Map<string, RoadTile>,
  arcId: string,
  kind: "main" | "branch" | "lane" | "path",
  reserved: Set<string>,
  maxBudget: number
): Array<{ x: number; y: number }> {
  const path = findRoadPath(startX, startY, targetX, targetY, terrain, roadMap, arcId, reserved);
  if (!path) return [];
  const carved: Array<{ x: number; y: number }> = [];

  for (let i = 0; i < path.length; i++) {
    if (roadMap.size >= maxBudget) break;
    const pt = path[i];
    const key = `${pt.x},${pt.y}`;
    if (reserved.has(key) && pt.x === targetX && pt.y === targetY) continue;
    if (terrain.tiles[pt.y][pt.x] === "rock") continue;

    if (!roadMap.has(key)) {
      if (forms2x2(pt.x, pt.y, roadMap)) continue;
      roadMap.set(key, { x: pt.x, y: pt.y, isBridge: terrain.tiles[pt.y][pt.x] === "water", kind });
      carved.push(pt);
    }
  }
  return carved;
}

/**
 * Carves a straight street branch of at least 2 tiles starting from an existing road tile.
 */
function carveBranch(
  fromX: number,
  fromY: number,
  dx: number,
  dy: number,
  length: number,
  terrain: TerrainMap,
  roadMap: Map<string, RoadTile>,
  reserved: Set<string>,
  maxBudget: number
): void {
  for (let s = 1; s <= length; s++) {
    if (roadMap.size >= maxBudget) break;
    const bx = fromX + dx * s;
    const by = fromY + dy * s;
    const bk = `${bx},${by}`;
    if (bx < 1 || bx >= terrain.size - 1 || by < 1 || by >= terrain.size - 1) break;
    if (terrain.tiles[by][bx] === "rock" || reserved.has(bk)) break;
    if (forms2x2(bx, by, roadMap)) break;
    if (!roadMap.has(bk)) {
      roadMap.set(bk, { x: bx, y: by, isBridge: terrain.tiles[by][bx] === "water", kind: "lane" });
    }
  }
}

/**
 * Ensures only the connected component reachable from plaza is kept.
 */
function pruneDisconnected(roadMap: Map<string, RoadTile>, plaza: { x: number; y: number }): void {
  let startKey: string | null = null;
  let minD = Infinity;
  for (const [k, r] of roadMap.entries()) {
    const d = Math.abs(r.x - plaza.x) + Math.abs(r.y - plaza.y);
    if (d < minD) {
      minD = d;
      startKey = k;
    }
  }
  if (!startKey) return;

  const connected = new Set<string>();
  const queue = [startKey];
  connected.add(startKey);

  while (queue.length > 0) {
    const [cx, cy] = queue.shift()!.split(",").map(Number);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nk = `${cx + dx},${cy + dy}`;
      if (roadMap.has(nk) && !connected.has(nk)) {
        connected.add(nk);
        queue.push(nk);
      }
    }
  }

  for (const k of Array.from(roadMap.keys())) {
    if (!connected.has(k)) {
      roadMap.delete(k);
    }
  }
}

/**
 * Prunes 1-tile dead-end spurs from junctions that do not touch landmarks.
 */
function pruneSpurs(roadMap: Map<string, RoadTile>, anchors: Array<{ x: number; y: number }>): void {
  const landmarkSet = new Set(anchors.map((a) => `${a.x},${a.y}`));
  for (const [k, r] of Array.from(roadMap.entries())) {
    if (r.kind === "main") continue;
    const neighbors: string[] = [];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nk = `${r.x + dx},${r.y + dy}`;
      if (roadMap.has(nk)) neighbors.push(nk);
    }
    if (neighbors.length === 1) {
      let touchesLandmark = false;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (landmarkSet.has(`${r.x + dx},${r.y + dy}`)) touchesLandmark = true;
      }
      if (!touchesLandmark) {
        const [nx, ny] = neighbors[0].split(",").map(Number);
        let nDeg = 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          if (roadMap.has(`${nx + dx},${ny + dy}`)) nDeg++;
        }
        if (nDeg >= 3) {
          roadMap.delete(k);
        }
      }
    }
  }
}

export function generateRoadNetwork(
  terrain: TerrainMap,
  plaza: { x: number; y: number },
  anchors: Array<{ x: number; y: number; sectorIdx: number }>,
  arcId: string,
  stageIndex: number
): RoadNetworkResult {
  const roadMap = new Map<string, RoadTile>();
  const mainRoadTiles = new Set<string>();
  const reserved = new Set<string>(anchors.map((a) => `${a.x},${a.y}`));
  reserved.add(`${plaza.x},${plaza.y}`);

  // Count buildable land to establish strict stage budgets (12-18% cap at largest stage)
  let landCount = 0;
  for (let y = 0; y < terrain.size; y++) {
    for (let x = 0; x < terrain.size; x++) {
      const t = terrain.tiles[y][x];
      if (t !== "water" && t !== "rock") landCount++;
    }
  }

  // Budget ceilings per stage
  const stageBudgets = [
    Math.floor(landCount * 0.07),  // Stage 0: ~5-7% (hamlet)
    Math.floor(landCount * 0.10),  // Stage 1: ~7-10% (village)
    Math.floor(landCount * 0.13),  // Stage 2: ~10-13% (town)
    Math.floor(landCount * 0.15),  // Stage 3: ~13-15% (city)
    Math.floor(landCount * 0.175), // Stage 4: ~15-17.5% (grand city, strictly <= 18%)
  ];
  const maxBudget = stageBudgets[Math.min(4, Math.max(0, stageIndex))];

  // 1. STAGE 0: Central Plaza Hub (1-tile-wide ring around plaza)
  const hubRing = [
    { x: plaza.x - 1, y: plaza.y }, { x: plaza.x + 1, y: plaza.y },
    { x: plaza.x, y: plaza.y - 1 }, { x: plaza.x, y: plaza.y + 1 },
    { x: plaza.x - 1, y: plaza.y - 1 }, { x: plaza.x + 1, y: plaza.y - 1 },
    { x: plaza.x - 1, y: plaza.y + 1 }, { x: plaza.x + 1, y: plaza.y + 1 },
  ];
  for (const pt of hubRing) {
    if (pt.x >= 1 && pt.x < terrain.size - 1 && pt.y >= 1 && pt.y < terrain.size - 1) {
      const tk = terrain.tiles[pt.y][pt.x];
      const k = `${pt.x},${pt.y}`;
      if (tk !== "rock" && !reserved.has(k)) {
        roadMap.set(k, { x: pt.x, y: pt.y, isBridge: tk === "water", kind: "main" });
        mainRoadTiles.add(k);
      }
    }
  }

  // Radial main avenues from plaza hub to district landmarks
  const districtRoads: Array<{ x: number; y: number; sectorIdx: number }> = [];
  const avenueMidpoints: Array<{ x: number; y: number }> = [];

  for (const anchor of anchors) {
    let bestStart = hubRing[0];
    let minD = Infinity;
    for (const pt of hubRing) {
      const d = dist(pt.x, pt.y, anchor.x, anchor.y);
      if (d < minD && roadMap.has(`${pt.x},${pt.y}`)) {
        minD = d;
        bestStart = pt;
      }
    }

    const carved = carveRoad(bestStart.x, bestStart.y, anchor.x, anchor.y, terrain, roadMap, arcId, "main", reserved, maxBudget);
    for (const pt of carved) mainRoadTiles.add(`${pt.x},${pt.y}`);
    if (carved.length > 3) {
      avenueMidpoints.push(carved[Math.floor(carved.length / 2)]);
    }

    // Ensure direct adjacency to landmark
    const adjs = [
      { x: anchor.x + 1, y: anchor.y }, { x: anchor.x - 1, y: anchor.y },
      { x: anchor.x, y: anchor.y + 1 }, { x: anchor.x, y: anchor.y - 1 },
    ];
    let touched = adjs.find((p) => roadMap.has(`${p.x},${p.y}`));
    if (!touched) {
      for (const ap of adjs) {
        if (ap.x >= 1 && ap.x < terrain.size - 1 && ap.y >= 1 && ap.y < terrain.size - 1) {
          if (terrain.tiles[ap.y][ap.x] !== "rock") {
            const extra = carveRoad(bestStart.x, bestStart.y, ap.x, ap.y, terrain, roadMap, arcId, "main", reserved, maxBudget);
            for (const pt of extra) mainRoadTiles.add(`${pt.x},${pt.y}`);
            if (roadMap.has(`${ap.x},${ap.y}`)) {
              touched = ap;
              break;
            }
          }
        }
      }
    }
    if (touched) districtRoads.push({ x: touched.x, y: touched.y, sectorIdx: anchor.sectorIdx });
  }

  // 2. STAGE 1: Village District Street Wings & Primary Inter-District Links
  if (stageIndex >= 1) {
    for (const dr of districtRoads) {
      for (const { dx, dy } of [{ dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 }]) {
        carveBranch(dr.x, dr.y, dx, dy, 3, terrain, roadMap, reserved, maxBudget);
      }
    }
    if (districtRoads.length >= 6) {
      carveRoad(districtRoads[0].x, districtRoads[0].y, districtRoads[1].x, districtRoads[1].y, terrain, roadMap, arcId, "lane", reserved, maxBudget);
      carveRoad(districtRoads[2].x, districtRoads[2].y, districtRoads[5].x, districtRoads[5].y, terrain, roadMap, arcId, "lane", reserved, maxBudget);
    }
  }

  // 3. STAGE 2: Town Inner Ring & Midpoint Residential Streets
  if (stageIndex >= 2) {
    if (districtRoads.length >= 6) {
      carveRoad(districtRoads[1].x, districtRoads[1].y, districtRoads[4].x, districtRoads[4].y, terrain, roadMap, arcId, "lane", reserved, maxBudget);
      carveRoad(districtRoads[3].x, districtRoads[3].y, districtRoads[4].x, districtRoads[4].y, terrain, roadMap, arcId, "lane", reserved, maxBudget);
      carveRoad(districtRoads[0].x, districtRoads[0].y, districtRoads[2].x, districtRoads[2].y, terrain, roadMap, arcId, "lane", reserved, maxBudget);
      carveRoad(districtRoads[5].x, districtRoads[5].y, districtRoads[3].x, districtRoads[3].y, terrain, roadMap, arcId, "lane", reserved, maxBudget);
    }
    for (const mp of avenueMidpoints) {
      carveBranch(mp.x, mp.y, 1, 0, 3, terrain, roadMap, reserved, maxBudget);
      carveBranch(mp.x, mp.y, -1, 0, 3, terrain, roadMap, reserved, maxBudget);
    }
  }

  // 4. STAGE 3: City Midpoint Cross Streets & Secondary Residential Blocks
  if (stageIndex >= 3) {
    for (const mp of avenueMidpoints) {
      carveBranch(mp.x, mp.y, 0, 1, 3, terrain, roadMap, reserved, maxBudget);
      carveBranch(mp.x, mp.y, 0, -1, 3, terrain, roadMap, reserved, maxBudget);
    }
    for (const dr of districtRoads) {
      carveBranch(dr.x, dr.y, 1, 0, 4, terrain, roadMap, reserved, maxBudget);
      carveBranch(dr.x, dr.y, -1, 0, 4, terrain, roadMap, reserved, maxBudget);
    }
  }

  // 5. STAGE 4: Grand City Outer Perimeter Boulevards (capped strictly at maxBudget)
  if (stageIndex >= 4) {
    if (districtRoads.length >= 6) {
      carveRoad(districtRoads[1].x, districtRoads[1].y, districtRoads[3].x, districtRoads[3].y, terrain, roadMap, arcId, "lane", reserved, maxBudget);
      carveRoad(districtRoads[4].x, districtRoads[4].y, districtRoads[5].x, districtRoads[5].y, terrain, roadMap, arcId, "lane", reserved, maxBudget);
    }
    for (const dr of districtRoads) {
      carveBranch(dr.x, dr.y, 0, 1, 4, terrain, roadMap, reserved, maxBudget);
      carveBranch(dr.x, dr.y, 0, -1, 4, terrain, roadMap, reserved, maxBudget);
    }
  }

  // 6. Pruning and Cleanup: ensure single connected component and no short spurs
  pruneDisconnected(roadMap, plaza);
  pruneSpurs(roadMap, anchors);

  // 7. Junctions, Crosswalks, Lamps
  for (const r of Array.from(roadMap.values())) {
    let degree = 0;
    const nbs = [{ x: r.x + 1, y: r.y }, { x: r.x - 1, y: r.y }, { x: r.x, y: r.y + 1 }, { x: r.x, y: r.y - 1 }];
    for (const n of nbs) {
      if (roadMap.has(`${n.x},${n.y}`)) degree++;
    }
    if (degree >= 3) {
      r.isJunction = true;
      if (stageIndex >= 1) r.hasCrosswalk = true;
    }
    if (r.kind === "main" && (r.x + r.y) % 3 === 0 && !r.isBridge) {
      r.hasLamp = true;
    }
  }

  // 8. Sidewalk strips (stage >= 1)
  const sidewalks: SidewalkTile[] = [];
  const sidewalkSet = new Set<string>();

  if (stageIndex >= 1) {
    for (const rKey of mainRoadTiles) {
      const [rx, ry] = rKey.split(",").map(Number);
      const r = roadMap.get(rKey);
      if (!r || r.isBridge) continue;

      const candidates = [{ x: rx - 1, y: ry }, { x: rx + 1, y: ry }, { x: rx, y: ry - 1 }, { x: rx, y: ry + 1 }];
      for (const c of candidates) {
        if (c.x < 1 || c.x >= terrain.size - 1 || c.y < 1 || c.y >= terrain.size - 1) continue;
        const cKey = `${c.x},${c.y}`;
        if (roadMap.has(cKey) || sidewalkSet.has(cKey) || reserved.has(cKey)) continue;
        const tk = terrain.tiles[c.y][c.x];
        if (tk === "water" || tk === "rock") continue;

        sidewalkSet.add(cKey);
        sidewalks.push({ x: c.x, y: c.y, roadX: rx, roadY: ry });
      }
    }
  }

  return { roads: Array.from(roadMap.values()), sidewalks, roadMap };
}
