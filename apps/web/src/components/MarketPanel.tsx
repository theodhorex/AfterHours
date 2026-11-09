"use client";

import { useState, useEffect, useRef } from "react";
import type { MarketItem } from "../data/mock-city.ts";
import { formatCoin, formatCount } from "../lib/format.ts";
import { explainText } from "../lib/explain.ts";
import { LedgerPage } from "./ui/LedgerPage.tsx";
import { TickNumber } from "./ui/TickNumber.tsx";

interface MarketPanelProps {
  items: MarketItem[];
}

export function MarketPanel({ items }: MarketPanelProps) {
  const [activeTooltipId, setActiveTooltipId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Dismiss tooltip on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setActiveTooltipId(null);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div ref={containerRef}>
      <LedgerPage
        title="City Market"
        headingLevel="h2"
        headerRight={
          <span className="font-mono text-xs text-ledger-ink-faded">
            {items.length} {items.length === 1 ? "commodity" : "commodities"} listed
          </span>
        }
      >
        <p className="font-body text-xs sm:text-sm text-ledger-ink-faded mb-4">
          Ruled commodity ledger and mathematical price formulas. Hover any row or focus a price to inspect formula derivation. Press Esc to dismiss.
        </p>

        {items.length === 0 ? (
          <div
            role="status"
            className="py-12 px-4 text-center font-body text-sm text-ledger-ink-faded border-t border-b border-ledger-ink-faded/20"
          >
            No commodities listed; advance the simulation or establish trade routes to record prices in this ledger.
          </div>
        ) : (
          <div
            tabIndex={0}
            role="region"
            aria-label="City commodities and pricing ledger table"
            className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-ledger-brass"
          >
            <table className="w-full text-left font-mono text-xs border-collapse min-w-[500px]">
              <caption className="sr-only">City Market Commodities and Price Derivations</caption>
              <thead>
                <tr className="border-b-2 border-ledger-ink/20 text-ledger-ink-faded font-silk text-[11px] uppercase tracking-wider">
                  <th scope="col" className="py-2.5 px-3">
                    Commodity
                  </th>
                  <th scope="col" className="py-2.5 px-3 text-right">
                    Price
                  </th>
                  <th scope="col" className="py-2.5 px-3 min-w-[130px]">
                    Stock / Target
                  </th>
                  <th scope="col" className="py-2.5 px-3 text-right">
                    Trend
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ledger-ink/10">
                {items.map((item) => {
                  const stockPct = Math.min(100, Math.round((item.stock / item.target) * 100));
                  const isTooltipOpen = activeTooltipId === item.id;
                  const reasonSentence = item.tooltip ?? explainText(item.explanation);
                  const priceDelta = item.price - item.base_price;

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-ledger-paper-shade/50 transition-colors group"
                      onMouseEnter={() => setActiveTooltipId(item.id)}
                      onMouseLeave={() =>
                        setActiveTooltipId((prev) => (prev === item.id ? null : prev))
                      }
                    >
                      {/* Commodity Name & Meta */}
                      <td className="py-3 px-3">
                        <span className="font-body font-bold text-sm sm:text-base text-ledger-ink block leading-snug">
                          {item.name}
                        </span>
                        <div className="flex items-center gap-2 mt-0.5 font-mono text-[11px] text-ledger-ink-faded">
                          <span>id: {item.id}</span>
                          <span className="font-silk text-[9px] uppercase px-1 py-0.2 border border-ledger-ink-faded/30 bg-ledger-paper-shade/40 text-ledger-ink-faded leading-none">
                            {item.tier}
                          </span>
                        </div>
                      </td>

                      {/* Price with interactive explanation tooltip */}
                      <td className="py-3 px-3 text-right relative">
                        <button
                          type="button"
                          aria-haspopup="dialog"
                          aria-expanded={isTooltipOpen}
                          aria-describedby={isTooltipOpen ? `price-tooltip-${item.id}` : undefined}
                          aria-label={`Price for ${item.name}: ${formatCoin(item.price)}. Inspect mathematical derivation.`}
                          className="font-mono font-bold text-sm text-ledger-ink underline decoration-dotted decoration-ledger-ink/50 underline-offset-4 cursor-help min-h-[44px] min-w-[44px] inline-flex items-center justify-end px-2 py-1 rounded-xs hover:bg-ledger-paper-shade/80 focus-visible:outline-2 focus-visible:outline-ledger-brass"
                          onFocus={() => setActiveTooltipId(item.id)}
                          onBlur={() =>
                            setActiveTooltipId((prev) => (prev === item.id ? null : prev))
                          }
                        >
                          <TickNumber
                            value={item.price}
                            format={formatCoin}
                            className="tabular-nums"
                          />
                        </button>

                        {/* Accessible tooltip container */}
                        {isTooltipOpen && (
                          <div
                            id={`price-tooltip-${item.id}`}
                            role="tooltip"
                            aria-live="polite"
                            className="absolute right-0 bottom-full mb-1 z-40 w-72 p-3 bg-ledger-paper border-2 border-ledger-ink shadow-lg text-left text-xs font-body text-ledger-ink"
                          >
                            <div className="flex items-center justify-between border-b border-ledger-ink/20 pb-1 mb-1.5 font-mono text-[11px] text-ledger-ink-faded">
                              <span className="font-silk font-bold uppercase text-ledger-ink">
                                Formula breakdown
                              </span>
                              <span>Base: {item.base_price}c</span>
                            </div>
                            <p className="text-ledger-ink leading-relaxed">
                              {reasonSentence}
                            </p>
                            <div className="mt-2 pt-1 border-t border-ledger-ink/20 flex items-center justify-between text-[10px] font-mono text-ledger-ink-faded">
                              <span>
                                Stock: {formatCount(item.stock)} / {formatCount(item.target)}
                              </span>
                              <span className="italic">[Esc to close]</span>
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Stock vs Target with Tabular Numbers */}
                      <td className="py-3 px-3">
                        <div className="flex items-center justify-between text-[11px] font-mono text-ledger-ink-faded mb-1">
                          <span className="tabular-nums text-ledger-ink font-medium">
                            {formatCount(item.stock)}
                          </span>
                          <span className="tabular-nums">
                            Target: {formatCount(item.target)}
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-ledger-paper-shade/80 border border-ledger-ink/20 overflow-hidden">
                          <div
                            className="h-full bg-ledger-ink transition-all duration-300"
                            style={{ width: `${stockPct}%` }}
                          />
                        </div>
                      </td>

                      {/* Trend Indicator: Arrow icon + Text (never colour only) */}
                      <td className="py-3 px-3 text-right">
                        {item.change === "up" && (
                          <span
                            className="inline-flex items-center gap-1 font-mono text-xs font-bold text-ledger-ink tabular-nums"
                            title="Price above base"
                          >
                            <span aria-hidden="true">▲</span>
                            <span>+{priceDelta}</span>
                            <span className="font-body text-[11px] font-normal text-ledger-ink-faded">
                              Rising
                            </span>
                          </span>
                        )}
                        {item.change === "down" && (
                          <span
                            className="inline-flex items-center gap-1 font-mono text-xs font-bold text-ledger-ink tabular-nums"
                            title="Price below base"
                          >
                            <span aria-hidden="true">▼</span>
                            <span>{priceDelta}</span>
                            <span className="font-body text-[11px] font-normal text-ledger-ink-faded">
                              Falling
                            </span>
                          </span>
                        )}
                        {item.change === "flat" && (
                          <span
                            className="inline-flex items-center gap-1 font-mono text-xs text-ledger-ink-faded tabular-nums"
                            title="Price at base"
                          >
                            <span aria-hidden="true">—</span>
                            <span className="font-body text-[11px]">Steady</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </LedgerPage>
    </div>
  );
}
