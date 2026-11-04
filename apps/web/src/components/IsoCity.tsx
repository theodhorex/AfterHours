"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Application } from "pixi.js";
import type { CityView } from "../lib/sim-view.ts";
import { generateTerrain } from "../lib/iso/terrain.ts";
import { layoutCity, type CityLayout } from "../lib/iso/layout.ts";
import { IsoCityScene } from "../lib/iso/render.ts";
import { calculateFitCamera } from "../lib/iso/iso-math.ts";
import { bubblesFor } from "../lib/iso/bubbles.ts";

export interface IsoCityProps {
  city: CityView;
  selectedIdx: number;
  onSelectSector: (idx: number) => void;
  seed?: string;
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3.0;

function clampZoom(z: number): number {
  const stepped = Math.round(z * 4) / 4; // integer-friendly 0.25 zoom steps
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, stepped));
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function IsoCity({
  city,
  selectedIdx,
  onSelectSector,
  seed = "goblin_seed_0",
}: IsoCityProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const sceneRef = useRef<IsoCityScene | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Camera lives in a ref: panning/zooming never triggers React renders or scene rebuilds.
  const camRef = useRef({ x: 0, y: 0, zoom: 1 });
  const dragRef = useRef<{ active: boolean; sx: number; sy: number; px: number; py: number }>({
    active: false, sx: 0, sy: 0, px: 0, py: 0,
  });
  const [zoomLabel, setZoomLabel] = useState(100);
  const [ready, setReady] = useState(false);

  // Latest props for long-lived Pixi callbacks and effects without re-initializing the app.
  const onSelectRef = useRef(onSelectSector);
  const selectedRef = useRef(selectedIdx);
  useEffect(() => {
    onSelectRef.current = onSelectSector;
    selectedRef.current = selectedIdx;
  }, [onSelectSector, selectedIdx]);

  const { totalOpen, totalClosed } = useMemo(() => {
    let open = 0;
    let closed = 0;
    for (const s of city.sectors) {
      for (const b of s.businesses) {
        if (b.open && b.insolvent_steps === 0) open++;
        else closed++;
      }
    }
    return { totalOpen: open, totalClosed: closed };
  }, [city.sectors]);

  const terrain = useMemo(() => generateTerrain(seed, city.arc_id, 40), [seed, city.arc_id]);
  const layout: CityLayout = useMemo(() => layoutCity(terrain, city), [terrain, city]);
  const layoutRef = useRef(layout);
  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  const builtPoints = useMemo(() => {
    return [
      layout.plaza,
      ...layout.buildings.map((b) => ({ x: b.tileX, y: b.tileY })),
      ...layout.houses.map((h) => ({ x: h.tileX, y: h.tileY })),
      ...layout.sectors.map((s) => ({ x: s.centerX, y: s.centerY })),
    ];
  }, [layout]);

  const applyCamera = useCallback((x: number, y: number, zoom: number) => {
    camRef.current = { x, y, zoom };
    sceneRef.current?.setCamera(x, y, zoom);
    setZoomLabel(Math.round(zoom * 100));
  }, []);

  const recenter = useCallback(() => {
    const el = containerRef.current;
    const w = el?.clientWidth ?? 960;
    const h = el?.clientHeight ?? 540;
    const cam = calculateFitCamera(builtPoints, {
      viewportWidth: w,
      viewportHeight: h,
      padding: Math.max(32, Math.min(w * 0.08, 64)),
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
    });
    applyCamera(cam.x, cam.y, cam.zoom);
  }, [builtPoints, applyCamera]);

  // Zoom around the viewport center
  const zoomBy = useCallback(
    (delta: number) => {
      const el = containerRef.current;
      if (!el) return;
      const { x, y, zoom } = camRef.current;
      const next = clampZoom(zoom + delta);
      const cx = el.clientWidth / 2;
      const cy = el.clientHeight / 2;
      const k = next / zoom;
      applyCamera(cx - (cx - x) * k, cy - (cy - y) * k, next);
    },
    [applyCamera]
  );

  // Create the Pixi app once; survives city updates. Handles React strict-mode double mount.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;
    let app: Application | null = null;
    let observer: ResizeObserver | null = null;
    let scene: IsoCityScene | null = null;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomBy(e.deltaY > 0 ? -0.25 : 0.25);
    };

    (async () => {
      const a = new Application();
      await a.init({
        width: Math.max(container.clientWidth, 200),
        height: Math.max(container.clientHeight, 200),
        backgroundColor: 0x12100e,
        roundPixels: true,
        antialias: false,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        autoDensity: true,
      });
      if (cancelled) {
        a.destroy(true, { children: true });
        return;
      }
      app = a;
      appRef.current = a;
      const canvas = a.canvas;
      canvas.className = "absolute inset-0 touch-none cursor-grab";
      canvasRef.current = canvas;
      container.appendChild(canvas);
      container.addEventListener("wheel", onWheel, { passive: false });

      scene = new IsoCityScene(a, { onSelectSector: (i) => onSelectRef.current(i) });
      sceneRef.current = scene;
      a.stage.addChild(scene.root);

      observer = new ResizeObserver(() => {
        if (!app) return;
        const w = Math.max(container.clientWidth, 200);
        const h = Math.max(container.clientHeight, 200);
        app.renderer.resize(w, h);
      });
      observer.observe(container);
      setReady(true);
    })();

    return () => {
      cancelled = true;
      setReady(false);
      container.removeEventListener("wheel", onWheel);
      observer?.disconnect();
      scene?.destroy();
      sceneRef.current = null;
      canvasRef.current = null;
      if (app) {
        app.destroy(true, { children: true });
        appRef.current = null;
      }
    };
  }, [applyCamera, zoomBy]);

  // Rebuild scene when the world changes (new business, closure, stage, population) — app is kept.
  const firstBuildRef = useRef(true);
  const season = typeof city.step === "number" ? ((city.step % 4) + 4) % 4 : 0;
  const bubbles = useMemo(() => bubblesFor(city), [city]);
  useEffect(() => {
    if (!ready || !sceneRef.current) return;
    sceneRef.current.buildScene(terrain, layout, city.arc_id, selectedRef.current, !prefersReducedMotion(), season, bubbles);
    if (firstBuildRef.current) {
      firstBuildRef.current = false;
      recenter();
    } else {
      const { x, y, zoom } = camRef.current;
      sceneRef.current.setCamera(x, y, zoom);
    }
  }, [ready, terrain, layout, city.arc_id, season, bubbles, recenter]);

  // Selection only redraws the highlight ring and label
  useEffect(() => {
    if (ready) sceneRef.current?.updateSelection(selectedIdx);
  }, [ready, selectedIdx]);

  const a11ySummary = `${city.name} isometric view, Year ${city.year}, Season ${city.season}. Population ${city.citizens.population}. Stage: ${city.stage_name}. ${totalOpen} active businesses, ${totalClosed} closed or insolvent. Drag to pan or use zoom buttons.`;

  useEffect(() => {
    canvasRef.current?.setAttribute("role", "img");
    canvasRef.current?.setAttribute("aria-label", a11ySummary);
  }, [ready, a11ySummary]);

  const handlePointerDown = (e: React.PointerEvent) => {
    const { x, y } = camRef.current;
    dragRef.current = { active: true, sx: e.clientX, sy: e.clientY, px: x, py: y };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const handlePointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d.active) return;
    applyCamera(d.px + e.clientX - d.sx, d.py + e.clientY - d.sy, camRef.current.zoom);
  };
  const handlePointerUp = (e: React.PointerEvent) => {
    if (!dragRef.current.active) return;
    dragRef.current.active = false;
    try {
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch {
      // already released
    }
  };


  return (
    <div className="atlas-panel rounded-sm p-3 sm:p-5 relative overflow-hidden space-y-4">
      {/* Map Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-atlas-line pb-3">
        <div>
          <h2 className="text-base sm:text-lg font-display font-semibold text-atlas-ink flex items-center gap-2">
            <span>Isometric Settlement View</span>
            <span className="text-xs font-mono font-normal text-atlas-gold">
              [{city.stage_name}]
            </span>
          </h2>
          <p className="text-xs text-atlas-ink-muted">
            Living city landscape. Drag to explore; click buildings or sectors to inspect.
          </p>
        </div>

        {/* Viewport Control Buttons */}
        <div className="flex items-center gap-1.5 bg-atlas-canvas/80 p-1 rounded border border-atlas-line text-xs font-mono">
          <button
            type="button"
            onClick={() => zoomBy(0.25)}
            aria-label="Zoom in"
            title="Zoom in"
            className="atlas-focus px-2 py-1 rounded bg-atlas-surface-raised hover:bg-atlas-line text-atlas-ink hover:text-atlas-gold transition-colors"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => zoomBy(-0.25)}
            aria-label="Zoom out"
            title="Zoom out"
            className="atlas-focus px-2 py-1 rounded bg-atlas-surface-raised hover:bg-atlas-line text-atlas-ink hover:text-atlas-gold transition-colors"
          >
            −
          </button>
          <button
            type="button"
            onClick={() => recenter()}
            aria-label="Fit built city to view"
            title="Fit city in view"
            className="atlas-focus px-2.5 py-1 rounded bg-atlas-surface-raised hover:bg-atlas-line text-atlas-ink hover:text-atlas-gold transition-colors"
          >
            Fit
          </button>
          <button
            type="button"
            onClick={() => recenter()}
            aria-label="Recenter map view"
            title="Recenter map"
            className="atlas-focus px-2.5 py-1 rounded bg-atlas-surface-raised hover:bg-atlas-line text-atlas-ink hover:text-atlas-gold transition-colors"
          >
            Recenter
          </button>
          <span className="text-[10px] text-atlas-ash px-1">
            {zoomLabel}%
          </span>
        </div>
      </div>

      {/* Offscreen keyboard reachable list of active bubbles */}
      <div
        role="region"
        aria-label="Active city notification bubbles"
        className="sr-only focus-within:not-sr-only focus-within:relative focus-within:z-10 focus-within:block focus-within:bg-atlas-surface-raised focus-within:p-3 focus-within:rounded focus-within:border focus-within:border-atlas-gold focus-within:space-y-2"
      >
        <h4 className="text-xs font-mono uppercase text-atlas-gold font-semibold">
          Active Bubbles & Alerts (Select to inspect district)
        </h4>
        <div className="flex flex-wrap gap-2">
          {bubbles.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => onSelectSector(b.sectorIdx)}
              aria-label={b.ariaLabel}
              className="atlas-focus text-xs font-mono px-2.5 py-1 rounded bg-atlas-surface border border-atlas-line hover:border-atlas-gold text-atlas-ink hover:text-atlas-gold transition-colors"
            >
              [{b.glyph.toUpperCase()}] {b.title}
            </button>
          ))}
        </div>
      </div>

      {/* Pixi Canvas Viewport */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="w-full relative aspect-[4/3] sm:aspect-[16/10] min-h-[420px] max-h-[640px] bg-atlas-canvas rounded overflow-hidden select-none border border-atlas-line"
      />

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-mono text-atlas-ink-muted bg-atlas-canvas/60 px-3 py-2 rounded border border-atlas-line">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-xs bg-[#42382c] border border-atlas-gold flex items-center justify-center text-[7px] text-atlas-gold">▪</span><span>House (Lit)</span></span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-xs bg-atlas-ember border border-atlas-gold" /><span>Landmark (Open)</span></span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-xs bg-atlas-alert/30 border border-atlas-alert flex items-center justify-center text-[8px] text-atlas-alert font-bold">✕</span><span>Ruined</span></span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-xs bg-[#5a5142] border border-[#363026]" /><span>Paved Road</span></span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-xs bg-[#265f7c] border border-[#64b4d6]" /><span>River & Shore</span></span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#284720] border border-[#4c6632]" /><span>Trees</span></span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-atlas-gold/80 border border-atlas-ink" /><span>Citizen / Cart</span></span>
      </div>

      {/* Keyboard-accessible sector list below canvas */}
      <div
        role="region"
        aria-label="Districts and Sectors navigation"
        className="space-y-2 pt-1"
      >
        <h3 className="text-xs font-mono uppercase tracking-wider text-atlas-ink font-semibold">
          Municipal Districts (Keyboard Operable)
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {city.sectors.map((sector) => {
            const isSelected = sector.idx === selectedIdx;
            const openBiz = sector.businesses.filter((b) => b.open && b.insolvent_steps === 0).length;
            const closedBiz = sector.businesses.length - openBiz;

            return (
              <button
                key={sector.idx}
                type="button"
                onClick={() => onSelectSector(sector.idx)}
                aria-pressed={isSelected}
                className={`atlas-focus text-left p-2 rounded transition-all border ${
                  isSelected
                    ? "bg-atlas-gold/15 border-atlas-gold text-atlas-ink shadow-xs"
                    : "bg-atlas-surface/80 border-atlas-line hover:border-atlas-line-strong text-atlas-ink-muted hover:text-atlas-ink"
                }`}
              >
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className={isSelected ? "text-atlas-gold font-bold" : "text-atlas-ash"}>
                    Sec {sector.idx}
                  </span>
                  <span className="text-[9px] uppercase">{sector.kind}</span>
                </div>
                <div className="font-display font-semibold text-xs truncate mt-0.5">
                  {sector.name}
                </div>
                <div className="text-[10px] font-mono mt-1 text-atlas-ink-muted">
                  <span>{openBiz} open</span>
                  {closedBiz > 0 && (
                    <span className="text-atlas-alert ml-1">({closedBiz} closed)</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
