"use client";

import { useMemo } from "react";
import type { Sector } from "../../data/mock-city.ts";
import { calcBuildingHoverData, clampTooltipPosition, formatLevelLabel } from "../../lib/iso/inspect.ts";
import { formatCoin } from "../../lib/format.ts";

export interface MapHoverTooltipProps {
  sector: Sector;
  level: number;
  pointerPos: { x: number; y: number };
  containerBounds: { width: number; height: number };
}

export function MapHoverTooltip({
  sector,
  level,
  pointerPos,
  containerBounds,
}: MapHoverTooltipProps) {
  const data = useMemo(
    () => calcBuildingHoverData(sector, level),
    [sector, level]
  );

  const cardWidth = 190;
  const cardHeight = 90;

  const pos = useMemo(
    () =>
      clampTooltipPosition({
        pointerX: pointerPos.x,
        pointerY: pointerPos.y,
        cardWidth,
        cardHeight,
        viewportWidth: containerBounds.width,
        viewportHeight: containerBounds.height,
        offset: 14,
      }),
    [pointerPos.x, pointerPos.y, containerBounds.width, containerBounds.height]
  );

  return (
    <div
      role="tooltip"
      aria-hidden="true"
      style={{
        transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
        width: `${cardWidth}px`,
      }}
      className="absolute top-0 left-0 pointer-events-none z-30 p-2.5 rounded-xs border border-ledger-brass bg-ledger-paper/95 text-ledger-ink shadow-lg font-body text-xs space-y-1 backdrop-blur-xs animate-in fade-in-50 duration-75"
    >
      <div className="flex items-center justify-between font-mono text-[9px] text-ledger-ink-faded uppercase tracking-wider">
        <span className="font-silk font-bold text-ledger-ink">Sec {data.sectorIdx}</span>
        <span className="capitalize">{data.kind}</span>
      </div>
      <div className="font-display font-bold text-xs truncate text-ledger-ink leading-tight">
        {data.name}
      </div>
      <div className="font-mono text-[10px] text-ledger-ink-faded">
        {formatLevelLabel(data.level, data.kind)}
      </div>
      <div className="flex items-center justify-between font-mono text-[10px] pt-1 border-t border-ledger-ink-faded/20">
        <span className="text-ledger-verdigris font-semibold">{data.openCount} open</span>
        {data.insolventCount > 0 && (
          <span className="text-ledger-wax font-semibold">({data.insolventCount} insolv)</span>
        )}
        <span className="text-ledger-ink font-semibold ml-auto">{formatCoin(data.activeRevenue)}</span>
      </div>
    </div>
  );
}
