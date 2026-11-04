/**
 * Deterministic road graph & sidewalk generator per arc flavour.
 * Generates main avenues, district lanes, bridges, junctions, and sidewalks.
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

function findRoadPath(
  startX: number,
  startY: number,
  targetX: number,
  targetY: number,
  terrain: TerrainMap,
  existingRoads: Map<string, RoadTile>,
  arcId: string,
  rng: PRNG
): Array<{ x: number; y: number }> | null {
  const size = terrain.size;
  const isGrid = arcId === "cave_hold" || arcId === "dino_vale";
  const openSet: PathNode[] = [];
  const closedSet = new Set<string>();
  const nodeMap = new Map<string, PathNode>();
  const dist = (x1: number, y1: number, x2: number, y2: number) => Math.abs(x1 - x2) + Math.abs(y1 - y2);

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

      let cost = tk === "water" ? 18 : existingRoads.has(nKey) ? 0.3 : 2;
      if (isGrid) {
        if (current.dir !== undefined && current.dir !== d) cost += 3.0;
        if (nx % 4 === 0 || ny % 4 === 0) cost -= 0.5;
      } else if (rng.nextInt(0, 100) < 25) {
        cost += 0.8;
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

function carveRoad(
  startX: number,
  startY: number,
  targetX: number,
  targetY: number,
  terrain: TerrainMap,
  roadMap: Map<string, RoadTile>,
  arcId: string,
  kind: "main" | "branch" | "lane" | "path",
  rng: PRNG,
  reserved?: Set<string>
): Array<{ x: number; y: number }> {
  const path = findRoadPath(startX, startY, targetX, targetY, terrain, roadMap, arcId, rng);
  if (!path) return [];
  const carved: Array<{ x: number; y: number }> = [];

  for (let i = 0; i < path.length; i++) {
    const pt = path[i];
    const key = `${pt.x},${pt.y}`;
    if (reserved?.has(key) || (i === path.length - 1 && pt.x === targetX && pt.y === targetY)) continue;
    if (terrain.tiles[pt.y][pt.x] === "rock") continue;

    if (!roadMap.has(key)) {
      roadMap.set(key, { x: pt.x, y: pt.y, isBridge: terrain.tiles[pt.y][pt.x] === "water", kind });
      carved.push(pt);
    }
  }
  return carved;
}

export function generateRoadNetwork(
  terrain: TerrainMap,
  plaza: { x: number; y: number },
  anchors: Array<{ x: number; y: number; sectorIdx: number }>,
  arcId: string,
  stageIndex: number
): RoadNetworkResult {
  const rng = createRng(`${arcId}_roads_stg${stageIndex}_${plaza.x}_${plaza.y}`);
  const roadMap = new Map<string, RoadTile>();
  const mainRoadTiles = new Set<string>();
  const reserved = new Set<string>(anchors.map((a) => `${a.x},${a.y}`));
  reserved.add(`${plaza.x},${plaza.y}`);

  // 1. Central Plaza Hub (ring around plaza)
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
        roadMap.set(k, { x: pt.x, y: pt.y, isBridge: tk === "water", kind: stageIndex === 0 ? "path" : "main" });
        mainRoadTiles.add(k);
      }
    }
  }

  // Elf Grove special ring
  if (arcId === "elf_grove") {
    const ringOffsets = [
      { x: -2, y: -1 }, { x: -2, y: 0 }, { x: -2, y: 1 }, { x: 2, y: -1 }, { x: 2, y: 0 }, { x: 2, y: 1 },
      { x: -1, y: -2 }, { x: 0, y: -2 }, { x: 1, y: -2 }, { x: -1, y: 2 }, { x: 0, y: 2 }, { x: 1, y: 2 },
    ];
    for (const off of ringOffsets) {
      const rx = plaza.x + off.x;
      const ry = plaza.y + off.y;
      if (rx >= 1 && rx < terrain.size - 1 && ry >= 1 && ry < terrain.size - 1) {
        const tk = terrain.tiles[ry][rx];
        const k = `${rx},${ry}`;
        if (tk !== "rock" && !reserved.has(k)) {
          roadMap.set(k, { x: rx, y: ry, isBridge: tk === "water", kind: "lane" });
          mainRoadTiles.add(k);
        }
      }
    }
  }

  // 2. Main avenues from plaza hub to each district landmark
  const roadKind: "main" | "path" = stageIndex === 0 ? "path" : "main";
  for (const anchor of anchors) {
    let startX = plaza.x;
    let startY = plaza.y;
    let minD = Infinity;
    for (const pt of hubRing) {
      const d = Math.abs(pt.x - anchor.x) + Math.abs(pt.y - anchor.y);
      if (d < minD && roadMap.has(`${pt.x},${pt.y}`)) {
        minD = d;
        startX = pt.x;
        startY = pt.y;
      }
    }

    const carved = carveRoad(startX, startY, anchor.x, anchor.y, terrain, roadMap, arcId, roadKind, rng, reserved);
    for (const pt of carved) mainRoadTiles.add(`${pt.x},${pt.y}`);

    // Ensure landmark connectivity
    const adjs = [
      { x: anchor.x + 1, y: anchor.y }, { x: anchor.x - 1, y: anchor.y },
      { x: anchor.x, y: anchor.y + 1 }, { x: anchor.x, y: anchor.y - 1 },
    ];
    if (!adjs.some((p) => roadMap.has(`${p.x},${p.y}`))) {
      for (const ap of adjs) {
        if (ap.x >= 1 && ap.x < terrain.size - 1 && ap.y >= 1 && ap.y < terrain.size - 1) {
          if (terrain.tiles[ap.y][ap.x] !== "rock") {
            carveRoad(startX, startY, ap.x, ap.y, terrain, roadMap, arcId, roadKind, rng, reserved);
            if (roadMap.has(`${ap.x},${ap.y}`)) break;
          }
        }
      }
    }

    // District local street grid forming blocks
    const armLen = stageIndex === 0 ? 3 : 5;
    carveRoad(anchor.x - armLen, anchor.y, anchor.x + armLen, anchor.y, terrain, roadMap, arcId, "lane", rng, reserved);
    carveRoad(anchor.x, anchor.y - armLen, anchor.x, anchor.y + armLen, terrain, roadMap, arcId, "lane", rng, reserved);

    const span = stageIndex === 0 ? 2 : 3;
    carveRoad(anchor.x - armLen, anchor.y - span, anchor.x + armLen, anchor.y - span, terrain, roadMap, arcId, "lane", rng, reserved);
    carveRoad(anchor.x - armLen, anchor.y + span, anchor.x + armLen, anchor.y + span, terrain, roadMap, arcId, "lane", rng, reserved);
    carveRoad(anchor.x - span, anchor.y - armLen, anchor.x - span, anchor.y + armLen, terrain, roadMap, arcId, "lane", rng, reserved);
    carveRoad(anchor.x + span, anchor.y - armLen, anchor.x + span, anchor.y + armLen, terrain, roadMap, arcId, "lane", rng, reserved);

    if (stageIndex >= 1) {
      const midX = Math.floor((startX + anchor.x) / 2);
      const midY = Math.floor((startY + anchor.y) / 2);
      carveRoad(midX - 3, midY, midX + 3, midY, terrain, roadMap, arcId, "lane", rng, reserved);
      carveRoad(midX, midY - 3, midX, midY + 3, terrain, roadMap, arcId, "lane", rng, reserved);
    }
  }

  // 3. Inter-district connections & Arc Flavour
  if (stageIndex >= 1) {
    for (let i = 0; i < anchors.length; i++) {
      const a1 = anchors[i];
      const a2 = anchors[(i + 1) % anchors.length];
      if (stageIndex >= 2 || i % 2 === 0) {
        carveRoad(a1.x, a1.y, a2.x, a2.y, terrain, roadMap, arcId, "lane", rng, reserved);
      }
    }

    if (arcId === "cave_hold") {
      for (let off = -8; off <= 8; off += 8) {
        if (off !== 0 && plaza.y + off >= 2 && plaza.y + off < terrain.size - 2) {
          carveRoad(plaza.x - 10, plaza.y + off, plaza.x + 10, plaza.y + off, terrain, roadMap, arcId, "lane", rng, reserved);
        }
      }
    } else if (arcId === "dino_vale") {
      const extraTiles: Array<{ x: number; y: number }> = [];
      for (const r of Array.from(roadMap.values())) {
        if (r.kind === "main" && !r.isBridge && (r.x + r.y) % 2 === 0) {
          const ex = r.x + 1;
          if (ex < terrain.size - 1 && terrain.tiles[r.y][ex] !== "rock" && terrain.tiles[r.y][ex] !== "water") {
            const k = `${ex},${r.y}`;
            if (!roadMap.has(k) && !reserved.has(k)) extraTiles.push({ x: ex, y: r.y });
          }
        }
      }
      for (const pt of extraTiles) {
        roadMap.set(`${pt.x},${pt.y}`, { x: pt.x, y: pt.y, isBridge: false, kind: "main" });
        mainRoadTiles.add(`${pt.x},${pt.y}`);
      }
    }
  }

  // 4. Junctions, Crosswalks, Lamps
  for (const r of Array.from(roadMap.values())) {
    let degree = 0;
    const nbs = [{ x: r.x + 1, y: r.y }, { x: r.x - 1, y: r.y }, { x: r.x, y: r.y + 1 }, { x: r.x, y: r.y - 1 }];
    for (const n of nbs) if (roadMap.has(`${n.x},${n.y}`)) degree++;
    if (degree >= 3) {
      r.isJunction = true;
      if (stageIndex >= 1) r.hasCrosswalk = true;
    }
    if (r.kind === "main" && (r.x + r.y) % 3 === 0 && !r.isBridge) r.hasLamp = true;
  }

  // 5. Sidewalk strips (stage >= 1)
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
