/**
 * High-performance mobile walker manager (pedestrians & carts) in PixiJS v8.
 * Automatically depth-sorts with buildings and trees, handles pause at doors,
 * prevents teleportation across scene rebuilds, and respects WCAG reduced-motion.
 */

import { Container, Sprite } from "pixi.js";
import { isoToScreen, depthSortKey } from "./iso-math.ts";
import { createRng, type PRNG } from "./rng.ts";
import {
  buildRoadGraph,
  stepWalker,
  spawnWalkers,
  type WalkerState,
  type RoadGraph,
  type BuildingDoorInfo,
  type HouseDoorInfo,
} from "./life-paths.ts";
import type { LifeTextureCache } from "./life-sprites.ts";
import { isSpriteInView, type ViewportBounds } from "./life-ambient.ts";
import type { RoadTile } from "./layout-types.ts";

export interface LifeWalkerManagerOptions {
  parentLayer: Container;
  lifeTextures: LifeTextureCache;
  roads: RoadTile[];
  graph?: RoadGraph;
  buildings?: BuildingDoorInfo[];
  houses?: HouseDoorInfo[];
  population?: number;
  seed: string | number;
  arcId: string;
  allowMotion?: boolean;
  isNight?: boolean;
}

export class LifeWalkerManager {
  private parentLayer: Container;
  private lifeTextures: LifeTextureCache;
  private walkerStates = new Map<string, WalkerState>();
  private walkerSprites = new Map<string, Sprite>();
  private roadGraph: RoadGraph = new Map();
  private rng: PRNG;

  constructor(parentLayer: Container, lifeTextures: LifeTextureCache) {
    this.parentLayer = parentLayer;
    this.parentLayer.sortableChildren = true;
    this.lifeTextures = lifeTextures;
    this.rng = createRng("life_walker_clock");
  }

  public setup(options: LifeWalkerManagerOptions): void {
    this.parentLayer = options.parentLayer;
    this.parentLayer.sortableChildren = true;
    this.lifeTextures = options.lifeTextures;
    this.roadGraph = options.graph ?? buildRoadGraph(options.roads);
    this.rng = createRng(options.seed);

    // Spawn or update walkers, keeping existing walkers across sim-step rebuilds
    const activeWalkers = spawnWalkers({
      seed: options.seed,
      arcId: options.arcId,
      roads: options.roads,
      graph: this.roadGraph,
      buildings: options.buildings,
      houses: options.houses,
      population: options.population ?? 30,
      existingWalkers: this.walkerStates,
      isNight: options.isNight,
    });

    const currentIds = new Set(activeWalkers.map((w) => w.id));

    // Remove sprites for walkers that no longer exist (e.g. population decrease or closed shops)
    for (const [id, spr] of this.walkerSprites.entries()) {
      if (!currentIds.has(id)) {
        this.parentLayer.removeChild(spr);
        spr.destroy();
        this.walkerSprites.delete(id);
        this.walkerStates.delete(id);
      }
    }

    // Create or update sprites
    for (const w of activeWalkers) {
      this.walkerStates.set(w.id, w);
      let spr = this.walkerSprites.get(w.id);

      if (!spr) {
        const tex =
          w.kind === "cart"
            ? this.lifeTextures.getCartTexture(w.cartKind ?? "scrap", 0)
            : this.lifeTextures.getPedestrianTexture(w.colorIdx, 0);

        spr = new Sprite(tex);
        spr.anchor.set(0.5, 0.85);
        spr.roundPixels = true;
        this.parentLayer.addChild(spr);
        this.walkerSprites.set(w.id, spr);
      }

      // Initial positioning and depth sorting
      const scr = isoToScreen(w.currentPos.x, w.currentPos.y);
      spr.position.set(scr.x, scr.y);
      spr.scale.x = w.facing;
      spr.zIndex = depthSortKey(w.currentPos.x, w.currentPos.y, 1);
    }
  }

  public update(dt: number, viewBounds?: ViewportBounds, reducedMotion = false): void {
    if (this.walkerStates.size === 0) return;

    for (const [id, state] of this.walkerStates.entries()) {
      const spr = this.walkerSprites.get(id);
      if (!spr) continue;

      // Pure simulation step
      const nextState = stepWalker(state, dt, this.roadGraph, this.rng, reducedMotion);
      this.walkerStates.set(id, nextState);

      const scr = isoToScreen(nextState.currentPos.x, nextState.currentPos.y);
      const inView = viewBounds ? isSpriteInView(scr.x, scr.y, viewBounds, 48) : true;
      spr.visible = inView;

      if (inView) {
        spr.position.set(scr.x, scr.y);
        spr.scale.x = nextState.facing;
        spr.zIndex = depthSortKey(nextState.currentPos.x, nextState.currentPos.y, 1);

        // Update texture frame for step bob or wheel flicker
        if (nextState.kind === "cart") {
          spr.texture = this.lifeTextures.getCartTexture(
            nextState.cartKind ?? "scrap",
            nextState.bobFrame
          );
        } else {
          spr.texture = this.lifeTextures.getPedestrianTexture(
            nextState.colorIdx,
            reducedMotion ? 0 : nextState.bobFrame
          );
        }
      }
    }
  }

  public getWalkerCount(): number {
    return this.walkerStates.size;
  }

  public clear(): void {
    for (const spr of this.walkerSprites.values()) {
      this.parentLayer.removeChild(spr);
      spr.destroy();
    }
    this.walkerSprites.clear();
    // Keep walkerStates so if scene is re-created on step, state persists!
  }

  public destroy(): void {
    this.clear();
    this.walkerStates.clear();
  }
}
