"use client";

import type { MockCity } from "../data/mock-city.ts";
import { formatCoin, formatCount, formatStep } from "../lib/format.ts";

interface HeaderProps {
  city: MockCity & { stateRoot?: string };
}

export function Header({ city }: HeaderProps) {
  const satisfactionPct = Math.round(city.citizens.satisfaction_bps / 100);

  return (
    <header className="border-b border-atlas-line bg-atlas-surface/80 backdrop-blur-sm sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 sm:py-4">
        {/* Top row: Brand + World Clock + Stage */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-sm bg-atlas-gold/15 border border-atlas-gold/40 flex items-center justify-center text-atlas-gold font-display font-bold text-lg select-none">
              AE
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-display font-bold text-atlas-ink tracking-wide">
                  AfterEarth
                </h1>
                <span className="text-xs font-mono uppercase tracking-widest px-2 py-0.5 rounded-xs bg-atlas-gold/10 border border-atlas-gold/30 text-atlas-gold">
                  {city.stage_name}
                </span>
              </div>
              <p className="text-xs text-atlas-ink-muted flex items-center gap-1.5">
                <span>Settlement:</span>
                <span className="text-atlas-ink font-medium">{city.name}</span>
                <span className="text-atlas-line-strong">•</span>
                <span className="text-atlas-ash font-mono">[{city.arc_id}]</span>
              </p>
            </div>
          </div>

          {/* World Clock & Stats */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-4 font-mono text-xs">
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-xs bg-atlas-surface-raised border border-atlas-line"
              role="timer"
              aria-live="polite"
              aria-atomic="true"
            >
              <span className="text-atlas-ember text-sm" aria-hidden="true">⏳</span>
              <div>
                <div className="text-atlas-ink font-bold">{formatStep(city.step)}</div>
                <div className="text-[10px] text-atlas-ink-muted">Step {city.step} (4/yr)</div>
              </div>
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xs bg-atlas-surface-raised border border-atlas-line">
              <span className="text-atlas-moss text-sm" aria-hidden="true">👥</span>
              <div>
                <div className="text-atlas-ink font-bold">{formatCount(city.citizens.population)}</div>
                <div className="text-[10px] text-atlas-moss">{satisfactionPct}% satisfaction</div>
              </div>
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xs bg-atlas-surface-raised border border-atlas-line">
              <span className="text-atlas-gold text-sm" aria-hidden="true">🪙</span>
              <div>
                <div className="text-atlas-gold font-bold">{formatCoin(city.treasury)}</div>
                <div className="text-[10px] text-atlas-ink-muted">City Treasury</div>
              </div>
            </div>

            {/* Audit State Root */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xs bg-atlas-surface-raised border border-atlas-line">
              <span className="text-atlas-arcane text-sm" aria-hidden="true">📜</span>
              <div>
                <div className="text-atlas-ink font-bold font-mono tracking-wider text-[11px]" title={city.stateRoot}>
                  {city.stateRoot ? `${city.stateRoot.slice(0, 12)}…` : "—"}
                </div>
                <div className="text-[10px] text-atlas-ink-muted">state root</div>
              </div>
            </div>
          </div>
        </div>

        {/* Quiet disclaimer note */}
        <div className="mt-2.5 pt-2 border-t border-atlas-line/60 flex flex-wrap items-center justify-between gap-1 text-[11px] text-atlas-ink-muted">
          <p className="flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-atlas-ember/70 animate-pulse" aria-hidden="true" />
            <span>Autonomous settlement simulated state</span>
          </p>
          <span className="italic text-atlas-ink-muted">
            Simulation running in your browser (mock mode, no chain)
          </span>
        </div>
      </div>
    </header>
  );
}
