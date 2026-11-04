/**
 * UI Badges and District territorial halos for PixiJS v8 isometric scene.
 */

import { Container, Graphics, Text, TextStyle } from "pixi.js";
import { isoToScreen, isClick } from "./iso-math.ts";
import type { CityLayout, BuildingLayout } from "./layout.ts";
import type { IsoSceneCallbacks } from "./render.ts";

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
