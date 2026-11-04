/**
 * Isometric Scene Renderer built on PixiJS v8.
 * Assembles static textured sprite layers, handles interaction, and manages
 * subtle low-cost particle animation when motion is permitted.
 */

import {
  Container,
  Sprite,
  Graphics,
  Text,
  TextStyle,
  type Application,
} from "pixi.js";
import { isoToScreen, depthSortKey } from "./iso-math.ts";
import { IsoTextureManager } from "./sprites.ts";
import type { TerrainMap } from "./terrain.ts";
import type { CityLayout, BuildingLayout } from "./layout.ts";

export interface IsoSceneCallbacks {
  onSelectSector?: (sectorIdx: number) => void;
  onHoverBuilding?: (b: BuildingLayout | null) => void;
}

interface SmokeParticle {
  g: Graphics;
  baseX: number;
  baseY: number;
  age: number;
  maxAge: number;
  driftX: number;
}

export class IsoCityScene {
  public root: Container;
  private groundLayer: Container;
  private roadLayer: Container;
  private zoneLayer: Container;
  private entitiesLayer: Container;
  private effectsLayer: Container;
  private uiLayer: Container;

  private textureManager: IsoTextureManager;
  private currentLayout: CityLayout | null = null;
  private selectedIdx = 0;
  private callbacks: IsoSceneCallbacks;
  private allowMotion = true;

  // Animation state
  private smokeParticles: SmokeParticle[] = [];
  private tickerRunning = false;
  private shimmerTimer = 0;
  private waterSprites: Sprite[] = [];

  constructor(private app: Application, callbacks: IsoSceneCallbacks = {}) {
    this.callbacks = callbacks;
    this.textureManager = new IsoTextureManager(app.renderer);

    this.root = new Container();
    this.groundLayer = new Container();
    this.roadLayer = new Container();
    this.zoneLayer = new Container();
    this.entitiesLayer = new Container();
    this.effectsLayer = new Container();
    this.uiLayer = new Container();

    this.root.addChild(
      this.groundLayer,
      this.roadLayer,
      this.zoneLayer,
      this.entitiesLayer,
      this.effectsLayer,
      this.uiLayer
    );
  }

  /**
   * Sets camera pan and zoom scale.
   */
  public setCamera(x: number, y: number, zoom: number): void {
    this.root.position.set(x, y);
    this.root.scale.set(zoom);
  }

  /**
   * Builds or updates the scene from terrain, layout, and simulation state.
   */
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

    // Clear existing children
    this.clearScene();

    const tm = this.textureManager;

    // 1. Ground tiles
    for (let y = 0; y < terrain.size; y++) {
      for (let x = 0; x < terrain.size; x++) {
        const kind = terrain.tiles[y][x];
        const tex = tm.getTileTexture(kind, arcId);
        const spr = new Sprite(tex);
        const scr = isoToScreen(x, y);
        spr.position.set(scr.x, scr.y);
        spr.anchor.set(0.5, 0.44);
        spr.eventMode = "none";
        this.groundLayer.addChild(spr);
        if (kind === "water" && this.allowMotion) this.waterSprites.push(spr);
      }
    }

    // 2. Road & bridge tiles
    for (const r of layout.roads) {
      const tex = tm.getTileTexture(r.isBridge ? "bridge" : "road", arcId);
      const spr = new Sprite(tex);
      const scr = isoToScreen(r.x, r.y);
      spr.position.set(scr.x, scr.y);
      spr.anchor.set(0.5, 0.44);
      spr.eventMode = "none";
      this.roadLayer.addChild(spr);
    }

    // 3. District Zone boundaries and highlight rings
    this.drawDistrictHighlights(layout);

    // 4. Entities (Buildings & Houses)
    const entityDisplayList: Array<{ container: Container; depth: number }> = [];

    // Houses
    for (const h of layout.houses) {
      const tex = tm.getHouseTexture(h.level, arcId);
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
    }

    // Sector Buildings
    for (const b of layout.buildings) {
      const sec = layout.sectors.find((s) => s.idx === b.sectorIdx);
      const sectorKind = sec?.kind ?? "food";
      const tex = tm.getBuildingTexture(sectorKind, b.level, b.ruined, arcId);
      const spr = new Sprite(tex);
      const scr = isoToScreen(b.tileX, b.tileY);
      spr.position.set(scr.x, scr.y);
      spr.anchor.set(0.5, 0.85);

      const bContainer = new Container();
      bContainer.addChild(spr);

      // Make building interactive
      bContainer.eventMode = "static";
      bContainer.cursor = "pointer";

      bContainer.on("pointerdown", () => {
        this.callbacks.onSelectSector?.(b.sectorIdx);
      });

      bContainer.on("pointerenter", () => {
        this.callbacks.onHoverBuilding?.(b);
        this.showHoverLabel(b, scr.x, scr.y);
      });

      bContainer.on("pointerleave", () => {
        this.callbacks.onHoverBuilding?.(null);
        this.hideHoverLabel();
      });

      entityDisplayList.push({
        container: bContainer,
        depth: depthSortKey(b.tileX, b.tileY, 2),
      });

      // Prepare smoke emitters for open forge/workshop buildings
      if (b.open && !b.ruined && (sectorKind === "forge" || sectorKind === "ore")) {
        this.setupSmokeEmitter(scr.x, scr.y - 30);
      }
    }

    // Sort entities front to back
    entityDisplayList.sort((a, b) => a.depth - b.depth);
    for (const item of entityDisplayList) {
      this.entitiesLayer.addChild(item.container);
    }

    // 5. Update Selection ring
    this.updateSelection();

    // 6. Manage animation ticker
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

      // Radial ground territory ring
      g.ellipse(scr.x, scr.y, 42, 21)
        .stroke({
          color: isSelected ? 0xe5b358 : 0x5a4c3b,
          width: isSelected ? 2.5 : 1,
          alpha: isSelected ? 0.9 : 0.4,
        });

      if (isSelected) {
        g.ellipse(scr.x, scr.y, 42, 21).fill({ color: 0xe5b358, alpha: 0.12 });
      }

      g.eventMode = "static";
      g.cursor = "pointer";
      g.on("pointerdown", () => this.callbacks.onSelectSector?.(sec.idx));
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
        const scr = isoToScreen(b.tileX, b.tileY);
        this.selBadge = this.makeBadge(b, scr.x, scr.y);
      }
    }
  }

  private hoverBadge: Container | null = null;

  private selBadge: Container | null = null;

  private showHoverLabel(b: BuildingLayout, x: number, y: number): void {
    this.hideHoverLabel();
    this.hoverBadge = this.makeBadge(b, x, y);
  }

  private makeBadge(b: BuildingLayout, x: number, y: number): Container {
    const badge = new Container();
    const style = new TextStyle({
      fontFamily: "monospace",
      fontSize: 10,
      fill: b.ruined ? 0xf26868 : 0xf0e6d2,
      fontWeight: "bold",
    });

    const labelText = new Text({
      text: `${b.name} [${b.ruined ? "Ruined" : "Open"}]`,
      style,
    });
    labelText.anchor.set(0.5, 1);
    labelText.position.set(0, -6);

    const bg = new Graphics();
    const pad = 4;
    const w = labelText.width + pad * 2;
    const h = labelText.height + pad;
    bg.rect(-w / 2, -h - 6, w, h)
      .fill({ color: 0x12100e, alpha: 0.85 })
      .stroke({ color: b.ruined ? 0xf26868 : 0xe5b358, width: 1 });

    badge.addChild(bg, labelText);
    badge.position.set(x, y - 28);
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

  private setupSmokeEmitter(x: number, y: number): void {
    if (!this.allowMotion) return;
    for (let i = 0; i < 2; i++) {
      const g = new Graphics().circle(0, 0, 2).fill({ color: 0xbda88e, alpha: 0.5 });
      g.position.set(x, y);
      this.effectsLayer.addChild(g);
      this.smokeParticles.push({
        g,
        baseX: x,
        baseY: y,
        age: i * 30,
        maxAge: 70,
        driftX: (i % 2 === 0 ? 0.3 : -0.2),
      });
    }
  }

  private onTick = (): void => {
    if (!this.allowMotion) return;
    this.shimmerTimer += 0.05;

    // Gentle water shimmer: per-tile alpha wave, no redraw
    for (let i = 0; i < this.waterSprites.length; i++) {
      this.waterSprites[i].alpha = 0.9 + 0.1 * Math.sin(this.shimmerTimer + i * 0.7);
    }

    // Animate smoke particles
    for (const p of this.smokeParticles) {
      p.age += 1;
      if (p.age >= p.maxAge) {
        p.age = 0;
        p.g.position.set(p.baseX, p.baseY);
        p.g.alpha = 0.5;
      } else {
        const progress = p.age / p.maxAge;
        p.g.y -= 0.4;
        p.g.x += p.driftX;
        p.g.alpha = (1 - progress) * 0.5;
        p.g.scale.set(1 + progress * 1.5);
      }
    }
  };

  private clearScene(): void {
    this.groundLayer.removeChildren();
    this.roadLayer.removeChildren();
    this.zoneLayer.removeChildren();
    this.entitiesLayer.removeChildren();
    this.effectsLayer.removeChildren();
    for (const child of this.uiLayer.removeChildren()) child.destroy({ children: true });
    this.hoverBadge = null;
    this.selBadge = null;
    this.waterSprites = [];
    this.smokeParticles = [];
  }

  public destroy(): void {
    if (this.tickerRunning) {
      this.app.ticker.remove(this.onTick);
      this.tickerRunning = false;
    }
    this.clearScene();
    this.textureManager.destroy();
    this.root.destroy({ children: true });
  }
}
