/**
 * Isometric Scene Renderer built on PixiJS v8.
 * Assembles ground, roads, entities, ambient props, and handles interaction.
 * Delegates road-traffic and particle updates to IsoAnimationManager.
 */

import {
  Container,
  Sprite,
  Graphics,
  Text,
  TextStyle,
  type Application,
} from "pixi.js";
import { isoToScreen, depthSortKey, isClick, getTileVariant } from "./iso-math.ts";
import { IsoTextureManager } from "./sprites.ts";
import { IsoAnimationManager, generateActors } from "./animation.ts";
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
  private uiLayer = new Container();

  private textureManager: IsoTextureManager;
  private animManager: IsoAnimationManager;
  private currentLayout: CityLayout | null = null;
  private selectedIdx = 0;
  private callbacks: IsoSceneCallbacks;
  private allowMotion = true;
  private tickerRunning = false;
  private hoverBadge: Container | null = null;
  private selBadge: Container | null = null;

  constructor(private app: Application, callbacks: IsoSceneCallbacks = {}) {
    this.callbacks = callbacks;
    this.textureManager = new IsoTextureManager(app.renderer);
    this.root.addChild(
      this.groundLayer,
      this.roadLayer,
      this.zoneLayer,
      this.entitiesLayer,
      this.actorsLayer,
      this.effectsLayer,
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
    allowMotion: boolean
  ): void {
    this.currentLayout = layout;
    this.selectedIdx = selectedIdx;
    this.allowMotion = allowMotion;

    this.clearScene();
    const tm = this.textureManager;
    const waterSprites: Sprite[] = [];
    const trees: Sprite[] = [];
    const smokeOrigins: Array<{ x: number; y: number }> = [];
    const glowOrigins: Array<{ x: number; y: number }> = [];
    const bobSprites: Sprite[] = [];

    // 1. Ground tiles with deterministic shade variants
    for (let y = 0; y < terrain.size; y++) {
      for (let x = 0; x < terrain.size; x++) {
        const kind = terrain.tiles[y][x];
        const variant = getTileVariant(x, y, 3);
        const tex = tm.getTileTexture(kind, arcId, variant);
        const spr = new Sprite(tex);
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

    // 2. Road tiles with edge lines & corner/junction masks
    const roadSet = new Set<string>();
    for (const r of layout.roads) roadSet.add(`${r.x},${r.y}`);

    for (const r of layout.roads) {
      let mask = 0;
      if (roadSet.has(`${r.x},${r.y - 1}`)) mask |= 1; // North
      if (roadSet.has(`${r.x + 1},${r.y}`)) mask |= 2; // East
      if (roadSet.has(`${r.x},${r.y + 1}`)) mask |= 4; // South
      if (roadSet.has(`${r.x - 1},${r.y}`)) mask |= 8; // West

      const variant = getTileVariant(r.x, r.y, 2);
      const tex = tm.getTileTexture(r.isBridge ? "bridge" : "road", arcId, variant, mask);
      const spr = new Sprite(tex);
      const scr = isoToScreen(r.x, r.y);
      spr.position.set(scr.x, scr.y);
      spr.anchor.set(0.5, 0.44);
      spr.eventMode = "none";
      this.roadLayer.addChild(spr);
    }

    // 3. District Zone territory & halos
    this.drawDistrictHighlights(layout);

    // 4. Entities (Trees, Houses, Landmarks) sorted by isometric depth
    const entityDisplayList: Array<{ container: Container; depth: number }> = [];

    // Ambient Trees on forest tiles
    for (let y = 0; y < terrain.size; y++) {
      for (let x = 0; x < terrain.size; x++) {
        if (terrain.tiles[y][x] === "forest") {
          const treeType = getTileVariant(x, y, 3);
          const tex = tm.getTreeTexture(treeType, arcId);
          const spr = new Sprite(tex);
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

    // Residential Citizen Houses (4 deterministic variants)
    for (const h of layout.houses) {
      const variant = getTileVariant(h.tileX, h.tileY, 4);
      const tex = tm.getHouseTexture(variant, h.level, arcId);
      const spr = new Sprite(tex);
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

      // Flickering lit window on some houses (capped for cost)
      if (variant % 2 === 1 && glowOrigins.length < 24) {
        glowOrigins.push({ x: scr.x + 6, y: scr.y - 14 });
      }

      // Ambient chimney smoke on some higher level houses
      if (h.level >= 2 && variant % 2 === 0) {
        smokeOrigins.push({ x: scr.x + 6, y: scr.y - 28 });
      }
    }

    // Sector Landmark Buildings
    for (const b of layout.buildings) {
      const sec = layout.sectors.find((s) => s.idx === b.sectorIdx);
      const sectorKind = sec?.kind ?? "food";
      const tex = tm.getBuildingTexture(sectorKind, b.level, b.ruined, arcId);
      const spr = new Sprite(tex);
      const scr = isoToScreen(b.tileX, b.tileY);
      spr.position.set(scr.x, scr.y);
      spr.anchor.set(0.5, 0.85);

      if (sectorKind === "harbor" && !b.ruined) bobSprites.push(spr);

      const bContainer = new Container();
      bContainer.addChild(spr);
      bContainer.eventMode = "static";
      bContainer.cursor = "pointer";

      // Select ONLY on click without drag (>4px)
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

      // Chimney smoke emitters for open workshops
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

    // 5. Setup Life Animation (citizens & carts along roads, smoke, swaying trees)
    if (this.allowMotion) {
      const openCount = layout.buildings.filter((b) => b.open && !b.ruined).length;
      const actors = generateActors(
        layout.roads,
        layout.plaza,
        layout.buildings,
        layout.houses.length * 6,
        openCount
      );
      this.animManager.setup(actors, smokeOrigins, trees, waterSprites, arcId, glowOrigins, bobSprites);
    }

    // 6. Update Selection ring and badge
    this.updateSelection();

    // 7. Manage ticker
    if (this.allowMotion && !this.tickerRunning) {
      this.app.ticker.add(this.onTick);
      this.tickerRunning = true;
    } else if (!this.allowMotion && this.tickerRunning) {
      this.app.ticker.remove(this.onTick);
      this.tickerRunning = false;
    }
  }

  private drawDistrictHighlights(layout: CityLayout): void {
    this.zoneLayer.removeChildren();

    for (const sec of layout.sectors) {
      const isSelected = sec.idx === this.selectedIdx;
      const g = new Graphics();
      const scr = isoToScreen(sec.centerX, sec.centerY);

      // Territory boundary & radial halo
      g.ellipse(scr.x, scr.y, 44, 22).stroke({
        color: isSelected ? 0xe5b358 : 0x5a4c3b,
        width: isSelected ? 2.5 : 1,
        alpha: isSelected ? 0.95 : 0.4,
      });

      if (isSelected) {
        g.ellipse(scr.x, scr.y, 44, 22).fill({ color: 0xe5b358, alpha: 0.16 });
      }

      g.eventMode = "static";
      g.cursor = "pointer";

      let downPos = { x: 0, y: 0 };
      g.on("pointerdown", (e) => {
        downPos = { x: e.global.x, y: e.global.y };
      });
      g.on("pointerup", (e) => {
        const dx = e.global.x - downPos.x;
        const dy = e.global.y - downPos.y;
        if (isClick(dx, dy, 4)) {
          this.callbacks.onSelectSector?.(sec.idx);
        }
      });

      this.zoneLayer.addChild(g);
    }
  }

  public updateSelection(newIdx?: number): void {
    if (newIdx !== undefined) {
      this.selectedIdx = newIdx;
    }
    if (this.currentLayout) {
      this.drawDistrictHighlights(this.currentLayout);
      this.selBadge?.destroy({ children: true });
      this.selBadge = null;
      const b = this.currentLayout.buildings.find((x) => x.sectorIdx === this.selectedIdx);
      if (b) {
        const sec = this.currentLayout.sectors.find((s) => s.idx === b.sectorIdx);
        const scr = isoToScreen(b.tileX, b.tileY);
        this.selBadge = this.makeBadge(b, scr.x, scr.y, sec?.name ?? "District");
      }
    }
  }

  private showHoverLabel(
    b: BuildingLayout,
    x: number,
    y: number,
    sectorName: string
  ): void {
    this.hideHoverLabel();
    this.hoverBadge = this.makeBadge(b, x, y, sectorName);
  }

  private makeBadge(
    b: BuildingLayout,
    x: number,
    y: number,
    sectorName: string
  ): Container {
    const badge = new Container();
    const isRuined = b.ruined || !b.open;
    const style = new TextStyle({
      fontFamily: "monospace",
      fontSize: 10,
      fill: isRuined ? 0xf26868 : 0xf0e6d2,
      fontWeight: "bold",
    });
    const labelText = new Text({
      text: `${b.name} [${isRuined ? "Ruined" : "Open"}] • ${sectorName}`,
      style,
    });
    labelText.anchor.set(0.5, 1);
    labelText.position.set(0, -6);
    const pad = 6;
    const w = labelText.width + pad * 2;
    const h = labelText.height + pad;
    const bg = new Graphics()
      .rect(-w / 2, -h - 6, w, h)
      .fill({ color: 0x12100e, alpha: 0.92 })
      .stroke({ color: isRuined ? 0xf26868 : 0xe5b358, width: 1.2 });

    badge.addChild(bg, labelText);
    badge.position.set(x, y - 32);
    badge.eventMode = "none";
    this.uiLayer.addChild(badge);
    return badge;
  }

  private hideHoverLabel(): void {
    if (this.hoverBadge) {
      this.hoverBadge.destroy({ children: true });
      this.hoverBadge = null;
    }
  }

  private onTick = (): void => {
    if (this.allowMotion) this.animManager.update();
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
    this.animManager.clear();
  }

  public destroy(): void {
    if (this.tickerRunning) {
      this.app.ticker.remove(this.onTick);
      this.tickerRunning = false;
    }
    this.clearScene();
    this.animManager.destroy();
    this.textureManager.destroy();
    this.root.destroy({ children: true });
  }
}
