"use client";

interface SimulationControlsProps {
  arcId: string;
  seed: string;
  availableArcs: readonly string[];
  isRunning: boolean;
  stepsRemaining: number;
  onSelectArc: (arcId: string) => void;
  onChangeSeed: (seed: string) => void;
  onStepSeason: () => void;
  onStepYear: () => void;
  onStepDecade: () => void;
  onFastForward: () => void;
  onPause: () => void;
  onReset: () => void;
}

export function SimulationControls({
  arcId,
  seed,
  availableArcs,
  isRunning,
  stepsRemaining,
  onSelectArc,
  onChangeSeed,
  onStepSeason,
  onStepYear,
  onStepDecade,
  onFastForward,
  onPause,
  onReset,
}: SimulationControlsProps) {
  return (
    <div
      role="toolbar"
      aria-label="Simulation Control Bar"
      className="atlas-panel rounded-sm p-3 sm:p-4 border border-atlas-line flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs font-mono"
    >
      {/* Left: World Arc & Seed Controls */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex items-center gap-1.5">
          <label htmlFor="arc-select" className="text-atlas-ink-muted font-sans font-medium">
            World:
          </label>
          <select
            id="arc-select"
            value={arcId}
            disabled={isRunning}
            onChange={(e) => onSelectArc(e.target.value)}
            className="atlas-focus bg-atlas-surface border border-atlas-line text-atlas-ink px-2 py-1 rounded-xs cursor-pointer hover:border-atlas-line-strong focus:outline-none"
          >
            {availableArcs.map((id) => (
              <option key={id} value={id}>
                {id === "goblin_warrens" ? "Goblin Warrens" : id === "cave_hold" ? "Cave Hold" : id}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <label htmlFor="seed-input" className="text-atlas-ink-muted font-sans font-medium">
            Seed:
          </label>
          <input
            id="seed-input"
            type="text"
            value={seed}
            disabled={isRunning}
            onChange={(e) => onChangeSeed(e.target.value)}
            className="atlas-focus bg-atlas-surface border border-atlas-line text-atlas-gold px-2 py-1 rounded-xs w-28 sm:w-32 focus:outline-none"
            placeholder="world_seed"
          />
        </div>
      </div>

      {/* Right: Step, Fast-forward, Pause, and Reset Controls */}
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
        {/* Step 1 Season */}
        <button
          type="button"
          onClick={onStepSeason}
          disabled={isRunning}
          aria-label="Advance 1 season (1 step)"
          className="atlas-focus px-2.5 py-1 rounded-xs bg-atlas-surface border border-atlas-line hover:border-atlas-gold/80 hover:bg-atlas-surface-raised text-atlas-ink font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          +1 Season
        </button>

        {/* Step 1 Year */}
        <button
          type="button"
          onClick={onStepYear}
          disabled={isRunning}
          aria-label="Advance 1 year (4 steps)"
          className="atlas-focus px-2.5 py-1 rounded-xs bg-atlas-surface border border-atlas-line hover:border-atlas-gold/80 hover:bg-atlas-surface-raised text-atlas-ink font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          +1 Year (4)
        </button>

        {/* Step 10 Years */}
        <button
          type="button"
          onClick={onStepDecade}
          disabled={isRunning}
          aria-label="Advance 10 years (40 steps)"
          className="atlas-focus px-2.5 py-1 rounded-xs bg-atlas-surface border border-atlas-line hover:border-atlas-gold/80 hover:bg-atlas-surface-raised text-atlas-ink font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          +10 Yrs (40)
        </button>

        {/* Fast-Forward (40 steps over 30s) */}
        <button
          type="button"
          onClick={onFastForward}
          disabled={isRunning}
          aria-label="Fast-forward 40 steps over 30 seconds"
          className="atlas-focus px-3 py-1 rounded-xs bg-atlas-gold/15 border border-atlas-gold/60 text-atlas-gold hover:bg-atlas-gold/25 font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
        >
          <span>▶</span>
          <span>{isRunning ? `Running (${stepsRemaining})` : "Fast-Forward"}</span>
        </button>

        {/* Always visible Pause */}
        <button
          type="button"
          onClick={onPause}
          disabled={!isRunning}
          aria-label="Pause fast-forward"
          className={`atlas-focus px-2.5 py-1 rounded-xs border font-semibold transition-colors ${
            isRunning
              ? "bg-atlas-ember/20 border-atlas-ember text-atlas-ember hover:bg-atlas-ember/30 animate-pulse"
              : "bg-atlas-surface border-atlas-line text-atlas-ink-muted/50 cursor-not-allowed opacity-50"
          }`}
        >
          ⏸ Pause
        </button>

        {/* Always visible Reset */}
        <button
          type="button"
          onClick={onReset}
          aria-label="Reset simulation to step 0"
          className="atlas-focus px-2.5 py-1 rounded-xs bg-atlas-surface border border-atlas-alert/40 text-atlas-alert/90 hover:bg-atlas-alert/15 hover:border-atlas-alert hover:text-atlas-alert font-semibold transition-colors"
        >
          ↺ Reset
        </button>
      </div>
    </div>
  );
}
