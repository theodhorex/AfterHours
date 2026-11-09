/**
 * Unified living city coordinator for PixiJS v8.
 * Integrates road graph walkers (pedestrians & carts), ambient life (chimney smoke & birds),
 * camera culling, strict 80-sprite cap, and full WCAG reduced-motion compliance.
 */

import { Container, type Renderer } from "pixi.js";
import { LifeTextureCache } from "./life-sprites.ts";
import { LifeWalkerManager } from "./life-walkers.ts";
import { LifeAmbientManager, type ViewportBounds } from "./life-ambient.ts";
import type { RoadTile, BuildingLayout, HouseLayout } from "./layout-types.ts";
import type { BuildingDoorInfo, HouseDoorInfo, Coord } from "./life-paths.ts";

export interface LifeSystemConfig {
  renderer: Renderer;
  entitiesLayer: Container;
  effectsLayer: Container;
}

export interface SetupCityOptions {
  seed: string | number;
  arcId: string;
  roads: RoadTile[];
  buildings?: BuildingLayout[];
  houses?: HouseLayout[];
  population?: number;
  smokeOrigins?: Coord[];
  sparkleOrigins?: Coord[];
  mapBounds?: ViewportBounds;
  allowMotion?: boolean;
  isNight?: boolean;
}

export class LifeSystem {
  public textures: LifeTextureCache;
  public walkerManager: LifeWalkerManager;
  public ambientManager: LifeAmbientManager;
  private allowMotion = true;

  constructor(config: LifeSystemConfig) {
    this.textures = new LifeTextureCache(config.renderer);
    this.walkerManager = new LifeWalkerManager(config.entitiesLayer, this.textures);
    this.ambientManager = new LifeAmbientManager(config.effectsLayer, this.textures);
  }

  public setupCity(options: SetupCityOptions): void {
    this.allowMotion = options.allowMotion ?? true;

    // Map building layouts to DoorInfo with stock heuristics
    const buildingDoorInfos: BuildingDoorInfo[] = (options.buildings ?? []).map((b) => ({
      id: b.id,
      tileX: b.tileX,
      tileY: b.tileY,
      open: b.open,
      ruined: b.ruined,
      // Open businesses that are not ruined have stock
      hasStock: b.open && !b.ruined,
    }));

    const houseDoorInfos: HouseDoorInfo[] = (options.houses ?? []).map((h) => ({
      id: h.id,
      tileX: h.tileX,
      tileY: h.tileY,
      level: h.level,
    }));

    // Setup walkers (retains state across rebuilds to prevent teleporting)
    this.walkerManager.setup({
      parentLayer: this.walkerManager["parentLayer"],
      lifeTextures: this.textures,
      roads: options.roads,
      buildings: buildingDoorInfos,
      houses: houseDoorInfos,
      population: options.population ?? 30,
      seed: options.seed,
      arcId: options.arcId,
      allowMotion: this.allowMotion,
      isNight: options.isNight,
    });

    // Default map bounds if not provided
    const bounds: ViewportBounds = options.mapBounds ?? {
      minX: -600,
      maxX: 600,
      minY: -300,
      maxY: 900,
    };

    // Setup ambient life (smoke puffs on forge/alchemy/houses >= lvl 2, and 5-9 birds)
    this.ambientManager.setup(
      options.smokeOrigins ?? [],
      bounds,
      options.seed,
      options.sparkleOrigins ?? [],
      this.allowMotion
    );
  }

  public update(dt: number, viewBounds?: ViewportBounds, reducedMotion = false): void {
    const isReduced = reducedMotion || !this.allowMotion;
    this.walkerManager.update(dt, viewBounds, isReduced);
    this.ambientManager.update(dt, viewBounds, isReduced);
  }

  public clear(): void {
    this.walkerManager.clear();
    this.ambientManager.clear();
  }

  public destroy(): void {
    this.walkerManager.destroy();
    this.ambientManager.destroy();
    this.textures.destroy();
  }
}
