"use client";

import { useState, useCallback } from "react";
import { buildCaravanView, type CaravanViewResult } from "../lib/caravan-view.ts";

export function CaravanPanel() {
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [result, setResult] = useState<CaravanViewResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRunCaravan = useCallback(async () => {
    if (isRunning) return;
    setIsRunning(true);
    setError(null);

    // Yield to let browser render loading state
    await new Promise((resolve) => setTimeout(resolve, 30));

    try {
      const res = buildCaravanView(400, 10, "bread");
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsRunning(false);
    }
  }, [isRunning]);

  return (
    <section
      aria-labelledby="caravan-panel-heading"
      className="atlas-panel rounded-sm p-4 sm:p-5 border border-atlas-line space-y-4"
    >
      {/* Header & Badges */}
      <div className="border-b border-atlas-line pb-3 space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2
            id="caravan-panel-heading"
            className="text-base sm:text-lg font-display font-semibold text-atlas-ink flex items-center gap-2"
          >
            <span aria-hidden="true" className="text-atlas-gold">🐪</span>
            Trade routes (inter-city caravans)
          </h2>
          {result && (
            <span
              className={`font-mono text-xs px-2.5 py-0.5 rounded-xs font-semibold border ${
                result.conservationOk
                  ? "bg-atlas-moss/20 text-atlas-moss border-atlas-moss/50"
                  : "bg-atlas-alert/20 text-atlas-alert border-atlas-alert/50"
              }`}
            >
              {result.conservationOk ? "Conservation: OK" : "Conservation: FAILED"}
            </span>
          )}
        </div>
        <p className="text-xs text-atlas-ink-muted leading-relaxed">
          Simulate bilateral trade routes between <strong>Dino Vale</strong> and <strong>Elf Grove</strong>.
          Dino Vale produces surplus food (bread) and exports it along the caravan route to balance Elf Grove&apos;s staple supplies.
        </p>
      </div>

      {/* Action Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleRunCaravan}
          disabled={isRunning}
          className={`atlas-focus px-4 py-2 rounded-xs font-mono font-semibold text-xs transition-colors flex items-center gap-2 min-h-[44px] ${
            isRunning
              ? "bg-atlas-ash/20 text-atlas-ash border border-atlas-line cursor-not-allowed"
              : "bg-atlas-gold text-atlas-canvas hover:bg-atlas-gold/90 border border-atlas-gold cursor-pointer"
          }`}
          aria-label="Run 400-step caravan world"
        >
          {isRunning ? (
            <>
              <span className="inline-block animate-spin" aria-hidden="true">⏳</span>
              <span>Running 400-step simulation…</span>
            </>
          ) : (
            <>
              <span aria-hidden="true">🐪</span>
              <span>Run 400-step caravan world</span>
            </>
          )}
        </button>
        {result && (
          <span className="font-mono text-xs text-atlas-ink-muted">
            {result.rows.length} {result.rows.length === 1 ? "caravan" : "caravans"} executed
          </span>
        )}
      </div>

      {/* Live Region for Screen Readers & Status */}
      <div aria-live="polite" role="status" aria-atomic="true">
        {isRunning && (
          <p className="text-xs font-mono text-atlas-ink-muted">
            Running 400 steps of inter-city caravan simulation…
          </p>
        )}
        {error && (
          <div className="p-3 rounded-xs font-mono text-xs border border-atlas-alert bg-atlas-alert/20 text-atlas-alert">
            Simulation error: {error}
          </div>
        )}
      </div>

      {/* Summary Tiles: Dino Vale exports & Elf Grove imports */}
      {result && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3.5 rounded-xs border border-atlas-line bg-atlas-surface-raised space-y-1.5">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="font-semibold text-atlas-gold">Dino Vale exports</span>
              <span className="text-[11px] text-atlas-ink-muted">Seller</span>
            </div>
            <div className="text-lg sm:text-xl font-display font-bold text-atlas-ink">
              {result.totalExported.toString()} {result.item}
            </div>
            <div className="text-xs font-mono text-atlas-ink-muted">
              Revenue received: <span className="text-atlas-gold font-semibold">+{result.totalCoinTraded.toString()} coin</span>
            </div>
            <div className="text-[11px] font-mono text-atlas-ash pt-1 border-t border-atlas-line/40">
              Treasury: {result.finalTreasury["city-dino_vale"].toString()} coin
            </div>
          </div>

          <div className="p-3.5 rounded-xs border border-atlas-line bg-atlas-surface-raised space-y-1.5">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="font-semibold text-atlas-gold">Elf Grove imports</span>
              <span className="text-[11px] text-atlas-ink-muted">Buyer</span>
            </div>
            <div className="text-lg sm:text-xl font-display font-bold text-atlas-ink">
              {result.totalImported.toString()} {result.item}
            </div>
            <div className="text-xs font-mono text-atlas-ink-muted">
              Treasury paid: <span className="text-atlas-ember font-semibold">-{result.totalCoinTraded.toString()} coin</span>
            </div>
            <div className="text-[11px] font-mono text-atlas-ash pt-1 border-t border-atlas-line/40">
              Treasury: {result.finalTreasury["city-elf_grove"].toString()} coin
            </div>
          </div>
        </div>
      )}

      {/* Caravans Table */}
      {result && (
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between text-xs font-mono text-atlas-ink-muted">
            <span>Caravan trade ledger</span>
            <span>Route: Dino Vale ➔ Elf Grove</span>
          </div>

          {result.rows.length > 0 ? (
            <div
              tabIndex={0}
              role="region"
              aria-label="Inter-city caravan transactions ledger"
              className="overflow-x-auto border border-atlas-line rounded-xs atlas-focus"
            >
              <table className="w-full text-left font-mono text-xs divide-y divide-atlas-line min-w-[320px]">
                <caption className="sr-only">Inter-city caravan transactions ledger</caption>
                <thead className="bg-atlas-surface-raised text-atlas-ink-muted uppercase text-[10px] tracking-wider">
                  <tr>
                    <th scope="col" className="px-3 py-2">Step</th>
                    <th scope="col" className="px-3 py-2">Item</th>
                    <th scope="col" className="px-3 py-2 text-right">Qty</th>
                    <th scope="col" className="px-3 py-2 text-right">Price</th>
                    <th scope="col" className="px-3 py-2 text-right">Coin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-atlas-line/50 bg-atlas-canvas">
                  {result.rows.map((row, idx) => (
                    <tr
                      key={`${row.step}-${idx}`}
                      className="hover:bg-atlas-surface-raised/50 transition-colors"
                    >
                      <td className="px-3 py-2 text-atlas-ink font-semibold">{row.step}</td>
                      <td className="px-3 py-2 text-atlas-gold">{row.item}</td>
                      <td className="px-3 py-2 text-right text-atlas-ink">{row.qty.toString()}</td>
                      <td className="px-3 py-2 text-right text-atlas-ink">{row.unitPrice.toString()}</td>
                      <td className="px-3 py-2 text-right font-semibold text-atlas-gold">
                        {row.coin.toString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div role="status" className="p-3 text-center rounded-xs bg-atlas-canvas/50 border border-dashed border-atlas-line text-xs font-mono text-atlas-ash">
              No caravans were dispatched during the simulation.
            </div>
          )}
        </div>
      )}

      {/* Initial empty state */}
      {!result && !isRunning && !error && (
        <div role="status" className="p-4 text-center rounded-xs bg-atlas-canvas/50 border border-dashed border-atlas-line text-xs font-mono text-atlas-ash leading-relaxed">
          Click &quot;Run 400-step caravan world&quot; above to simulate inter-city food shipments from Dino Vale to Elf Grove and verify economic conservation in your browser.
        </div>
      )}
    </section>
  );
}
