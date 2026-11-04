/**
 * High-performance deterministic animation and road-traffic system for PixiJS v8.
 * Simulates walking citizens, trading carts, chimney smoke, swaying trees, and water.
 * Everything is pre-allocated and pooled — ZERO per-frame allocations.
 */

import { Container, Sprite, Graphics } from "pixi.js";
import { TILE_HEIGHT, TILE_WIDTH } from "./iso-math.ts";
import type { RoadTile } from "./layout.ts";
import type { IsoTextureManager } from "./sprites.ts";

export interface ActorDef {
  id: string;
  isCart: boolean;
  path: Array<{ x: number; y: number }>;
  speed: number;
  phase: number;
}

interface ActiveSmoke {
  g: Graphics;
  baseX: number;
  baseY: number;
  age: number;
  maxAge: number;
  driftX: number;
}

/**
 * Finds road paths connecting the central plaza to buildings via BFS.
 */
export function generateRoadPaths(
  roads: RoadTile[],
  plaza: { x: number; y: number },
  destinations: Array<{ tileX: number; tileY: number }>
): Array<Array<{ x: number; y: number }>> {
  if (roads.length < 2) return [];

  const roadSet = new Map<string, RoadTile>();
  for (const r of roads) roadSet.set(`${r.x},${r.y}`, r);

  // Find nearest road to plaza
  let startRoad: RoadTile = roads[0];
  let minPlazaDist = Infinity;
  for (const r of roads) {
    const d = Math.abs(r.x - plaza.x) + Math.abs(r.y - plaza.y);
    if (d < minPlazaDist) {
      minPlazaDist = d;
      startRoad = r;
    }
  }

  const paths: Array<Array<{ x: number; y: number }>> = [];

  // Helper BFS to find road path from startRoad to a target road tile
  function findPathTo(target: RoadTile): Array<{ x: number; y: number }> | null {
    const queue: RoadTile[] = [startRoad];
    const parent = new Map<string, string>();
    const visited = new Set<string>([`${startRoad.x},${startRoad.y}`]);

    while (queue.length > 0) {
      const curr = queue.shift()!;
      if (curr.x === target.x && curr.y === target.y) {
        // Reconstruct path
        const result: Array<{ x: number; y: number }> = [];
        let currKey: string | undefined = `${curr.x},${curr.y}`;
        while (currKey) {
          const [kx, ky] = currKey.split(",").map(Number);
          result.unshift({ x: kx, y: ky });
          currKey = parent.get(currKey);
        }
        return result;
      }

      // Check 4 neighbors
      const neighbors = [
        { x: curr.x + 1, y: curr.y },
        { x: curr.x - 1, y: curr.y },
        { x: curr.x, y: curr.y + 1 },
        { x: curr.x, y: curr.y - 1 },
      ];

      for (const n of neighbors) {
        const nKey = `${n.x},${n.y}`;
        if (roadSet.has(nKey) && !visited.has(nKey)) {
          visited.add(nKey);
          parent.set(nKey, `${curr.x},${curr.y}`);
          queue.push(roadSet.get(nKey)!);
        }
      }
    }
    return null;
  }

  // Generate paths to road tiles adjacent to each destination
  for (const dest of destinations) {
    let nearestRoad: RoadTile | null = null;
    let minD = Infinity;

    for (const r of roads) {
      const d = Math.abs(r.x - dest.tileX) + Math.abs(r.y - dest.tileY);
      if (d <= 2 && d < minD) {
        minD = d;
        nearestRoad = r;
      }
    }

    if (nearestRoad) {
      const p = findPathTo(nearestRoad);
      if (p && p.length >= 2) {
        paths.push(p);
      }
    }
  }

  // Fallback: if no paths reached, create straight segments
  if (paths.length === 0) {
    paths.push(roads.slice(0, Math.min(10, roads.length)).map((r) => ({ x: r.x, y: r.y })));
  }

  return paths;
}

/**
 * Generates actor configurations capped strictly at <= 40.
 */
export function generateActors(
  roads: RoadTile[],
  plaza: { x: number; y: number },
  destinations: Array<{ tileX: number; tileY: number }>,
  population: number,
  openCount: number
): ActorDef[] {
  const paths = generateRoadPaths(roads, plaza, destinations);
  if (paths.length === 0) return [];

  // Count formula: scales with pop and open shops, capped at 40
  const rawCount = Math.floor(population / 6) + openCount * 2;
  const count = Math.max(2, Math.min(40, rawCount));

  const actors: ActorDef[] = [];
  for (let i = 0; i < count; i++) {
    const path = paths[i % paths.length];
    const isCart = i % 4 === 3; // 25% carts, 75% citizens
    const speed = isCart ? 0.012 + (i % 3) * 0.003 : 0.016 + (i % 4) * 0.003;
    const phase = i / count;

    actors.push({
      id: `actor_${i}`,
      isCart,
      path,
      speed,
      phase,
    });
  }

  return actors;
}

/** Fraction of each ping-pong leg spent standing still at the path ends (buildings/plaza). */
export const DWELL = 0.08;

/**
 * Maps a ping-pong cycle value (0..2) to path progress (0..1) with a short
 * pause at both ends, so people and carts stop at buildings.
 */
export function dwellProgress(cycle: number): number {
  const tri = cycle <= 1 ? cycle : 2 - cycle;
  const p = (tri - DWELL) / (1 - 2 * DWELL);
  return p < 0 ? 0 : p > 1 ? 1 : p;
}

/**
 * Manages pooled sprite animations for citizens, carts, smoke, trees, and water.
 */
export class IsoAnimationManager {
  private actorSprites: Array<{ spr: Sprite; def: ActorDef }> = [];
  private smokePool: ActiveSmoke[] = [];
  private trees: Sprite[] = [];
  private waterSprites: Sprite[] = [];
  private bobbers: Array<{ spr: Sprite; baseY: number }> = [];
  private glows: Graphics[] = [];
  private time = 0;
  private actorsLayer: Container;
  private effectsLayer: Container;
  private textureManager: IsoTextureManager;

  constructor(
    actorsLayer: Container,
    effectsLayer: Container,
    textureManager: IsoTextureManager
  ) {
    this.actorsLayer = actorsLayer;
    this.effectsLayer = effectsLayer;
    this.textureManager = textureManager;
  }

  public setup(
    actors: ActorDef[],
    smokeOrigins: Array<{ x: number; y: number }>,
    trees: Sprite[],
    water: Sprite[],
    arcId: string,
    glowOrigins: Array<{ x: number; y: number }> = [],
    bobSprites: Sprite[] = []
  ): void {
    this.clear();
    this.trees = trees;
    this.waterSprites = water;
    this.bobbers = bobSprites.map((spr) => ({ spr, baseY: spr.position.y }));

    // Lit-window glows (static pooled circles; only alpha changes per frame)
    for (const o of glowOrigins) {
      const g = new Graphics().circle(0, 0, 4).fill({ color: 0xf5b041, alpha: 0.35 });
      g.position.set(o.x, o.y);
      g.alpha = 0;
      this.effectsLayer.addChild(g);
      this.glows.push(g);
    }

    // 1. Pre-allocate and pool actor sprites
    for (const def of actors) {
      const tex = def.isCart
        ? this.textureManager.getCartTexture(arcId)
        : this.textureManager.getCitizenTexture(arcId);
      const spr = new Sprite(tex);
      spr.anchor.set(0.5, 0.85);
      this.actorsLayer.addChild(spr);
      this.actorSprites.push({ spr, def });
    }

    // 2. Pre-allocate and pool smoke particles for workshops & chimneys
    for (const origin of smokeOrigins) {
      for (let i = 0; i < 2; i++) {
        const g = new Graphics().circle(0, 0, 2).fill({ color: 0xbda88e, alpha: 0.5 });
        g.position.set(origin.x, origin.y);
        this.effectsLayer.addChild(g);
        this.smokePool.push({
          g,
          baseX: origin.x,
          baseY: origin.y,
          age: i * 35,
          maxAge: 75,
          driftX: i % 2 === 0 ? 0.25 : -0.2,
        });
      }
    }
  }

  public update(): void {
    this.time += 0.035;

    // 1. Update walking citizens and carts along paths (no per-frame allocation)
    const halfW = TILE_WIDTH / 2;
    const halfH = TILE_HEIGHT / 2;
    for (let a = 0; a < this.actorSprites.length; a++) {
      const { spr, def } = this.actorSprites[a];
      const path = def.path;
      if (path.length < 2) continue;

      // Ping-pong loop along path with a short pause at both ends
      const cycle = (this.time * def.speed + def.phase) % 2;
      const progress = dwellProgress(cycle);
      const totalSegments = path.length - 1;
      const exactIndex = progress * totalSegments;
      const idx = Math.min(Math.floor(exactIndex), totalSegments - 1);
      const frac = exactIndex - idx;

      const p0 = path[idx];
      const p1 = path[idx + 1];

      const curX = p0.x + (p1.x - p0.x) * frac;
      const curY = p0.y + (p1.y - p0.y) * frac;
      spr.position.set((curX - curY) * halfW, (curX + curY) * halfH);

      // Flip sprite facing direction
      const goingForward = cycle <= 1;
      spr.scale.x = (goingForward ? 1 : -1) * (p1.x >= p0.x ? 1 : -1);
    }

    // 2. Update chimney smoke particles
    for (const p of this.smokePool) {
      p.age += 1;
      if (p.age >= p.maxAge) {
        p.age = 0;
        p.g.position.set(p.baseX, p.baseY);
        p.g.alpha = 0.5;
        p.g.scale.set(1);
      } else {
        const progress = p.age / p.maxAge;
        p.g.y -= 0.35;
        p.g.x += p.driftX;
        p.g.alpha = (1 - progress) * 0.45;
        p.g.scale.set(1 + progress * 1.6);
      }
    }

    // 3. Subtle swaying treetops
    const sway = Math.sin(this.time * 1.5) * 0.03;
    for (let i = 0; i < this.trees.length; i++) {
      this.trees[i].skew.x = sway * ((i % 2 === 0) ? 1 : -1);
    }

    // 4. Harbor boats bob gently
    for (let i = 0; i < this.bobbers.length; i++) {
      const b = this.bobbers[i];
      b.spr.position.y = b.baseY + Math.sin(this.time * 2.2 + i) * 0.9;
    }

    // 5. Dusk window flicker: pooled glows, alpha only
    for (let i = 0; i < this.glows.length; i++) {
      const wave = Math.sin(this.time * 3.1 + i * 1.7) * Math.sin(this.time * 1.3 + i * 0.9);
      this.glows[i].alpha = 0.55 + 0.35 * wave;
    }

    // 6. Subtle water wave shimmer
    for (let i = 0; i < this.waterSprites.length; i++) {
      this.waterSprites[i].alpha = 0.88 + 0.12 * Math.sin(this.time * 2 + i * 0.6);
    }
  }

  public clear(): void {
    this.actorsLayer.removeChildren();
    this.effectsLayer.removeChildren();
    this.actorSprites = [];
    this.smokePool = [];
    this.trees = [];
    this.waterSprites = [];
    this.bobbers = [];
    this.glows = [];
  }

  public destroy(): void {
    this.clear();
  }
}
