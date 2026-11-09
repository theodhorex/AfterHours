/**
 * Isometric Scene Renderer built on PixiJS v8 with pixel-sharp nearest-neighbour rendering.
 * Applies per-arc and per-season themes, weather particle layer, 1px dark outlines,
 * roundPixels on sprites, and smooth season tint/weather transitions.
 */

import {
  Container,
  Sprite,
  Graphics,
  Texture,
  type Application,
} from "pixi.js";
import { bakeGround } from "./ground-bake.ts";
import { isoToScreen, depthSortKey, isClick, getTileVariant, getMapScreenBounds } from "./iso-math.ts";
import { IsoTextureManager } from "./sprites.ts";
import { IsoAnimationManager, generateActors } from "./animation.ts";
import { IsoLightSystem } from "./light-system.ts";
import { IsoWeatherSystem } from "./weather-system.ts";
import { getLightTint } from "./light-curve.ts";
import { getTheme, type ThemeTokens } from "./theme.ts";
import { drawDistrictHighlights, makeBuildingBadge, BubblePoolManager } from "./render-ui.ts";
import { getReducedMotion } from "../a11y/reduced-motion.ts";
import type { Bubble } from "./bubbles.ts";
import type { TerrainMap } from "./terrain.ts";
import type { CityLayout, BuildingLayout, HouseLayout } from "./layout.ts";
import type { CityView } from "../sim-view.ts";
import { getOverlayBadge, type OverlayMode } from "../city-report.ts";
import { computeGrowthView, type GrowthViewResult } from "./growth-view.ts";
import { getCenturyMonumentSpec } from "./growth-render-pure.ts";
import { drawCenturyMonument } from "./monument.ts";

export interface IsoSceneCallbacks {
  onSelectSector?: (sectorIdx: number) => void;
  onHoverBuilding?: (b: BuildingLayout | null, screenPos?: { x: number; y: number }) => void;
  onSelectBuilding?: (b: BuildingLayout, screenPos?: { x: number; y: number }) => void;
  onSelectHouse?: (h: HouseLayout, screenPos?: { x: number; y: number }) => void;
}

export interface TreePlacement {
  tileX: number;
  tileY: number;
  treeType: number;
}

/**
 * Builds the set of tiles occupied by roads, sidewalks, plaza, buildings, houses, and stalls.
 */
export function buildOccupiedTileSet(layout: CityLayout): Set<string> {
  const occupied = new Set<string>();
  for (const r of layout.roads) occupied.add(`${r.x},${r.y}`);
  for (const s of layout.sidewalks ?? []) occupied.add(`${s.x},${s.y}`);
  if (layout.plaza) occupied.add(`${layout.plaza.x},${layout.plaza.y}`);
  for (const b of layout.buildings) occupied.add(`${b.tileX},${b.tileY}`);
  for (const h of layout.houses) occupied.add(`${h.tileX},${h.tileY}`);
  for (const sb of layout.supportingBuildings ?? []) occupied.add(`${sb.tileX},${sb.tileY}`);
  for (const m of layout.marketStalls ?? []) occupied.add(`${m.tileX},${m.tileY}`);
  for (const rf of layout.ruralFeatures ?? []) occupied.add(`${rf.tileX},${rf.tileY}`);
  return occupied;
}

/**
 * Counts free grass/forest tiles that have no roads, buildings, houses, or infrastructure.
 */
export function countFreeGrassTiles(terrain: TerrainMap, layout: CityLayout): number {
  const occupied = buildOccupiedTileSet(layout);
  let count = 0;
  for (let y = 0; y < terrain.size; y++) {
    for (let x = 0; x < terrain.size; x++) {
      const t = terrain.tiles[y][x];
      if (t !== "water" && t !== "rock" && !occupied.has(`${x},${y}`)) {
        count++;
      }
    }
  }
  return count;
}

/**
 * Deterministically computes tree placements for the scene.
 * For elf_grove: density is strictly capped at at most ~1 in 6 free grass tiles (<= 0.2 ratio),
 * and strictly zero trees on roads, sidewalks, building plots, or footprints.
 */
export function getSceneTreePlacements(
  terrain: TerrainMap,
  layout: CityLayout,
  arcId: string,
  season = 0
): TreePlacement[] {
  void season;
  const occupied = buildOccupiedTileSet(layout);
  const freeGrassCount = countFreeGrassTiles(terrain, layout);
  const placements: TreePlacement[] = [];
  const placedSet = new Set<string>();

  if (arcId === "elf_grove") {
    const maxElfTrees = Math.floor(freeGrassCount / 6);

    for (let y = 0; y < terrain.size; y++) {
      for (let x = 0; x < terrain.size; x++) {
        if (placements.length >= maxElfTrees) break;
        const key = `${x},${y}`;
        if (occupied.has(key) || placedSet.has(key)) continue;

        if (terrain.tiles[y][x] !== "forest") continue;

        // Thinning via spatial hash: ~50% of free forest tiles, capped at 1 in 6 free grass tiles
        if ((((x * 73856093) ^ (y * 19349663)) >>> 0) % 2 === 0) {
          placedSet.add(key);
          placements.push({
            tileX: x,
            tileY: y,
            treeType: getTileVariant(x, y, 3),
          });
        }
      }
    }

    // Include roadside props if free and within cap
    for (const pr of layout.props ?? []) {
      if (placements.length >= maxElfTrees) break;
      const key = `${pr.tileX},${pr.tileY}`;
      if (!occupied.has(key) && !placedSet.has(key)) {
        placedSet.add(key);
        placements.push({
          tileX: pr.tileX,
          tileY: pr.tileY,
          treeType: getTileVariant(pr.tileX, pr.tileY, 3),
        });
      }
    }
  } else {
    // Other arcs: forest tiles and roadside props, excluding occupied tiles
    for (let y = 0; y < terrain.size; y++) {
      for (let x = 0; x < terrain.size; x++) {
        const key = `${x},${y}`;
        if (occupied.has(key) || placedSet.has(key)) continue;
        if (terrain.tiles[y][x] === "forest") {
          placedSet.add(key);
          placements.push({
            tileX: x,
            tileY: y,
            treeType: getTileVariant(x, y, 3),
          });
        }
      }
    }

    for (const pr of layout.props ?? []) {
      const key = `${pr.tileX},${pr.tileY}`;
      if (!occupied.has(key) && !placedSet.has(key)) {
        placedSet.add(key);
        placements.push({
          tileX: pr.tileX,
          tileY: pr.tileY,
          treeType: getTileVariant(pr.tileX, pr.tileY, 3),
        });
      }
    }
  }

  return placements;
}

export class IsoCityScene {
  public root = new Container();
  private groundLayer = new Container();
  private roadLayer = new Container();
  private zoneLayer = new Container();
  private entitiesLayer = new Container();
  private actorsLayer = new Container();
  private effectsLayer = new Container();
  private lightSystem = new IsoLightSystem();
  private weatherSystem = new IsoWeatherSystem();
  private bubbleManager: BubblePoolManager;
  private overlayLayer = new Container();
  private uiLayer = new Container();

  private textureManager: IsoTextureManager;
  private animManager: IsoAnimationManager;
  private currentTerrain: TerrainMap | null = null;
  private currentLayout: CityLayout | null = null;
  private currentGrowthView: GrowthViewResult | null = null;
  private currentArcId = "";
  private currentSeason = 0;
  private currentTheme: ThemeTokens | null = null;
  private currentCityView: CityView | null = null;
  private overlayMode: OverlayMode = "normal";
  private selectedIdx = 0;
  private app: Application;
  private callbacks: IsoSceneCallbacks;
  private allowMotion = true;
  private tickerRunning = false;
  private hoverBadge: Container | null = null;
  private selBadge: Container | null = null;
  private knownBuildingIds = new Set<string>();
  private popInTargets: Container[] = [];
  private groundSprite: Sprite | null = null;
  private groundCache = new WeakMap<TerrainMap, Map<string, Texture>>();
  private groundOrigin = { x: 0, y: 0 };

  private groundTexture(terrain: TerrainMap, theme: ThemeTokens, arcId: string, season: number): Texture {
    let perTerrain = this.groundCache.get(terrain);
    if (!perTerrain) {
      perTerrain = new Map();
      this.groundCache.set(terrain, perTerrain);
    }
    const key = `${arcId}|${season}`;
    let tex = perTerrain.get(key);
    if (!tex) {
      const baked = bakeGround(terrain, theme, arcId, season);
      this.groundOrigin = { x: baked.originX, y: baked.originY };
      tex = Texture.from(baked.canvas);
      tex.source.scaleMode = "nearest";
      perTerrain.set(key, tex);
      (tex as Texture & { __origin?: { x: number; y: number } }).__origin = this.groundOrigin;
    }
    return tex;
  }

  private positionGround(arcId: string, terrain: TerrainMap): void {
    void arcId;
    void terrain;
    const spr = this.groundSprite;
    if (!spr) return;
    const origin = (spr.texture as Texture & { __origin?: { x: number; y: number } }).__origin ?? this.groundOrigin;
    spr.position.set(origin.x, origin.y);
  }

  constructor(app: Application, callbacks: IsoSceneCallbacks = {}) {
    this.app = app;
    this.callbacks = callbacks;
    this.textureManager = new IsoTextureManager(app.renderer);
    this.bubbleManager = new BubblePoolManager(app.renderer, this.callbacks);
    this.root.addChild(
      this.groundLayer,
      this.roadLayer,
      this.zoneLayer,
      this.entitiesLayer,
      this.actorsLayer,
      this.effectsLayer,
      this.lightSystem.layer,
      this.bubbleManager.layer,
      this.overlayLayer,
      this.uiLayer
    );
    this.animManager = new IsoAnimationManager(
      this.actorsLayer,
      this.effectsLayer,
      this.textureManager,
      app.renderer,
      this.entitiesLayer
    );
  }

  public setCamera(x: number, y: number, zoom: number): void {
    this.root.position.set(x, y);
    this.root.scale.set(zoom);
  }

  public buildScene(
    terrain: TerrainMap,
    layout: CityLayout,
    arcId: string,
    selectedIdx: number,
    allowMotion: boolean,
    season = 0,
    bubbles: Bubble[] = [],
    growthView?: GrowthViewResult,
    overlayMode: OverlayMode = "normal",
    cityView?: CityView
  ): void {
    if (overlayMode) this.overlayMode = overlayMode;
    if (cityView) this.currentCityView = cityView;
    // If only season changed on the exact same layout and arc and growthView, swap tints and weather smoothly
    if (
      this.currentTerrain === terrain &&
      this.currentLayout === layout &&
      this.currentArcId === arcId &&
      this.currentGrowthView === growthView &&
      this.currentSeason !== season
    ) {
      this.setSeason(season, allowMotion, bubbles);
      this.updateSelection(selectedIdx);
      return;
    }

    this.currentTerrain = terrain;
    this.currentLayout = layout;
    this.currentGrowthView = growthView ?? null;
    this.currentArcId = arcId;
    this.currentSeason = season;
    this.selectedIdx = selectedIdx;
    this.allowMotion = allowMotion;

    const theme = getTheme(arcId, season);
    this.currentTheme = theme;
    this.root.tint = getLightTint(this.lightSystem.timeT, theme.ambientTint);
    this.lightSystem.setLayout(layout);

    this.clearScene();
    const tm = this.textureManager;
    const waterSprites: Sprite[] = [];
    const trees: Sprite[] = [];
    const smokeOrigins: Array<{ x: number; y: number }> = [];
    const glowOrigins: Array<{ x: number; y: number }> = [];
    const bobSprites: Sprite[] = [];

    const gv = growthView ?? computeGrowthView({
      arcId,
      year: 0,
      population: layout.houses.length * 6,
      businesses: layout.buildings.map((b) => ({ id: b.id, sectorIdx: b.sectorIdx, open: b.open, insolvent: b.ruined })),
      roads: layout.roads,
      buildings: layout.buildings,
      houses: layout.houses,
      plaza: layout.plaza,
    });

    // 1. Ground: one baked pixel-art texture for the whole terrain (cached per terrain, arc, season)
    this.groundSprite = new Sprite(this.groundTexture(terrain, theme, arcId, season));
    this.groundSprite.roundPixels = true;
    this.groundSprite.eventMode = "none";
    this.positionGround(arcId, terrain);
    this.groundLayer.addChild(this.groundSprite);
    void waterSprites;

    // 2. Road tiles with edge lines & connection masks (growing from center outward)
    const roadsToDraw = gv.builtRoads;
    const roadSet = new Set<string>();
    for (const r of roadsToDraw) roadSet.add(`${r.x},${r.y}`);

    for (const r of roadsToDraw) {
      let mask = 0;
      if (roadSet.has(`${r.x},${r.y - 1}`)) mask |= 1;
      if (roadSet.has(`${r.x + 1},${r.y}`)) mask |= 2;
      if (roadSet.has(`${r.x},${r.y + 1}`)) mask |= 4;
      if (roadSet.has(`${r.x - 1},${r.y}`)) mask |= 8;

      const variant = getTileVariant(r.x, r.y, 2);
      const tex = tm.getTileTexture(r.isBridge ? "bridge" : "road", arcId, variant, mask, season);
      const spr = new Sprite(tex);
      spr.roundPixels = true;
      const scr = isoToScreen(r.x, r.y);
      spr.position.set(scr.x, scr.y);
      spr.anchor.set(0.5, 0.44);
      spr.eventMode = "none";
      this.roadLayer.addChild(spr);
    }

    // 3. District Zone territory & halos
    drawDistrictHighlights(this.zoneLayer, layout, this.selectedIdx, this.callbacks);

    // 4. Entities (Trees, Houses, Landmarks) sorted by depth
    const entityDisplayList: Array<{ container: Container; depth: number }> = [];

    // Ambient & roadside trees (density-capped, arc-themed, sort-mixed, no collisions)
    const treePlacements = getSceneTreePlacements(terrain, layout, arcId, season);
    for (const tp of treePlacements) {
      const tex = tm.getTreeTexture(tp.treeType, arcId, season);
      const spr = new Sprite(tex);
      spr.roundPixels = true;
      const scr = isoToScreen(tp.tileX, tp.tileY);
      spr.position.set(scr.x, scr.y);
      spr.anchor.set(0.5, 0.88);
      spr.eventMode = "none";
      trees.push(spr);

      entityDisplayList.push({
        container: spr,
        depth: depthSortKey(tp.tileX, tp.tileY, 0),
      });
    }

    // Residential Citizen Houses (mushroom-cap cottages & cave huts for goblins)
    for (const h of layout.houses) {
      const variant = getTileVariant(h.tileX, h.tileY, 4);
      const tex = tm.getHouseTexture(variant, h.level, arcId, season);
      const spr = new Sprite(tex);
      spr.roundPixels = true;
      const scr = isoToScreen(h.tileX, h.tileY);
      spr.position.set(scr.x, scr.y);
      spr.anchor.set(0.5, 0.85);
      spr.eventMode = "none";

      const c = new Container();
      c.addChild(spr);
      c.eventMode = "static";
      c.cursor = "pointer";

      let hDownPos = { x: 0, y: 0 };
      c.on("pointerdown", (e) => {
        hDownPos = { x: e.global.x, y: e.global.y };
      });
      c.on("pointerup", (e) => {
        const dx = e.global.x - hDownPos.x;
        const dy = e.global.y - hDownPos.y;
        if (isClick(dx, dy, 4)) {
          this.callbacks.onSelectHouse?.(h, { x: scr.x, y: scr.y });
        }
      });
      c.on("pointerenter", () => {
        spr.position.y -= 2;
      });
      c.on("pointerleave", () => {
        spr.position.y += 2;
      });

      entityDisplayList.push({
        container: c,
        depth: depthSortKey(h.tileX, h.tileY, 1),
      });

      if (variant % 2 === 1 && glowOrigins.length < 24) {
        glowOrigins.push({ x: scr.x + 6, y: scr.y - 14 });
      }

      if (h.level >= 2 && variant % 2 === 0) {
        smokeOrigins.push({ x: scr.x + 6, y: scr.y - 28 });
      }
    }

    // Sector Landmark Buildings
    for (const b of layout.buildings) {
      const slot = gv.buildingSlots.find((s) => s.id === b.id);
      const bLevel = slot ? slot.level : b.level;
      const bOpen = slot ? slot.open : b.open;
      const bRuined = slot ? slot.ruined : b.ruined;
      const sec = layout.sectors.find((s) => s.idx === b.sectorIdx);
      const sectorKind = sec?.kind ?? "food";
      const tex = tm.getBuildingTexture(sectorKind, bLevel, bRuined, arcId, season);
      const spr = new Sprite(tex);
      spr.roundPixels = true;
      const scr = isoToScreen(b.tileX, b.tileY);
      spr.position.set(scr.x, scr.y);
      spr.anchor.set(0.5, 0.85);

      if (sectorKind === "harbor" && !bRuined) bobSprites.push(spr);

      const bContainer = new Container();
      bContainer.addChild(spr);

      if (this.allowMotion && !this.knownBuildingIds.has(b.id)) {
        bContainer.scale.set(0.1, 0.1);
        this.popInTargets.push(bContainer);
      }

      bContainer.eventMode = "static";
      bContainer.cursor = "pointer";

      let downPos = { x: 0, y: 0 };
      bContainer.on("pointerdown", (e) => {
        downPos = { x: e.global.x, y: e.global.y };
      });
      bContainer.on("pointerup", (e) => {
        const dx = e.global.x - downPos.x;
        const dy = e.global.y - downPos.y;
        if (isClick(dx, dy, 4)) {
          this.callbacks.onSelectSector?.(b.sectorIdx);
          this.callbacks.onSelectBuilding?.(b, { x: scr.x, y: scr.y });
        }
      });

      bContainer.on("pointerenter", () => {
        spr.position.y -= 2;
        this.callbacks.onHoverBuilding?.(b, { x: scr.x, y: scr.y });
        this.showHoverLabel(b, scr.x, scr.y, sec?.name ?? "District");
      });

      bContainer.on("pointerleave", () => {
        spr.position.y += 2;
        this.callbacks.onHoverBuilding?.(null);
        this.hideHoverLabel();
      });

      entityDisplayList.push({
        container: bContainer,
        depth: depthSortKey(b.tileX, b.tileY, 2),
      });

      if (bOpen && !bRuined) {
        if (sectorKind === "forge" || sectorKind === "ore") {
          smokeOrigins.push({ x: scr.x + 10, y: scr.y - 38 });
        } else if (sectorKind === "alchemy") {
          smokeOrigins.push({ x: scr.x, y: scr.y - 42 });
        }
      }
    }

    // Plaza Century Aging Monument (well -> cistern -> statue -> obelisk -> relic monolith)
    if (layout.plaza) {
      const monG = new Graphics();
      const monSpec = getCenturyMonumentSpec(gv.century, arcId);
      drawCenturyMonument(monG, monSpec);
      const pScr = isoToScreen(layout.plaza.x, layout.plaza.y);
      monG.position.set(pScr.x, pScr.y);

      entityDisplayList.push({
        container: monG,
        depth: depthSortKey(layout.plaza.x, layout.plaza.y, 1),
      });
    }

    // Sort entities front-to-back with depth sorting
    this.entitiesLayer.sortableChildren = true;
    entityDisplayList.sort((a, b) => a.depth - b.depth);
    for (const item of entityDisplayList) {
      item.container.zIndex = item.depth;
      this.entitiesLayer.addChild(item.container);
    }

    // 5. Setup Weather Particle Layer (pooled, max 120, disabled with reduced motion)
    this.weatherSystem.setSeason(season, this.allowMotion, this.lightSystem.timeT);

    // 6. Setup Life Animation (smoke, glows, trees, traffic)
    if (this.allowMotion) {
      const openCount = layout.buildings.filter((b) => {
        const slot = gv.buildingSlots.find((s) => s.id === b.id);
        return slot ? slot.open && !slot.ruined : b.open && !b.ruined;
      }).length;
      const actors = generateActors(
        roadsToDraw,
        layout.plaza,
        layout.buildings,
        gv.citizenCount * 6,
        openCount
      );
      const mapBounds = getMapScreenBounds(terrain.size, terrain.size);
      this.animManager.setup(
        actors,
        smokeOrigins,
        trees,
        waterSprites,
        arcId,
        glowOrigins,
        bobSprites,
        theme.building.chimneySmoke,
        theme.smokeThickness,
        theme.building.windowLit,
        theme.windowGlowLevel,
        {
          seed: this.currentCityView?.stateRoot ?? arcId,
          arcId,
          roads: roadsToDraw,
          buildings: layout.buildings,
          houses: layout.houses,
          population: gv.citizenCount * 6,
          smokeOrigins,
          sparkleOrigins: waterSprites.slice(0, 6).map((s) => ({ x: s.x, y: s.y })),
          mapBounds,
          allowMotion: this.allowMotion,
        }
      );
    }

    // 7. Update Selection ring and badge
    this.updateSelection();

    // 7b. Update pooled speech bubbles
    this.bubbleManager.update(bubbles, layout);

    // 7c. Record known buildings for future pop-ins
    this.knownBuildingIds = new Set(layout.buildings.map((b) => b.id));

    // 7d. Update overlay progress badges
    this.updateOverlayBadges(this.overlayMode, this.currentCityView);

    // 8. Manage ticker
    if (this.allowMotion && !this.tickerRunning) {
      this.app.ticker.add(this.onTick);
      this.tickerRunning = true;
    } else if (!this.allowMotion && this.tickerRunning) {
      this.app.ticker.remove(this.onTick);
      this.tickerRunning = false;
    }
  }

  public setSeason(season: number, allowMotion = this.allowMotion, bubbles?: Bubble[]): void {
    this.currentSeason = season;
    if (!this.currentArcId) return;
    const theme = getTheme(this.currentArcId, season);
    this.currentTheme = theme;
    this.root.tint = getLightTint(this.lightSystem.timeT, theme.ambientTint);
    if (this.groundSprite && this.currentTerrain) {
      this.groundSprite.texture = this.groundTexture(this.currentTerrain, theme, this.currentArcId, season);
      this.positionGround(this.currentArcId, this.currentTerrain);
    }
    this.weatherSystem.setSeason(season, allowMotion, this.lightSystem.timeT);
    if (bubbles && this.currentLayout) {
      this.bubbleManager.update(bubbles, this.currentLayout);
    }
  }

  public updateSelection(newIdx?: number): void {
    if (newIdx !== undefined) {
      this.selectedIdx = newIdx;
    }
    if (this.currentLayout) {
      drawDistrictHighlights(this.zoneLayer, this.currentLayout, this.selectedIdx, this.callbacks);
      this.selBadge?.destroy({ children: true });
      this.selBadge = null;
      const b = this.currentLayout.buildings.find((x) => x.sectorIdx === this.selectedIdx);
      if (b) {
        const sec = this.currentLayout.sectors.find((s) => s.idx === b.sectorIdx);
        const scr = isoToScreen(b.tileX, b.tileY);
        this.selBadge = makeBuildingBadge(b, scr.x, scr.y, sec?.name ?? "District");
        this.uiLayer.addChild(this.selBadge);
      }
    }
  }

  public setOverlayMode(mode: OverlayMode, cityView?: CityView): void {
    this.overlayMode = mode;
    if (cityView) this.currentCityView = cityView;
    this.updateOverlayBadges(mode, this.currentCityView);
  }

  public updateOverlayBadges(mode: OverlayMode, cityView?: CityView | null): void {
    this.overlayLayer.removeChildren();
    if (!this.currentLayout) return;

    for (const b of this.currentLayout.buildings) {
      const sector = cityView?.sectors?.find((s) => s.idx === b.sectorIdx);
      if (!sector) continue;
      const badge = getOverlayBadge(mode, sector);
      const scr = isoToScreen(b.tileX, b.tileY);
      const bx = scr.x;
      const by = scr.y - 48;
      const g = new Graphics();
      if (badge.shape === "circle") {
        g.circle(bx, by, 5.5).fill({ color: badge.color }).stroke({ color: 0x12100e, width: 1.5 });
      } else if (badge.shape === "square") {
        g.rect(bx - 4.5, by - 4.5, 9, 9).fill({ color: badge.color }).stroke({ color: 0x12100e, width: 1.5 });
      } else if (badge.shape === "diamond") {
        g.poly([bx, by - 6, bx + 6, by, bx, by + 6, bx - 6, by]).fill({ color: badge.color }).stroke({ color: 0x12100e, width: 1.5 });
      } else {
        g.poly([bx, by - 6, bx + 6, by + 4, bx - 6, by + 4]).fill({ color: badge.color }).stroke({ color: 0x12100e, width: 1.5 });
      }
      this.overlayLayer.addChild(g);
    }
  }

  private showHoverLabel(b: BuildingLayout, x: number, y: number, sectorName: string): void {
    this.hideHoverLabel();
    this.hoverBadge = makeBuildingBadge(b, x, y, sectorName);
    this.uiLayer.addChild(this.hoverBadge);
  }

  private hideHoverLabel(): void {
    if (this.hoverBadge) {
      this.hoverBadge.destroy({ children: true });
      this.hoverBadge = null;
    }
  }

  private onTick = (): void => {
    const isReduced = getReducedMotion() || !this.allowMotion;
    const dt = Math.min(0.1, (this.app.ticker.deltaMS || 16.6) / 1000);
    const baseAmbient = this.currentTheme?.ambientTint ?? 0xfffef6;

    if (this.allowMotion) {
      if (this.popInTargets.length > 0 && !isReduced) {
        for (let i = this.popInTargets.length - 1; i >= 0; i--) {
          const c = this.popInTargets[i];
          const next = c.scale.x + (1.0 - c.scale.x) * 0.25;
          if (next >= 0.98) {
            c.scale.set(1.0, 1.0);
            this.popInTargets.splice(i, 1);
          } else {
            c.scale.set(next, next);
          }
        }
      }
      this.lightSystem.update(dt, this.root, baseAmbient, undefined, !isReduced);
      // Weather lives in screen space (a sibling of the zoomed world) so drops and fog keep
      // a constant size and always fill the viewport instead of the whole map.
      const wl = this.weatherSystem.layer;
      if (wl.parent !== this.app.stage) this.app.stage.addChild(wl);
      const sw = this.app.screen.width;
      const sh = this.app.screen.height;
      this.weatherSystem.update(dt, this.lightSystem.timeT, { minX: 0, maxX: sw, minY: -20, maxY: sh }, !isReduced);
      this.animManager.update(dt, undefined, isReduced);
      this.bubbleManager.tick(!isReduced);
    } else {
      this.lightSystem.update(0, this.root, baseAmbient, undefined, false);
      this.weatherSystem.clear();
    }
  };

  private clearScene(): void {
    this.popInTargets = [];
    this.groundLayer.removeChildren();
    this.roadLayer.removeChildren();
    this.zoneLayer.removeChildren();
    this.entitiesLayer.removeChildren();
    this.actorsLayer.removeChildren();
    this.effectsLayer.removeChildren();
    this.overlayLayer.removeChildren();
    for (const child of this.uiLayer.removeChildren()) child.destroy({ children: true });
    this.hoverBadge = null;
    this.selBadge = null;
    this.bubbleManager.clear();
    this.animManager.clear();
  }

  public destroy(): void {
    if (this.tickerRunning) {
      this.app.ticker.remove(this.onTick);
      this.tickerRunning = false;
    }
    this.clearScene();
    this.bubbleManager.destroy();
    this.animManager.destroy();
    this.lightSystem.destroy();
    this.weatherSystem.destroy();
    this.textureManager.destroy();
    this.root.destroy({ children: true });
  }
}
