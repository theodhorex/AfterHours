"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { Header } from "../components/Header.tsx";
import { DistrictDetail } from "../components/DistrictDetail.tsx";
import { MarketPanel } from "../components/MarketPanel.tsx";
import { ChronicleList } from "../components/ChronicleList.tsx";
import { SimulationControls } from "../components/SimulationControls.tsx";

const IsoCity = dynamic(
  () => import("../components/IsoCity.tsx").then((mod) => mod.IsoCity),
  {
    ssr: false,
    loading: () => (
      <div className="atlas-panel rounded-sm p-12 text-center text-atlas-ink-muted font-mono text-sm border border-atlas-line">
        Surveying terrain & rendering isometric city view...
      </div>
    ),
  }
);
import {
  createWorld,
  advanceWorld,
  AVAILABLE_ARCS,
  type WorldInstance,
} from "../lib/sim-adapter.ts";
import { stateToCityView, type CityView } from "../lib/sim-view.ts";

const DEFAULT_ARC = "goblin_warrens";
const DEFAULT_SEED = "goblin_seed_0";
const FAST_FORWARD_STEPS = 40;
const STEP_INTERVAL_MS = 750; // 40 steps over ~30 seconds

export default function CityViewPage() {
  const [arcId, setArcId] = useState<string>(DEFAULT_ARC);
  const [seed, setSeed] = useState<string>(DEFAULT_SEED);
  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [stepsRemaining, setStepsRemaining] = useState<number>(0);
  const [error, setError] = useState<Error | null>(null);

  // Initialize world instance at genesis (step 0)
  const [world, setWorld] = useState<WorldInstance>(() =>
    createWorld(DEFAULT_ARC, DEFAULT_SEED)
  );

  // Fast-forward interval runner: 40 steps spread over ~30 seconds (1 step per tick)
  useEffect(() => {
    if (!isRunning) return;

    const timer = setInterval(() => {
      setWorld((curr) => {
        try {
          return advanceWorld(curr, 1);
        } catch (err) {
          setIsRunning(false);
          setError(err instanceof Error ? err : new Error(String(err)));
          return curr;
        }
      });

      setStepsRemaining((prev) => {
        if (prev <= 1) {
          setIsRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, STEP_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [isRunning]);

  // Advance by N steps
  const handleAdvance = useCallback((steps: number) => {
    try {
      setError(null);
      setWorld((curr) => advanceWorld(curr, steps));
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    }
  }, []);

  // Trigger fast-forward
  const handleFastForward = useCallback(() => {
    if (isRunning) return;
    setError(null);
    setStepsRemaining(FAST_FORWARD_STEPS);
    setIsRunning(true);
  }, [isRunning]);

  // Pause fast-forward
  const handlePause = useCallback(() => {
    setIsRunning(false);
  }, []);

  // Reset simulation to step 0
  const handleReset = useCallback(() => {
    setIsRunning(false);
    setStepsRemaining(0);
    setError(null);
    try {
      setWorld(createWorld(arcId, seed));
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    }
  }, [arcId, seed]);

  // Switch Arc
  const handleSelectArc = useCallback(
    (newArcId: string) => {
      setArcId(newArcId);
      setIsRunning(false);
      setStepsRemaining(0);
      setError(null);
      try {
        setWorld(createWorld(newArcId, seed));
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    },
    [seed]
  );

  // Update Seed
  const handleChangeSeed = useCallback(
    (newSeed: string) => {
      setSeed(newSeed);
      setIsRunning(false);
      setStepsRemaining(0);
      setError(null);
      try {
        setWorld(createWorld(arcId, newSeed));
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    },
    [arcId]
  );

  // Derive view model and catch any mapping error purely during render
  let cityView: CityView | null = null;
  let renderError: Error | null = null;
  if (world) {
    try {
      cityView = stateToCityView(world.state, world.arc, world.pricing, {
        stateRoot: world.stateRoot,
        events: world.events,
        prevPrices: world.prevPrices,
      });
    } catch (err) {
      renderError = err instanceof Error ? err : new Error(String(err));
    }
  }

  const activeError = error ?? renderError;
  const selectedSector = cityView?.sectors[selectedIdx] ?? cityView?.sectors[0];

  return (
    <div className="min-h-screen bg-atlas-canvas text-atlas-ink flex flex-col">
      {/* 1. Header with live World Clock, Stage badge, stats, and State Root */}
      {cityView && <Header city={cityView} />}

      {/* Main Layout Container: responsive from 360px with 16px gutter */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-4 sm:px-6 sm:py-6 space-y-5">
        {/* Always visible Simulation Control Bar */}
        <SimulationControls
          arcId={arcId}
          seed={seed}
          availableArcs={AVAILABLE_ARCS}
          isRunning={isRunning}
          stepsRemaining={stepsRemaining}
          onSelectArc={handleSelectArc}
          onChangeSeed={handleChangeSeed}
          onStepSeason={() => handleAdvance(1)}
          onStepYear={() => handleAdvance(4)}
          onStepDecade={() => handleAdvance(40)}
          onFastForward={handleFastForward}
          onPause={handlePause}
          onReset={handleReset}
        />

        {/* Error Panel (fallback if sim throws) */}
        {activeError && (
          <div
            role="alert"
            className="atlas-panel rounded-sm p-4 sm:p-5 border border-atlas-alert bg-atlas-alert/10 text-atlas-ink space-y-3"
          >
            <div className="flex items-center gap-2 text-atlas-alert font-display font-bold text-base sm:text-lg">
              <span aria-hidden="true">⚠️</span>
              <h2>Simulation Error Encountered</h2>
            </div>
            <p className="font-mono text-xs sm:text-sm text-atlas-ink/90 leading-relaxed bg-atlas-canvas/60 p-3 rounded-xs border border-atlas-alert/30">
              {activeError.message || String(activeError)}
            </p>
            <button
              type="button"
              onClick={handleReset}
              className="atlas-focus px-3 py-1.5 rounded-xs bg-atlas-alert text-atlas-canvas font-mono font-semibold text-xs hover:bg-atlas-alert/90 transition-colors"
            >
              Reset & Recover Simulation
            </button>
          </div>
        )}

        {/* Primary Content: Wide Hero Isometric City Canvas, then District & Market Grid */}
        {cityView && !activeError && (
          <div className="space-y-6">
            <IsoCity
              city={cityView}
              selectedIdx={selectedIdx}
              onSelectSector={setSelectedIdx}
              seed={seed}
            />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: District Detail */}
              <div className="lg:col-span-7 space-y-6">
                {selectedSector && <DistrictDetail sector={selectedSector} />}
              </div>

              {/* Right Column: Market Panel & Chronicle List */}
              <div className="lg:col-span-5 space-y-6">
                <MarketPanel items={cityView.market} />
                <ChronicleList events={cityView.chronicle} />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-atlas-line bg-atlas-surface/60 py-5 mt-10 text-center text-xs text-atlas-ink-muted">
        <div className="max-w-7xl mx-auto px-4 space-y-1">
          <p className="font-display tracking-wider text-atlas-ink font-semibold">
            AfterEarth • {cityView?.name ?? "Settlement"}
          </p>
          <p className="font-mono text-[11px] text-atlas-ash">
            {cityView
              ? `Year ${cityView.year}, ${cityView.season} • Step ${cityView.step} • State Root: ${cityView.stateRoot.slice(0, 12)}…`
              : "Live browser simulation preview"}
          </p>
        </div>
      </footer>
    </div>
  );
}
