"use client";

export interface MapZoomControlsProps {
  zoomLabel: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onRecenter: () => void;
  className?: string;
}

export function MapZoomControls({
  zoomLabel,
  onZoomIn,
  onZoomOut,
  onFit,
  onRecenter,
  className = "",
}: MapZoomControlsProps) {
  return (
    <div
      role="toolbar"
      aria-label="Map camera controls"
      className={`flex items-center gap-1.5 bg-atlas-canvas/80 p-1 rounded border border-atlas-line text-xs font-mono shadow-sm ${className}`}
    >
      <button
        type="button"
        onClick={onZoomIn}
        aria-label="Zoom in"
        title="Zoom in"
        className="atlas-focus min-h-[32px] px-2.5 py-1 rounded bg-atlas-surface-raised hover:bg-atlas-line text-atlas-ink hover:text-atlas-gold transition-colors cursor-pointer"
      >
        +
      </button>
      <button
        type="button"
        onClick={onZoomOut}
        aria-label="Zoom out"
        title="Zoom out"
        className="atlas-focus min-h-[32px] px-2.5 py-1 rounded bg-atlas-surface-raised hover:bg-atlas-line text-atlas-ink hover:text-atlas-gold transition-colors cursor-pointer"
      >
        −
      </button>
      <button
        type="button"
        onClick={onFit}
        aria-label="Fit built city to view"
        title="Fit city in view"
        className="atlas-focus min-h-[32px] px-2.5 py-1 rounded bg-atlas-surface-raised hover:bg-atlas-line text-atlas-ink hover:text-atlas-gold transition-colors cursor-pointer"
      >
        Fit
      </button>
      <button
        type="button"
        onClick={onRecenter}
        aria-label="Recenter map view"
        title="Recenter map"
        className="atlas-focus min-h-[32px] px-2.5 py-1 rounded bg-atlas-surface-raised hover:bg-atlas-line text-atlas-ink hover:text-atlas-gold transition-colors cursor-pointer"
      >
        Recenter
      </button>
      <span className="text-[10px] text-atlas-ash px-1 select-none">
        {zoomLabel}%
      </span>
    </div>
  );
}
