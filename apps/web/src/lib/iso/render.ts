/**
 * Isometric Scene Renderer built on PixiJS v8 with pixel-sharp nearest-neighbour rendering.
 * Applies per-arc and per-season themes, weather particle layer, 1px dark outlines,
 * roundPixels on sprites, and smooth season tint/weather transitions.
 */

import {
  Container,
  Sprite,
  type Application,
} from "pixi.js";
import { isoToScreen, depthSortKey, isClick, getTileVariant } from "./iso-math.ts";
import { IsoTextureManager } from "./sprites.ts";
import { IsoAnimationManager, generateActors } from "./animation.ts";
import { IsoWeatherManager } from "./weather.ts";
import { getTheme, type ThemeTokens } from "./theme.ts";
import { drawDistrictHighlights, makeBuildingBadge, BubblePoolManager } from "./render-ui.ts";
import type { Bubble } from "./bubbles.ts";
import type { TerrainMap } from "./terrain.ts";
import type { CityLayout, BuildingLayout } from "./layout.ts";

export interface IsoSceneCallbacks {
  onSelectSector?: (sectorIdx: number) => void;
  onHoverBuilding?: (b: BuildingLayout | null) => void;
}

export class IsoCityScene {
  public root = new Container();
  private groundLayer = new Container();
  private roadLayer = new Container();
  private zoneLayer = new Container();
  private entitiesLayer = new Container();
  private actorsLayer = new Container();
  private effectsLayer = new Container();
  private weatherManager = new IsoWeatherManager();
  private bubbleManager: BubblePoolManager;
  private uiLayer = new Container();

  private textureManager: IsoTextureManager;
  private animManager: IsoAnimationManager;
  private currentTerrain: TerrainMap | null = null;
  private currentLayout: CityLayout | null = null;
  private currentArcId = "";
  private currentSeason = 0;
  private currentTheme: ThemeTokens | null = null;
  private selectedIdx = 0;
  private callbacks: IsoSceneCallbacks;
  private allowMotion = true;
  private tickerRunning = false;
  private hoverBadge: Container | null = null;
  private selBadge: Container | null = null;

  constructor(private app: Application, callbacks: IsoSceneCallbacks = {}) {
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
      this.bubbleManager.layer,
      this.weatherManager.layer,
      this.uiLayer
    );
    this.animManager = new IsoAnimationManager(
      this.actorsLayer,
      this.effectsLayer,
      this.textureManager
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
    bubbles: Bubble[] = []
  ): void {
    // If only season changed on the exact same layout and arc, swap tints and weather smoothly
    if (
      this.currentTerrain === terrain &&
      this.currentLayout === layout &&
      this.currentArcId === arcId &&
      this.currentSeason !== season
    ) {
      this.setSeason(season, allowMotion, bubbles);
      this.updateSelection(selectedIdx);
      return;
    }

    this.currentTerrain = terrain;
    this.currentLayout = layout;
    this.currentArcId = arcId;
    this.currentSeason = season;
    this.selectedIdx = selectedIdx;
    this.allowMotion = allowMotion;

    const theme = getTheme(arcId, season);
    this.currentTheme = theme;
    this.root.tint = theme.ambientTint;

    this.clearScene();
    const tm = this.textureManager;
    const waterSprites: Sprite[] = [];
    const trees: Sprite[] = [];
    const smokeOrigins: Array<{ x: number; y: number }> = [];
    const glowOrigins: Array<{ x: number; y: number }> = [];
    const bobSprites: Sprite[] = [];

    // 1. Ground tiles with nearest-neighbour scaling and roundPixels
    for (let y = 0; y < terrain.size; y++) {
      for (let x = 0; x < terrain.size; x++) {
        const kind = terrain.tiles[y][x];
        const variant = getTileVariant(x, y, 3);
        const tex = tm.getTileTexture(kind, arcId, variant, 0, season);
        const spr = new Sprite(tex);
        spr.roundPixels = true;
        const scr = isoToScreen(x, y);
        spr.position.set(scr.x, scr.y);
        spr.anchor.set(0.5, 0.44);
        spr.eventMode = "none";
        this.groundLayer.addChild(spr);

        if (kind === "water" && this.allowMotion) {
          waterSprites.push(spr);
        }
      }
    }

    // 2. Road tiles with edge lines & connection masks
    const roadSet = new Set<string>();
    for (const r of layout.roads) roadSet.add(`${r.x},${r.y}`);

    for (const r of layout.roads) {
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

    // Ambient Trees on forest tiles (giant mushrooms for goblin warrens, etc.)
    for (let y = 0; y < terrain.size; y++) {
      for (let x = 0; x < terrain.size; x++) {
        if (terrain.tiles[y][x] === "forest") {
          const treeType = getTileVariant(x, y, 3);
          const tex = tm.getTreeTexture(treeType, arcId, season);
          const spr = new Sprite(tex);
          spr.roundPixels = true;
          const scr = isoToScreen(x, y);
          spr.position.set(scr.x, scr.y);
          spr.anchor.set(0.5, 0.88);
          spr.eventMode = "none";
          trees.push(spr);

          entityDisplayList.push({
            container: spr,
            depth: depthSortKey(x, y, 0),
          });
        }
      }
    }

    // Roadside trees from the layout (arc-themed tree texture)
    for (const pr of layout.props ?? []) {
      const tex = tm.getTreeTexture(getTileVariant(pr.tileX, pr.tileY, 3), arcId, season);
      const spr = new Sprite(tex);
      spr.roundPixels = true;
      const scr = isoToScreen(pr.tileX, pr.tileY);
      spr.position.set(scr.x, scr.y);
      spr.anchor.set(0.5, 0.88);
      spr.eventMode = "none";
      trees.push(spr);
      entityDisplayList.push({ container: spr, depth: depthSortKey(pr.tileX, pr.tileY, 0) });
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
      const sec = layout.sectors.find((s) => s.idx === b.sectorIdx);
      const sectorKind = sec?.kind ?? "food";
      const tex = tm.getBuildingTexture(sectorKind, b.level, b.ruined, arcId, season);
      const spr = new Sprite(tex);
      spr.roundPixels = true;
      const scr = isoToScreen(b.tileX, b.tileY);
      spr.position.set(scr.x, scr.y);
      spr.anchor.set(0.5, 0.85);

      if (sectorKind === "harbor" && !b.ruined) bobSprites.push(spr);

      const bContainer = new Container();
      bContainer.addChild(spr);
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
        }
      });

      bContainer.on("pointerenter", () => {
        this.callbacks.onHoverBuilding?.(b);
        this.showHoverLabel(b, scr.x, scr.y, sec?.name ?? "District");
      });

      bContainer.on("pointerleave", () => {
        this.callbacks.onHoverBuilding?.(null);
        this.hideHoverLabel();
      });

      entityDisplayList.push({
        container: bContainer,
        depth: depthSortKey(b.tileX, b.tileY, 2),
      });

      if (b.open && !b.ruined) {
        if (sectorKind === "forge" || sectorKind === "ore") {
          smokeOrigins.push({ x: scr.x + 10, y: scr.y - 38 });
        } else if (sectorKind === "alchemy") {
          smokeOrigins.push({ x: scr.x, y: scr.y - 42 });
        }
      }
    }

    // Sort entities front-to-back
    entityDisplayList.sort((a, b) => a.depth - b.depth);
    for (const item of entityDisplayList) {
      this.entitiesLayer.addChild(item.container);
    }

    // 5. Setup Weather Particle Layer (pooled, max 80, disabled with reduced motion)
    this.weatherManager.setWeather(theme.weather, theme, this.allowMotion);

    // 6. Setup Life Animation (smoke, glows, trees, traffic)
    if (this.allowMotion) {
      const openCount = layout.buildings.filter((b) => b.open && !b.ruined).length;
      const actors = generateActors(
        layout.roads,
        layout.plaza,
        layout.buildings,
        layout.houses.length * 6,
        openCount
      );
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
        theme.windowGlowLevel
      );
    }

    // 7. Update Selection ring and badge
    this.updateSelection();

    // 7b. Update pooled speech bubbles
    this.bubbleManager.update(bubbles, layout);

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
    this.root.tint = theme.ambientTint;
    this.weatherManager.setWeather(theme.weather, theme, allowMotion);
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
    if (this.allowMotion) {
      this.animManager.update();
      this.weatherManager.update();
      this.bubbleManager.tick(this.allowMotion);
    }
  };

  private clearScene(): void {
    this.groundLayer.removeChildren();
    this.roadLayer.removeChildren();
    this.zoneLayer.removeChildren();
    this.entitiesLayer.removeChildren();
    this.actorsLayer.removeChildren();
    this.effectsLayer.removeChildren();
    for (const child of this.uiLayer.removeChildren()) child.destroy({ children: true });
    this.hoverBadge = null;
    this.selBadge = null;
    this.bubbleManager.clear();
    this.animManager.clear();
    this.weatherManager.clear();
  }

  public destroy(): void {
    if (this.tickerRunning) {
      this.app.ticker.remove(this.onTick);
      this.tickerRunning = false;
    }
    this.clearScene();
    this.bubbleManager.destroy();
    this.animManager.destroy();
    this.weatherManager.destroy();
    this.textureManager.destroy();
    this.root.destroy({ children: true });
  }
}
