"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Application } from "pixi.js";
import type { CityView } from "../lib/sim-view.ts";
import { stateToCityView } from "../lib/sim-view.ts";
import { getArc, getPricingRules } from "../lib/sim-adapter.ts";
import { generateTerrain } from "../lib/iso/terrain.ts";
import { layoutCity, getStageIndex, type CityLayout } from "../lib/iso/layout.ts";
import type { BuildingLayout, HouseLayout } from "../lib/iso/layout-types.ts";
import { IsoCityScene } from "../lib/iso/render.ts";
import { calculateFitCamera } from "../lib/iso/iso-math.ts";
import { bubblesFor } from "../lib/iso/bubbles.ts";
import { computeGrowthView, createReplaySnapshotStore } from "../lib/iso/growth-view.ts";
import type { OverlayMode } from "../lib/city-report.ts";
import { CityGrowthScrubber } from "./CityGrowthScrubber.tsx";
import { HexA11yList } from "./HexA11yList.tsx";
import { buildMapA11yItems } from "../lib/a11y/map-items.ts";
import { MapInspector, type InspectedTarget } from "./MapInspector.tsx";
import { MapHoverTooltip } from "./ui/MapHoverTooltip.tsx";
import { MapZoomControls } from "./ui/MapZoomControls.tsx";
import { MapOverlayControl } from "./ui/MapOverlayControl.tsx";
import { CityReportStrip } from "./ui/CityReportStrip.tsx";

export interface IsoCityProps {
  city: CityView;
  selectedIdx: number;
  onSelectSector: (idx: number) => void;
  seed?: string;
  onScrubStep?: (step: number) => void;
  onTryStrategy?: (kind: string, sectorIdx: number) => void;
  strategyResult?: string | null;
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3.0;

function clampZoom(z: number): number {
  const stepped = Math.round(z * 4) / 4;
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
  onScrubStep,
  onTryStrategy,
  strategyResult,
}: IsoCityProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const sceneRef = useRef<IsoCityScene | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [triggerEl, setTriggerEl] = useState<HTMLElement | null>(null);
  const [bounds, setBounds] = useState({ width: 800, height: 500 });

  const [scrubStep, setScrubStep] = useState<number | null>(null);
  const [zoomLabel, setZoomLabel] = useState(100);
  const [ready, setReady] = useState(false);
  const [overlayMode, setOverlayMode] = useState<OverlayMode>("normal");
  const [hoverBuilding, setHoverBuilding] = useState<{ building: BuildingLayout; level: number } | null>(null);
  const [pointerPos, setPointerPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [inspectedTarget, setInspectedTarget] = useState<InspectedTarget | null>(null);

  const camRef = useRef({ x: 0, y: 0, zoom: 1 });
  const dragRef = useRef<{ active: boolean; sx: number; sy: number; px: number; py: number }>({
    active: false, sx: 0, sy: 0, px: 0, py: 0,
  });

  const onSelectRef = useRef(onSelectSector);
  const selectedRef = useRef(selectedIdx);
  useEffect(() => {
    onSelectRef.current = onSelectSector;
    selectedRef.current = selectedIdx;
  }, [onSelectSector, selectedIdx]);

  const snapshotStore = useMemo(() => createReplaySnapshotStore(city.arc_id, seed), [city.arc_id, seed]);
  const activeStep = scrubStep ?? city.step;

  const activeCity = useMemo(() => {
    if (scrubStep === null || scrubStep === city.step) return city;
    try {
      const { state, stateRoot } = snapshotStore.getStateAtStep(scrubStep);
      return stateToCityView(state, getArc(city.arc_id), getPricingRules(), { stateRoot });
    } catch {
      return city;
    }
  }, [scrubStep, city, snapshotStore]);

  const mapItems = useMemo(() => buildMapA11yItems(activeCity), [activeCity]);

  const terrain = useMemo(() => generateTerrain(seed, activeCity.arc_id, 40), [seed, activeCity.arc_id]);
  const layout: CityLayout = useMemo(() => layoutCity(terrain, activeCity), [terrain, activeCity]);
  const layoutRef = useRef(layout);
  useEffect(() => { layoutRef.current = layout; }, [layout]);

  const growthView = useMemo(() => {
    return computeGrowthView({
      arcId: activeCity.arc_id,
      stageId: activeCity.stage_id,
      stageIndex: getStageIndex(activeCity.stage_id),
      year: activeCity.year,
      step: activeCity.step,
      population: activeCity.citizens.population,
      businesses: activeCity.sectors.flatMap((s) =>
        s.businesses.map((b) => ({ id: b.id, sectorIdx: s.idx, open: b.open, insolvent: b.insolvent_steps > 0 }))
      ),
      roads: layout.roads,
      buildings: layout.buildings,
      houses: layout.houses,
      plaza: layout.plaza,
    });
  }, [activeCity, layout]);

  const viewRef = useRef({ activeCity, growthView });
  useEffect(() => {
    viewRef.current = { activeCity, growthView };
  }, [activeCity, growthView]);

  const applyCamera = useCallback((x: number, y: number, zoom: number) => {
    camRef.current = { x, y, zoom };
    sceneRef.current?.setCamera(x, y, zoom);
    setZoomLabel(Math.round(zoom * 100));
  }, []);

  const recenter = useCallback(() => {
    const el = containerRef.current;
    const w = el?.clientWidth ?? 960;
    const h = el?.clientHeight ?? 540;
    const pts = [layout.plaza, ...layout.buildings.map((b) => ({ x: b.tileX, y: b.tileY }))];
    const cam = calculateFitCamera(pts, { viewportWidth: w, viewportHeight: h, padding: 48, minZoom: MIN_ZOOM, maxZoom: MAX_ZOOM });
    const zoom = Math.min(MAX_ZOOM, Math.round(cam.zoom * 1.6 * 4) / 4);
    const cx = (w / 2 - cam.x) / cam.zoom;
    const cy = (h / 2 - cam.y) / cam.zoom;
    applyCamera(Math.round(w / 2 - cx * zoom), Math.round(h / 2 - cy * zoom), zoom);
  }, [layout, applyCamera]);

  const zoomBy = useCallback((delta: number) => {
    const el = containerRef.current;
    if (!el) return;
    const { x, y, zoom } = camRef.current;
    const next = clampZoom(zoom + delta);
    const cx = el.clientWidth / 2;
    const cy = el.clientHeight / 2;
    const k = next / zoom;
    applyCamera(cx - (cx - x) * k, cy - (cy - y) * k, next);
  }, [applyCamera]);

  // Create Pixi app once
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;
    let app: Application | null = null;
    let observer: ResizeObserver | null = null;
    let scene: IsoCityScene | null = null;

    const onWheel = (e: WheelEvent) => { e.preventDefault(); zoomBy(e.deltaY > 0 ? -0.25 : 0.25); };

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
      if (cancelled) { a.destroy(true, { children: true }); return; }
      app = a; appRef.current = a;
      const canvas = a.canvas;
      canvas.className = "absolute inset-0 touch-none cursor-grab";
      canvasRef.current = canvas;
      container.appendChild(canvas);
      container.addEventListener("wheel", onWheel, { passive: false });

      scene = new IsoCityScene(a, {
        onSelectSector: (i) => onSelectRef.current(i),
        onHoverBuilding: (b) => {
          if (!b) setHoverBuilding(null);
          else {
            const slot = viewRef.current.growthView.buildingSlots.find((s) => s.id === b.id);
            setHoverBuilding({ building: b, level: slot ? slot.level : b.level });
          }
        },
        onSelectBuilding: (b) => {
          const sec = viewRef.current.activeCity.sectors.find((s) => s.idx === b.sectorIdx);
          const slot = viewRef.current.growthView.buildingSlots.find((s) => s.id === b.id);
          setInspectedTarget({
            type: "building",
            id: b.id,
            name: b.name,
            sectorIdx: b.sectorIdx,
            sector: sec,
            level: slot ? slot.level : b.level,
            tileX: b.tileX,
            tileY: b.tileY,
          });
        },
        onSelectHouse: (h) => {
          setInspectedTarget({
            type: "house",
            id: h.id,
            level: h.level,
            tileX: h.tileX,
            tileY: h.tileY,
            citizens: viewRef.current.activeCity.citizens,
          });
        },
      });
      sceneRef.current = scene;
      a.stage.addChild(scene.root);

      observer = new ResizeObserver(() => {
        if (!app) return;
        app.renderer.resize(Math.max(container.clientWidth, 200), Math.max(container.clientHeight, 200));
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
      if (app) { app.destroy(true, { children: true }); appRef.current = null; }
    };
  }, [applyCamera, zoomBy]);

  const rawSeason = typeof activeCity.step === "number" ? ((activeCity.step % 4) + 4) % 4 : 0;
  const [heldSeason, setHeldSeason] = useState(rawSeason);
  const rawSeasonRef = useRef(rawSeason);
  useEffect(() => { rawSeasonRef.current = rawSeason; }, [rawSeason]);
  useEffect(() => {
    const id = setInterval(() => setHeldSeason(rawSeasonRef.current), 6000);
    return () => clearInterval(id);
  }, []);

  const season = scrubStep !== null ? rawSeason : heldSeason;
  const bubbles = useMemo(() => bubblesFor(activeCity), [activeCity]);

  useEffect(() => {
    if (!ready || !sceneRef.current) return;
    sceneRef.current.buildScene(
      terrain, layout, activeCity.arc_id, selectedRef.current,
      !prefersReducedMotion(), season, bubbles, growthView, overlayMode, activeCity
    );
    const { x, y, zoom } = camRef.current;
    sceneRef.current.setCamera(x, y, zoom);
  }, [ready, terrain, layout, activeCity, season, bubbles, growthView, overlayMode]);

  useEffect(() => {
    if (ready) sceneRef.current?.updateSelection(selectedIdx);
  }, [ready, selectedIdx]);

  const handlePointerDown = (e: React.PointerEvent) => {
    const { x, y } = camRef.current;
    dragRef.current = { active: true, sx: e.clientX, sy: e.clientY, px: x, py: y };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const handlePointerMove = (e: React.PointerEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      setPointerPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      setBounds((b) => (b.width === rect.width && b.height === rect.height ? b : { width: rect.width, height: rect.height }));
    }
    const d = dragRef.current;
    if (!d.active) return;
    applyCamera(d.px + e.clientX - d.sx, d.py + e.clientY - d.sy, camRef.current.zoom);
  };
  const handlePointerUp = (e: React.PointerEvent) => {
    if (!dragRef.current.active) return;
    dragRef.current.active = false;
    try { (e.target as HTMLElement).releasePointerCapture?.(e.pointerId); } catch { /* ignore */ }
  };

  const handleOverlayModeChange = (mode: OverlayMode) => {
    setOverlayMode(mode);
    sceneRef.current?.setOverlayMode(mode, activeCity);
  };

  const hoveredSector = hoverBuilding
    ? activeCity.sectors.find((s) => s.idx === hoverBuilding.building.sectorIdx)
    : null;

  return (
    <div className="relative space-y-3">
      {/* Keyboard-accessible roving focus navigation */}
      <HexA11yList
        items={mapItems}
        onSelectSector={onSelectSector}
        onInspectSector={(idx, el) => {
          setTriggerEl(el);
          const sec = activeCity.sectors.find((s) => s.idx === idx);
          const bldg = layout.buildings.find((b) => b.sectorIdx === idx);
          if (sec && bldg) {
            setInspectedTarget({
              type: "building",
              id: bldg.id,
              name: bldg.name,
              sectorIdx: idx,
              sector: sec,
              level: bldg.level,
              tileX: bldg.tileX,
              tileY: bldg.tileY,
            });
          }
        }}
      />

      {/* Pixi Canvas Viewport */}
      <div className="relative w-full overflow-hidden rounded border border-atlas-line bg-atlas-canvas">
        <div
          ref={containerRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="w-full relative h-[72vh] min-h-[460px] max-h-[820px] select-none"
        />

        {/* Camera Zoom & Recenter Toolbar */}
        <div className="absolute right-3 top-3 z-10">
          <MapZoomControls
            zoomLabel={zoomLabel}
            onZoomIn={() => zoomBy(0.25)}
            onZoomOut={() => zoomBy(-0.25)}
            onFit={recenter}
            onRecenter={recenter}
          />
        </div>

        {/* Hover Tooltip Card (Item 1) */}
        {hoverBuilding && hoveredSector && !inspectedTarget && (
          <MapHoverTooltip
            sector={hoveredSector}
            level={hoverBuilding.level}
            pointerPos={pointerPos}
            containerBounds={bounds}
          />
        )}

        {/* Anchored Paper Inspection Card (Item 2) */}
        <MapInspector
          target={inspectedTarget}
          onClose={() => setInspectedTarget(null)}
          onOpenLedger={(idx) => {
            setInspectedTarget(null);
            onSelectSector(idx);
          }}
          onTryStrategy={(kind, idx) => {
            onTryStrategy?.(kind, idx);
          }}
          strategyResult={strategyResult}
          focusReturnElement={triggerEl}
        />

        <div aria-hidden="true" className="tiltshift tiltshift-top" />
        <div aria-hidden="true" className="tiltshift tiltshift-bottom" />
        <div aria-hidden="true" className="city-vignette" />
      </div>

      {/* Progress Overlay Switch & Legend (Item 3) */}
      <MapOverlayControl mode={overlayMode} onChangeMode={handleOverlayModeChange} />

      {/* Compact City Report Strip (Item 3) */}
      <CityReportStrip city={activeCity} />

      {/* 2500-Year Growth Timeline Scrubber */}
      <CityGrowthScrubber
        currentStep={activeStep}
        maxStep={10000}
        cityName={activeCity.name}
        arcId={activeCity.arc_id}
        stageName={activeCity.stage_name}
        population={activeCity.citizens.population}
        openBiz={activeCity.sectors.flatMap((s) => s.businesses).filter((b) => b.open && b.insolvent_steps === 0).length}
        totalBiz={activeCity.sectors.flatMap((s) => s.businesses).length}
        satisfaction={Math.round(activeCity.citizens.satisfaction_bps / 100)}
        patinaName={growthView.patinaName}
        onScrub={(target) => {
          setScrubStep(target);
          onScrubStep?.(target);
        }}
      />
    </div>
  );
}
