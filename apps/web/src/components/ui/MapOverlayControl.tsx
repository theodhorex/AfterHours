"use client";

import { useMemo } from "react";
import {
  type OverlayMode,
  type BadgeShape,
  getOverlayLegends,
} from "../../lib/city-report.ts";

export interface MapOverlayControlProps {
  mode: OverlayMode;
  onChangeMode: (mode: OverlayMode) => void;
  className?: string;
}

const MODES: Array<{ id: OverlayMode; label: string }> = [
  { id: "normal", label: "Normal" },
  { id: "prosperity", label: "Prosperity" },
  { id: "contentment", label: "Contentment" },
  { id: "activity", label: "Activity" },
];

function renderShapeGlyph(shape: BadgeShape) {
  switch (shape) {
    case "circle":
      return "●";
    case "square":
      return "■";
    case "diamond":
      return "◆";
    case "triangle":
      return "▲";
  }
}

export function MapOverlayControl({
  mode,
  onChangeMode,
  className = "",
}: MapOverlayControlProps) {
  const legends = useMemo(() => getOverlayLegends(mode), [mode]);

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Segmented Control Switch */}
      <div
        role="group"
        aria-label="Map perspective overlay mode"
        className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xs border border-ledger-brass/40 bg-ledger-paper/95 text-ledger-ink font-mono text-xs shadow-md backdrop-blur-xs"
      >
        <span className="font-silk text-[10px] uppercase tracking-wider text-ledger-ink-faded px-2 py-1 select-none">
          Overlay:
        </span>
        {MODES.map((m) => {
          const isActive = m.id === mode;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onChangeMode(m.id)}
              aria-pressed={isActive}
              className={`min-h-[44px] sm:min-h-[32px] px-3 py-1 rounded-xs font-semibold text-xs transition-all cursor-pointer ${
                isActive
                  ? "bg-ledger-brass text-ledger-paper shadow-xs"
                  : "text-ledger-ink hover:bg-ledger-paper-shade/60 text-ledger-ink-faded hover:text-ledger-ink"
              } focus-visible:outline-2 focus-visible:outline-ledger-brass`}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      {/* Legend with text & shape+color (Replacing old under-map legend) */}
      <div
        role="region"
        aria-label={`${mode} overlay legend`}
        className="flex flex-wrap items-center gap-x-4 gap-y-1.5 p-2 rounded-xs border border-ledger-ink-faded/25 bg-ledger-paper/90 text-ledger-ink font-mono text-[11px] shadow-xs"
      >
        <span className="font-silk text-[10px] uppercase tracking-wider text-ledger-ink-faded select-none">
          Legend:
        </span>
        {legends.map((item, idx) => (
          <span key={idx} className="flex items-center gap-1.5">
            <span
              style={{ color: item.color }}
              className="text-xs leading-none"
              aria-hidden="true"
            >
              {renderShapeGlyph(item.shape)}
            </span>
            <span className="text-ledger-ink">{item.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
