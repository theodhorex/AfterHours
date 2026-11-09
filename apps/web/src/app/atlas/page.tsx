"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { Header } from "../../components/Header.tsx";
import { DistrictDetail } from "../../components/DistrictDetail.tsx";
import { MarketPanel } from "../../components/MarketPanel.tsx";
import { CityStatsPanel } from "../../components/CityStatsPanel.tsx";
import { ChronicleList } from "../../components/ChronicleList.tsx";
import { SimulationControls } from "../../components/SimulationControls.tsx";
import { AuditPanel } from "../../components/AuditPanel.tsx";
import { CaravanPanel } from "../../components/CaravanPanel.tsx";
import { AgentsPanel } from "../../components/AgentsPanel.tsx";
import { MayorCard } from "../../components/MayorCard.tsx";
import { BookTabs } from "../../components/ui/BookTabs.tsx";
import { Icon } from "../../components/ui/Icons.tsx";
import { sectorKindToPresetKey } from "../../lib/agents.ts";

const IsoCity = dynamic(
  () => import("../../components/IsoCity.tsx").then((mod) => mod.IsoCity),
  {
    ssr: false,
    loading: () => (
      <div className="atlas-panel rounded-sm p-12 text-center text-atlas-ink-muted font-mono text-sm border border-atlas-line">
        Drawing the map…
      </div>
    ),
  }
);
import {
  createWorld,
  advanceWorld,
  AVAILABLE_ARCS,
  type WorldInstance,
} from "../../lib/sim-adapter.ts";
import { stateToCityView, type CityView } from "../../lib/sim-view.ts";

const DEFAULT_ARC = "goblin_warrens";
const DEFAULT_SEED = "goblin_seed_0";
const FAST_FORWARD_STEPS = 40;
const STEP_INTERVAL_MS = 750; // 40 steps over ~30 seconds

export default function CityViewPage() {
  const [arcId, setArcId] = useState<string>(DEFAULT_ARC);
  const [seed, setSeed] = useState<string>(DEFAULT_SEED);
  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [stepsRemaining, setStepsRemaining] = useState<number>(10000);
  const [error, setError] = useState<Error | null>(null);
  const [bookTab, setBookTab] = useState<string>("market");
  const [strategyPresetKey, setStrategyPresetKey] = useState<string>("flour-trader");
  const [backtestSummary, setBacktestSummary] = useState<string | null>(null);

  const handleTryStrategy = useCallback((kind: string) => {
    const preset = sectorKindToPresetKey(kind);
    setStrategyPresetKey(preset);
    setBookTab("agents");
  }, []);

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
    setIsRunning(true);
    setStepsRemaining(10000);
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
      setIsRunning(true);
      setStepsRemaining(10000);
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
      {/* HUD bar: clock, citizens, treasury, state root */}
      {cityView && <Header city={cityView} />}

      <main className="flex-1 w-full mx-auto max-w-[1600px] px-3 py-3 sm:px-6 sm:py-5 space-y-4">
        {/* Error Panel (fallback if sim throws) */}
        {activeError && (
          <div
            role="alert"
            className="atlas-panel rounded-sm p-4 sm:p-5 border border-atlas-alert bg-atlas-alert/10 text-atlas-ink space-y-3"
          >
            <div className="flex items-center gap-2 text-atlas-alert font-display font-bold text-base sm:text-lg">
              <Icon name="alert" size={20} />
              <h2>The simulation stopped</h2>
            </div>
            <p className="font-mono text-xs sm:text-sm text-atlas-ink/90 leading-relaxed bg-atlas-canvas/60 p-3 rounded-xs border border-atlas-alert/30">
              {activeError.message || String(activeError)}
            </p>
            <button
              type="button"
              onClick={handleReset}
              className="atlas-focus px-3 py-1.5 rounded-xs bg-atlas-alert text-atlas-canvas font-mono font-semibold text-xs hover:bg-atlas-alert/90 transition-colors min-h-[44px] sm:min-h-fit inline-flex items-center cursor-pointer"
            >
              Reset the world
            </button>
          </div>
        )}

        {/* The map is the hero: first thing on the page, full width */}
        {cityView && !activeError && (
          <IsoCity
            city={cityView}
            selectedIdx={selectedIdx}
            onSelectSector={(idx) => {
              setSelectedIdx(idx);
              setBookTab("district");
            }}
            seed={seed}
            onTryStrategy={handleTryStrategy}
            strategyResult={backtestSummary}
          />
        )}

        {/* Time and world controls sit directly under the map */}
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

        {/* The ledger: one page open at a time */}
        {cityView && !activeError && (
          <section aria-label="City ledger" className="border-2 border-ledger-twilight">
            <BookTabs
              value={bookTab}
              onChange={setBookTab}
              ariaLabel="City ledger pages"
              tabs={[
                { value: "market", label: "Market", icon: <Icon name="coin" size={16} /> },
                { value: "stats", label: "Stats", icon: <Icon name="bread" size={16} /> },
                { value: "district", label: "District", icon: <Icon name="anvil" size={16} /> },
                { value: "chronicle", label: "Chronicle", icon: <Icon name="scroll" size={16} /> },
                { value: "audit", label: "Audit", icon: <Icon name="seal" size={16} /> },
                { value: "routes", label: "Trade routes", icon: <Icon name="caravan" size={16} /> },
                { value: "agents", label: "Agents", icon: <Icon name="quill" size={16} /> },
                { value: "mayor", label: "Mayor", icon: <Icon name="scale" size={16} /> },
              ]}
            />
            <div
              role="tabpanel"
              id={`book-panel-${bookTab}`}
              aria-labelledby={`book-tab-${bookTab}`}
              className="bg-atlas-canvas p-3 sm:p-5"
            >
              {bookTab === "market" && <MarketPanel items={cityView.market} />}
              {bookTab === "stats" && <CityStatsPanel city={cityView} />}
              {bookTab === "district" && selectedSector && <DistrictDetail sector={selectedSector} />}
              {bookTab === "chronicle" && <ChronicleList events={cityView.chronicle} />}
              {bookTab === "audit" && (
                <AuditPanel
                  arcId={arcId}
                  seed={seed}
                  cityId={world.state.city_id}
                  checkpoints={world.checkpoints}
                />
              )}
              {bookTab === "routes" && <CaravanPanel />}
              {bookTab === "agents" && (
                <AgentsPanel
                  arcId={arcId}
                  seed={seed}
                  initialPresetKey={strategyPresetKey}
                  onBacktestComplete={({ summary }) => setBacktestSummary(summary)}
                />
              )}
              {bookTab === "mayor" && <MayorCard arcId={arcId} cityYear={cityView.year} />}
            </div>
          </section>
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
