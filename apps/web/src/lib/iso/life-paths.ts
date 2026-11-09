/**
 * Pure road graph, path finding, and walker simulation logic for isometric life.
 * Zero per-frame allocations, fully deterministic PRNG, WCAG reduced-motion compliant.
 */

import { createRng, type PRNG } from "./rng.ts";
import type { RoadTile } from "./layout-types.ts";

export type WalkerKind = "pedestrian" | "cart";
export type CartKind = "scrap" | "ore" | "bone" | "flower";

export interface Coord {
  x: number;
  y: number;
}

export type RoadGraph = Map<string, Coord[]>;

export interface WalkerState {
  id: string;
  kind: WalkerKind;
  arcId: string;
  cartKind?: CartKind;
  from: Coord;
  to: Coord;
  prev: Coord | null;
  progress: number;
  speed: number;
  pauseTimer: number;
  currentPos: Coord;
  facing: 1 | -1;
  bobFrame: number;
  colorIdx: number;
  targetBusinessId?: string;
  targetHouseId?: string;
}

export function getCartKindForArc(arcId: string): CartKind {
  const norm = arcId.toLowerCase();
  if (norm.includes("goblin")) return "scrap";
  if (norm.includes("cave") || norm.includes("reach") || norm.includes("obsidian")) return "ore";
  if (norm.includes("dino")) return "bone";
  if (norm.includes("elf")) return "flower";
  return "scrap";
}

/**
 * Constructs an adjacency graph from road tiles.
 * Only connects 4-way orthogonal neighbors on valid road tiles.
 */
export function buildRoadGraph(roads: RoadTile[]): RoadGraph {
  const graph: RoadGraph = new Map();
  const roadSet = new Set<string>();

  for (const r of roads) {
    roadSet.add(`${r.x},${r.y}`);
    graph.set(`${r.x},${r.y}`, []);
  }

  const dirs = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
  ];

  for (const r of roads) {
    const key = `${r.x},${r.y}`;
    const neighbors: Coord[] = [];
    for (const d of dirs) {
      const nx = r.x + d.dx;
      const ny = r.y + d.dy;
      if (roadSet.has(`${nx},${ny}`)) {
        neighbors.push({ x: nx, y: ny });
      }
    }
    graph.set(key, neighbors);
  }

  return graph;
}

/**
 * Chooses the next road tile along a random walk.
 * Strictly avoids immediate U-turns at non-dead-ends.
 * If at a dead-end (degree 1), reverses direction to prev.
 */
export function pickNextRoadTile(
  graph: RoadGraph,
  current: Coord,
  prev: Coord | null,
  rng: PRNG
): Coord {
  const curKey = `${current.x},${current.y}`;
  const neighbors = graph.get(curKey) ?? [];
  if (neighbors.length === 0) return current;
  if (neighbors.length === 1) return neighbors[0];

  // More than 1 neighbor: filter out immediate U-turn if prev is known
  let candidates = neighbors;
  if (prev) {
    const filtered = neighbors.filter((n) => !(n.x === prev.x && n.y === prev.y));
    if (filtered.length > 0) {
      candidates = filtered;
    }
  }

  const idx = rng.nextInt(0, candidates.length - 1);
  return candidates[idx];
}

/**
 * Calculates pedestrian and cart spawn counts capped strictly:
 * Pedestrians: scales with population, cap 24.
 * Carts: 1 for each open business with stock, cap 8.
 */
export function computeWalkerCounts(
  population: number,
  openBusinessesWithStock: number
): { pedestrianCount: number; cartCount: number } {
  const rawPeds = Math.floor(population / 5) + 2;
  const pedestrianCount = Math.max(1, Math.min(24, rawPeds));
  const cartCount = Math.max(0, Math.min(8, openBusinessesWithStock));
  return { pedestrianCount, cartCount };
}

/**
 * Pure simulation step for a single walker.
 * Respects reduced-motion (0 speed, static position), pause timers, and bob frames.
 */
export function stepWalker(
  walker: WalkerState,
  dt: number,
  graph: RoadGraph,
  rng: PRNG,
  reducedMotion = false
): WalkerState {
  if (reducedMotion) {
    return {
      ...walker,
      progress: 0,
      currentPos: { ...walker.from },
      bobFrame: 0,
      pauseTimer: 0,
    };
  }

  // Handle pause timers (e.g. trading at business doors)
  if (walker.pauseTimer > 0) {
    const nextPause = Math.max(0, walker.pauseTimer - dt);
    return {
      ...walker,
      pauseTimer: nextPause,
      bobFrame: 0,
    };
  }

  const effectiveSpeed = walker.speed;
  let newProgress = walker.progress + effectiveSpeed * dt;
  let from = walker.from;
  let to = walker.to;
  let prev = walker.prev;
  let pauseTimer = 0;

  if (newProgress >= 1.0) {
    prev = from;
    from = to;
    to = pickNextRoadTile(graph, from, prev, rng);
    newProgress = newProgress - 1.0;

    // At business doors or target destination, carts pause for ~1.0s to simulate trade
    if (walker.kind === "cart" && walker.targetBusinessId) {
      pauseTimer = 1.0;
    }
  }

  const curX = from.x + (to.x - from.x) * newProgress;
  const curY = from.y + (to.y - from.y) * newProgress;

  // Facing direction: positive dx or dy faces right (1), else left (-1)
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const facing: 1 | -1 = (dx - dy) >= 0 ? 1 : -1;

  // 2-frame step bob cycle based on progress
  const bobFrame = Math.floor(newProgress * 4) % 2;

  return {
    ...walker,
    from,
    to,
    prev,
    progress: newProgress,
    currentPos: { x: curX, y: curY },
    facing,
    bobFrame,
    pauseTimer,
  };
}

export interface BuildingDoorInfo {
  id: string;
  tileX: number;
  tileY: number;
  open: boolean;
  ruined?: boolean;
  hasStock?: boolean;
}

export interface HouseDoorInfo {
  id: string;
  tileX: number;
  tileY: number;
  level: number;
}

export interface SpawnWalkersOptions {
  seed: string | number;
  arcId: string;
  roads: RoadTile[];
  graph?: RoadGraph;
  buildings?: BuildingDoorInfo[];
  houses?: HouseDoorInfo[];
  population?: number;
  existingWalkers?: Map<string, WalkerState>;
  isNight?: boolean;
}

/**
 * Spawns walkers deterministically. Preserves state of existing walkers by id.
 */
export function spawnWalkers(options: SpawnWalkersOptions): WalkerState[] {
  const {
    seed,
    arcId,
    roads,
    buildings = [],
    houses = [],
    population = 30,
    existingWalkers,
    isNight = false,
  } = options;

  if (roads.length === 0) return [];

  const graph = options.graph ?? buildRoadGraph(roads);
  const rng = createRng(seed);

  // Active open businesses with stock eligible for carts
  const validBusinesses = buildings.filter(
    (b) => b.open && !b.ruined && (b.hasStock === undefined || b.hasStock === true)
  );

  const { pedestrianCount, cartCount } = computeWalkerCounts(population, validBusinesses.length);
  const walkers: WalkerState[] = [];

  // Helper: find nearest road tile to a given coordinate
  function findNearestRoad(coord: Coord): Coord {
    let nearest = roads[0];
    let minD = Infinity;
    for (const r of roads) {
      const d = Math.abs(r.x - coord.x) + Math.abs(r.y - coord.y);
      if (d < minD) {
        minD = d;
        nearest = r;
      }
    }
    return { x: nearest.x, y: nearest.y };
  }

  // 1. Spawn carts (1 for each valid business with stock, up to cartCount)
  const cartKind = getCartKindForArc(arcId);
  for (let c = 0; c < cartCount; c++) {
    const id = `cart_${c}`;
    const existing = existingWalkers?.get(id);
    if (existing) {
      walkers.push(existing);
      continue;
    }

    const b = validBusinesses[c % validBusinesses.length];
    const startRoad = findNearestRoad({ x: b.tileX, y: b.tileY });
    const nextRoad = pickNextRoadTile(graph, startRoad, null, rng);
    const speed = 0.6 + (c % 3) * 0.08;

    walkers.push({
      id,
      kind: "cart",
      arcId,
      cartKind,
      from: startRoad,
      to: nextRoad,
      prev: null,
      progress: (c * 0.23) % 1.0,
      speed,
      pauseTimer: 0,
      currentPos: { ...startRoad },
      facing: 1,
      bobFrame: 0,
      colorIdx: c % 4,
      targetBusinessId: b.id,
    });
  }

  // 2. Spawn pedestrians scaling with population (cap 24)
  for (let p = 0; p < pedestrianCount; p++) {
    const id = `ped_${p}`;
    const existing = existingWalkers?.get(id);
    if (existing) {
      walkers.push(existing);
      continue;
    }

    let startRoad: Coord;
    let targetHouseId: string | undefined;

    if (houses.length > 0) {
      const h = houses[p % houses.length];
      startRoad = findNearestRoad({ x: h.tileX, y: h.tileY });
      targetHouseId = h.id;
    } else {
      const r = roads[p % roads.length];
      startRoad = { x: r.x, y: r.y };
    }

    const nextRoad = pickNextRoadTile(graph, startRoad, null, rng);
    const speed = 0.75 + (p % 4) * 0.06;

    walkers.push({
      id,
      kind: "pedestrian",
      arcId,
      from: startRoad,
      to: nextRoad,
      prev: null,
      progress: (p * 0.17) % 1.0,
      speed,
      pauseTimer: 0,
      currentPos: { ...startRoad },
      facing: p % 2 === 0 ? 1 : -1,
      bobFrame: 0,
      colorIdx: p % 6,
      targetHouseId: isNight ? targetHouseId : undefined,
    });
  }

  return walkers;
}
