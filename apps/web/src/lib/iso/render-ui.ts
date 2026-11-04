/**
 * UI Badges and District territorial halos for PixiJS v8 isometric scene.
 */

import { Container, Graphics, Text, TextStyle, type Renderer, type Texture, Sprite, Rectangle } from "pixi.js";
import { isoToScreen, isClick } from "./iso-math.ts";
import type { CityLayout, BuildingLayout } from "./layout.ts";
import type { IsoSceneCallbacks } from "./render.ts";
import { type Bubble, type BubbleGlyph, BUBBLE_HIT_WIDTH, BUBBLE_HIT_HEIGHT } from "./bubbles.ts";

export function drawDistrictHighlights(
  zoneLayer: Container,
  layout: CityLayout,
  selectedIdx: number,
  callbacks: IsoSceneCallbacks
): void {
  zoneLayer.removeChildren();

  for (const sec of layout.sectors) {
    const isSelected = sec.idx === selectedIdx;
    const g = new Graphics();
    const scr = isoToScreen(sec.centerX, sec.centerY);

    // Territory boundary & radial halo covering the entire district (rx: 76, ry: 38)
    g.ellipse(scr.x, scr.y, 76, 38).stroke({
      color: isSelected ? 0xe5b358 : 0x5a4c3b,
      width: isSelected ? 3 : 1,
      alpha: isSelected ? 0.95 : 0.4,
    });

    if (isSelected) {
      g.ellipse(scr.x, scr.y, 76, 38).fill({ color: 0xe5b358, alpha: 0.18 });
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
        callbacks.onSelectSector?.(sec.idx);
      }
    });

    zoneLayer.addChild(g);
  }
}

export function makeBuildingBadge(
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
    .fill({ color: 0x12100e, alpha: 0.94 })
    .stroke({ color: isRuined ? 0xf26868 : 0xe5b358, width: 1.2 });

  badge.addChild(bg, labelText);
  badge.position.set(x, y - 36);
  badge.eventMode = "none";
  return badge;
}

/**
 * Draws pixel-art speech bubble scaled ~1.5x with subtle white halo,
 * clear 1px dark border, and readable glyphs inside.
 * Hit area is at least 24x24 screen px (scaled to 28x32px).
 */
export function drawBubbleGraphics(g: Graphics, glyph: BubbleGlyph): void {
  // 1. Subtle white halo for contrast against dark / saturated terrain
  g.poly([
    -15.5, -32.5,
    15.5, -32.5,
    15.5, -9,
    4.5, -9,
    0, -1,
    -3.5, -9,
    -15.5, -9,
  ]).fill({ color: 0xffffff, alpha: 0.45 });

  // 2. Main speech bubble base: ~28x21 box with pointer down to -2.5
  const outline = 0x16120e;
  const bubbleFill = 0xf5efe6; // Warm illuminated parchment

  g.poly([
    -14, -31,
    14, -31,
    14, -10,
    3.5, -10,
    0, -2.5,
    -2.5, -10,
    -14, -10,
  ])
    .fill({ color: bubbleFill })
    .stroke({ color: outline, width: 1 });

  // 3. Draw readable glyph inside bubble (center at x: 0, y: -20.5)
  if (glyph === "bread") {
    // Bread loaf: warm crust and crumb, 1.5x scaled
    g.ellipse(0, -20.5, 7.5, 4.5).fill({ color: 0xd97706 }).stroke({ color: 0x78350f, width: 1 });
    g.rect(-3.5, -22, 1.5, 3).fill({ color: 0xfef3c7 });
    g.rect(1.5, -22, 1.5, 3).fill({ color: 0xfef3c7 });
  } else if (glyph === "zzz") {
    // Zzz: deep slate bold readable typography
    const style = new TextStyle({
      fontFamily: "monospace",
      fontSize: 11,
      fontWeight: "bold",
      fill: 0x334155,
    });
    const zText = new Text({ text: "Zz", style });
    zText.anchor.set(0.5, 0.5);
    zText.position.set(0, -20.5);
    g.addChild(zText);
  } else if (glyph === "exclamation") {
    // Exclamation mark: vivid crimson/red
    g.rect(-1.5, -26.5, 3, 7.5).fill({ color: 0xdc2626 });
    g.circle(0, -15, 1.6).fill({ color: 0xdc2626 });
  } else if (glyph === "coin") {
    // Coin: gold coin with 1px rim and inner shine
    g.circle(0, -20.5, 6).fill({ color: 0xf59e0b }).stroke({ color: 0x92400e, width: 1 });
    g.circle(0, -20.5, 2.5).fill({ color: 0xfef08a });
  }
}

/**
 * Cache for speech bubble textures to avoid re-generating.
 */
export class BubbleTextureCache {
  private cache = new Map<BubbleGlyph, Texture>();
  private renderer: Renderer;

  constructor(renderer: Renderer) {
    this.renderer = renderer;
  }

  getTexture(glyph: BubbleGlyph): Texture {
    let tex = this.cache.get(glyph);
    if (!tex) {
      const g = new Graphics();
      drawBubbleGraphics(g, glyph);
      tex = this.renderer.generateTexture({
        target: g,
        textureSourceOptions: { scaleMode: "nearest" },
        antialias: false,
      });
      tex.source.scaleMode = "nearest";
      this.cache.set(glyph, tex);
      g.destroy();
    }
    return tex;
  }

  destroy(): void {
    for (const tex of this.cache.values()) {
      tex.destroy(true);
    }
    this.cache.clear();
  }
}

export interface PooledBubbleSprite {
  sprite: Sprite;
  baseX: number;
  baseY: number;
  phase: number;
  sectorIdx: number;
  active: boolean;
}

/**
 * Pre-allocated pool of 12 bubble sprites for zero-allocation rendering & bobbing.
 */
export class BubblePoolManager {
  public layer = new Container();
  private pool: PooledBubbleSprite[] = [];
  private tickCount = 0;
  private textureCache: BubbleTextureCache;
  private callbacks: IsoSceneCallbacks;

  constructor(renderer: Renderer, callbacks: IsoSceneCallbacks) {
    this.callbacks = callbacks;
    this.textureCache = new BubbleTextureCache(renderer);
    // Pre-allocate 12 sprites with >= 24x24 screen px hit area
    for (let i = 0; i < 12; i++) {
      const spr = new Sprite(this.textureCache.getTexture("coin"));
      spr.roundPixels = true;
      spr.anchor.set(0.5, 1);
      spr.hitArea = new Rectangle(-BUBBLE_HIT_WIDTH / 2, -32, BUBBLE_HIT_WIDTH, BUBBLE_HIT_HEIGHT + 4);
      spr.visible = false;
      spr.eventMode = "static";
      spr.cursor = "pointer";

      const item: PooledBubbleSprite = {
        sprite: spr,
        baseX: 0,
        baseY: 0,
        phase: i * 0.8,
        sectorIdx: 0,
        active: false,
      };

      let downPos = { x: 0, y: 0 };
      spr.on("pointerdown", (e) => {
        downPos = { x: e.global.x, y: e.global.y };
      });
      spr.on("pointerup", (e) => {
        const dx = e.global.x - downPos.x;
        const dy = e.global.y - downPos.y;
        if (isClick(dx, dy, 4) && item.active) {
          this.callbacks.onSelectSector?.(item.sectorIdx);
        }
      });

      this.pool.push(item);
      this.layer.addChild(spr);
    }
  }

  public update(bubbles: Bubble[], layout: CityLayout): void {
    for (let i = 0; i < 12; i++) {
      const item = this.pool[i];
      if (i < bubbles.length) {
        const b = bubbles[i];
        item.active = true;
        item.sectorIdx = b.sectorIdx;
        item.sprite.texture = this.textureCache.getTexture(b.glyph);

        // Find matching building or district center
        const building =
          layout.buildings.find((bld) =>
            b.buildingId ? bld.id === b.buildingId : bld.sectorIdx === b.sectorIdx
          ) ?? layout.buildings.find((bld) => bld.sectorIdx === b.sectorIdx);

        if (building) {
          const scr = isoToScreen(building.tileX, building.tileY);
          item.baseX = scr.x;
          item.baseY = scr.y - (34 + (building.level ?? 1) * 6);
        } else {
          const sec = layout.sectors.find((s) => s.idx === b.sectorIdx);
          const scr = isoToScreen(sec?.centerX ?? 0, sec?.centerY ?? 0);
          item.baseX = scr.x;
          item.baseY = scr.y - 32;
        }

        item.sprite.position.set(item.baseX, item.baseY);
        item.sprite.visible = true;
      } else {
        item.active = false;
        item.sprite.visible = false;
      }
    }
  }

  public tick(allowMotion: boolean): void {
    if (!allowMotion) return;
    this.tickCount++;
    for (const item of this.pool) {
      if (item.active && item.sprite.visible) {
        // Bobbing 1-2px
        const bob = Math.sin(this.tickCount * 0.08 + item.phase) * 1.5;
        item.sprite.y = item.baseY + bob;
      }
    }
  }

  public clear(): void {
    for (const item of this.pool) {
      item.active = false;
      item.sprite.visible = false;
    }
  }

  public destroy(): void {
    this.clear();
    this.textureCache.destroy();
    for (const item of this.pool) {
      item.sprite.destroy();
    }
    this.pool = [];
    this.layer.destroy({ children: true });
  }
}
