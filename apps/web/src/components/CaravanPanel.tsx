"use client";

import { useState, useCallback } from "react";
import { buildCaravanView, type CaravanViewResult } from "../lib/caravan-view.ts";
import { LedgerPage } from "./ui/LedgerPage.tsx";
import { Icon } from "./ui/Icons.tsx";
import { TickNumber } from "./ui/TickNumber.tsx";

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
    <LedgerPage
      title="Inter-City Trade Routes & Caravans"
      headingLevel="h2"
      headerRight={
        result ? (
          <div
            role="status"
            className={`inline-flex items-center gap-1.5 px-3 py-1 border text-xs font-silk font-bold uppercase tracking-wider ${
              result.conservationOk
                ? "border-ledger-verdigris/50 bg-ledger-verdigris/10 text-ledger-verdigris"
                : "border-ledger-wax/50 bg-ledger-wax/10 text-ledger-wax"
            }`}
          >
            <Icon
              name={result.conservationOk ? "seal" : "alert"}
              size={14}
              aria-hidden="true"
            />
            <span>{result.conservationOk ? "Conservation: OK" : "Conservation: FAILED"}</span>
          </div>
        ) : (
          <span className="font-mono text-xs text-ledger-ink-faded">
            Bilateral Route: Dino Vale to Elf Grove
          </span>
        )
      }
    >
      <div className="space-y-6">
        <p className="font-body text-xs sm:text-sm text-ledger-ink-faded leading-relaxed">
          Ruled mercantile caravan manifest. Simulates bilateral exchange of staple food provisions between{" "}
          <strong className="text-ledger-ink font-semibold">Dino Vale</strong> (agricultural exporter) and{" "}
          <strong className="text-ledger-ink font-semibold">Elf Grove</strong> (importer). Physical inventory and coin balances must strictly satisfy closed-system conservation laws.
        </p>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleRunCaravan}
            disabled={isRunning}
            className={`min-h-[44px] px-5 py-2.5 font-pixel text-xs transition-colors flex items-center gap-2 cursor-pointer border focus-visible:outline-2 focus-visible:outline-ledger-brass ${
              isRunning
                ? "bg-ledger-paper-shade/40 text-ledger-ink-faded/60 border-ledger-ink-faded/20 cursor-not-allowed"
                : "bg-ledger-paper text-ledger-ink font-bold border-ledger-ink shadow-[2px_2px_0_0_var(--ledger-ink)] hover:bg-ledger-paper-shade/60 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
            }`}
            aria-label="Run 400-step caravan world simulation"
          >
            <Icon name="caravan" size={16} aria-hidden="true" />
            <span>{isRunning ? "Simulating 400-step caravan world…" : "Run 400-step caravan world"}</span>
          </button>

          {result && (
            <span className="font-mono text-xs text-ledger-ink-faded tabular-nums">
              {result.rows.length} {result.rows.length === 1 ? "caravan dispatch" : "caravans dispatched"}
            </span>
          )}
        </div>

        {/* Live Region for Screen Readers & Errors */}
        <div aria-live="polite" role="status" aria-atomic="true">
          {isRunning && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono text-ledger-ink-faded">
                <span>Running 400 steps of inter-city caravan simulation…</span>
              </div>
              <div
                role="progressbar"
                aria-label="Simulating caravan routes"
                className="w-full bg-ledger-paper-shade/60 border border-ledger-ink-faded/30 h-2 overflow-hidden"
              >
                <div className="bg-ledger-brass h-full w-3/4 animate-pulse" />
              </div>
            </div>
          )}
          {error && (
            <div className="p-3 border border-ledger-wax/40 bg-ledger-wax/10 text-ledger-wax font-mono text-xs flex items-center gap-2">
              <Icon name="alert" size={16} aria-hidden="true" />
              <span>Simulation error: {error}</span>
            </div>
          )}
        </div>

        {/* Summary Ledger Vouchers: Dino Vale exports & Elf Grove imports */}
        {result && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 border border-ledger-ink-faded/30 bg-ledger-paper-shade/20 space-y-2">
              <div className="flex items-center justify-between font-mono text-xs">
                <span className="font-bold text-ledger-ink flex items-center gap-1.5">
                  <Icon name="bread" size={14} className="text-ledger-ink-faded" aria-hidden="true" />
                  <span>Dino Vale Exports</span>
                </span>
                <span className="font-silk text-[10px] uppercase text-ledger-ink-faded border border-ledger-ink-faded/20 px-1 py-0.5">
                  Seller / Origin
                </span>
              </div>
              <div className="text-xl sm:text-2xl font-pixel text-ledger-ink font-bold tabular-nums">
                <TickNumber value={Number(result.totalExported)} />{" "}
                <span className="text-sm font-body font-normal text-ledger-ink-faded">{result.item}</span>
              </div>
              <div className="font-mono text-xs text-ledger-ink-faded">
                Revenue accrued:{" "}
                <strong className="text-ledger-ink font-bold tabular-nums">
                  +{result.totalCoinTraded.toString()} coin
                </strong>
              </div>
              <div className="font-mono text-[11px] text-ledger-ink-faded pt-2 border-t border-ledger-ink-faded/20 tabular-nums">
                Final Treasury: {result.finalTreasury["city-dino_vale"].toString()} coin
              </div>
            </div>

            <div className="p-4 border border-ledger-ink-faded/30 bg-ledger-paper-shade/20 space-y-2">
              <div className="flex items-center justify-between font-mono text-xs">
                <span className="font-bold text-ledger-ink flex items-center gap-1.5">
                  <Icon name="coin" size={14} className="text-ledger-ink-faded" aria-hidden="true" />
                  <span>Elf Grove Imports</span>
                </span>
                <span className="font-silk text-[10px] uppercase text-ledger-ink-faded border border-ledger-ink-faded/20 px-1 py-0.5">
                  Buyer / Destination
                </span>
              </div>
              <div className="text-xl sm:text-2xl font-pixel text-ledger-ink font-bold tabular-nums">
                <TickNumber value={Number(result.totalImported)} />{" "}
                <span className="text-sm font-body font-normal text-ledger-ink-faded">{result.item}</span>
              </div>
              <div className="font-mono text-xs text-ledger-ink-faded">
                Treasury paid:{" "}
                <strong className="text-ledger-wax font-bold tabular-nums">
                  -{result.totalCoinTraded.toString()} coin
                </strong>
              </div>
              <div className="font-mono text-[11px] text-ledger-ink-faded pt-2 border-t border-ledger-ink-faded/20 tabular-nums">
                Final Treasury: {result.finalTreasury["city-elf_grove"].toString()} coin
              </div>
            </div>
          </div>
        )}

        {/* Caravans Table */}
        {result && (
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between font-silk text-[11px] uppercase tracking-wider text-ledger-ink-faded">
              <span>Caravan Manifest Lines</span>
              <span>Dino Vale to Elf Grove</span>
            </div>

            {result.rows.length > 0 ? (
              <div
                tabIndex={0}
                role="region"
                aria-label="Inter-city caravan transactions ledger"
                className="overflow-x-auto border border-ledger-ink-faded/30 bg-ledger-paper-shade/20 focus-visible:outline-2 focus-visible:outline-ledger-brass"
              >
                <table className="w-full text-left font-mono text-xs border-collapse min-w-[500px]">
                  <caption className="sr-only">Inter-city caravan transactions ledger</caption>
                  <thead className="bg-ledger-paper-shade/40 border-b border-ledger-ink-faded/30 text-ledger-ink-faded font-silk text-[10px] uppercase tracking-wider">
                    <tr>
                      <th scope="col" className="py-2.5 px-3">Route</th>
                      <th scope="col" className="py-2.5 px-3 text-center">Step</th>
                      <th scope="col" className="py-2.5 px-3">Item</th>
                      <th scope="col" className="py-2.5 px-3 text-right">Quantity</th>
                      <th scope="col" className="py-2.5 px-3 text-right">Unit Price</th>
                      <th scope="col" className="py-2.5 px-3 text-right">Total Coin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ledger-ink/10">
                    {result.rows.map((row, idx) => (
                      <tr
                        key={`${row.step}-${idx}`}
                        className="hover:bg-ledger-paper-shade/50 transition-colors"
                      >
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1.5 text-ledger-ink">
                            <Icon name="caravan" size={14} className="text-ledger-ink-faded shrink-0" aria-hidden="true" />
                            <span className="font-body text-xs font-semibold">Dino Vale to Elf Grove</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-xs text-ledger-ink tabular-nums">
                          {row.step}
                        </td>
                        <td className="py-2.5 px-3 text-ledger-ink">
                          <span className="inline-flex items-center gap-1">
                            <Icon name="bread" size={12} className="text-ledger-ink-faded" aria-hidden="true" />
                            <span className="capitalize">{row.item}</span>
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-xs text-ledger-ink tabular-nums font-semibold">
                          {row.qty.toString()}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-xs text-ledger-ink-faded tabular-nums">
                          {row.unitPrice.toString()}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-xs text-ledger-ink font-bold tabular-nums">
                          {row.coin.toString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div
                role="status"
                className="p-6 text-center border border-dashed border-ledger-ink-faded/30 font-body text-xs text-ledger-ink-faded"
              >
                No caravans were dispatched during this simulation window.
              </div>
            )}
          </div>
        )}

        {/* Initial empty state */}
        {!result && !isRunning && !error && (
          <div
            role="status"
            className="p-8 text-center border border-dashed border-ledger-ink-faded/30 font-body text-xs sm:text-sm text-ledger-ink-faded leading-relaxed"
          >
            Click &quot;Run 400-step caravan world&quot; above to dispatch mercantile food caravans from Dino Vale to Elf Grove and verify economic conservation rules in your browser.
          </div>
        )}
      </div>
    </LedgerPage>
  );
}

export default CaravanPanel;
