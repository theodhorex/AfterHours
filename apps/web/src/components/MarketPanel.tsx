"use client";

import { useState, useEffect, useRef } from "react";
import type { MarketItem } from "../data/mock-city.ts";
import { formatCoin, formatCount } from "../lib/format.ts";
import { explainText } from "../lib/explain.ts";

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
    <div ref={containerRef} className="atlas-panel rounded-sm p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-atlas-line pb-3 mb-4">
        <div>
          <h2 className="text-base sm:text-lg font-display font-semibold text-atlas-ink">
            City Market & Pricing Formula
          </h2>
          <p className="text-xs text-atlas-ink-muted">
            Hover or focus any price to inspect the mathematical price derivation. Press Esc to dismiss tooltip.
          </p>
        </div>
        <div className="text-xs font-mono text-atlas-ink-muted">
          12 Commodities Listed
        </div>
      </div>

      {/* Market table with labelled horizontal scroll container */}
      <div
        tabIndex={0}
        role="region"
        aria-label="City commodities and pricing table"
        className="overflow-x-auto atlas-focus rounded-xs"
      >
        <table className="w-full text-left font-mono text-xs border-collapse min-w-[420px]">
          <caption className="sr-only">City Market Commodities and Price Derivations</caption>
          <thead>
            <tr className="border-b border-atlas-line-strong text-atlas-ink-muted uppercase tracking-wider text-[11px]">
              <th scope="col" className="py-2.5 px-2">Commodity</th>
              <th scope="col" className="py-2.5 px-2 text-right">Price</th>
              <th scope="col" className="py-2.5 px-2 text-center">Trend</th>
              <th scope="col" className="py-2.5 px-2 min-w-[120px]">Stock / Target</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-atlas-line/60">
            {items.map((item) => {
              const stockPct = Math.min(100, Math.round((item.stock / item.target) * 100));
              const isTooltipOpen = activeTooltipId === item.id;
              const reasonSentence = item.tooltip ?? explainText(item.explanation);

              return (
                <tr
                  key={item.id}
                  className="hover:bg-atlas-surface-raised/40 transition-colors"
                >
                  {/* Name */}
                  <td className="py-2.5 px-2">
                    <span className="font-display font-medium text-sm text-atlas-ink block">
                      {item.name}
                    </span>
                    <span className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] text-atlas-ash font-mono">
                        id: {item.id}
                      </span>
                      <span className="px-1.5 py-0.5 rounded-xs text-[10px] uppercase tracking-wide border border-atlas-line bg-atlas-canvas text-atlas-ink-muted">
                        {item.tier}
                      </span>
                    </span>
                  </td>

                  {/* Price with interactive tooltip */}
                  <td className="py-2.5 px-2 text-right relative">
                    <button
                      type="button"
                      aria-haspopup="dialog"
                      aria-expanded={isTooltipOpen}
                      aria-describedby={isTooltipOpen ? `price-tooltip-${item.id}` : undefined}
                      aria-label={`Price for ${item.name}: ${formatCoin(item.price)}. Inspect mathematical derivation.`}
                      className="font-bold text-atlas-gold underline decoration-dotted decoration-atlas-gold/60 underline-offset-4 cursor-help atlas-focus px-1.5 py-1 rounded-xs hover:text-atlas-ink hover:bg-atlas-surface-raised min-h-[44px] min-w-[44px] inline-flex items-center justify-end sm:min-h-0 sm:min-w-0"
                      onMouseEnter={() => setActiveTooltipId(item.id)}
                      onMouseLeave={() => setActiveTooltipId((prev) => (prev === item.id ? null : prev))}
                      onFocus={() => setActiveTooltipId(item.id)}
                      onBlur={() => setActiveTooltipId((prev) => (prev === item.id ? null : prev))}
                    >
                      {formatCoin(item.price)}
                    </button>

                    {/* Accessible tooltip container */}
                    {isTooltipOpen && (
                      <div
                        id={`price-tooltip-${item.id}`}
                        role="tooltip"
                        aria-live="polite"
                        className="absolute right-0 bottom-full mb-1 z-40 w-64 p-2.5 rounded-xs bg-atlas-surface-raised border border-atlas-gold text-atlas-ink shadow-xl text-left font-sans text-xs animate-in fade-in zoom-in-95 duration-150"
                      >
                        <div className="flex items-center justify-between border-b border-atlas-line pb-1 mb-1.5 font-mono text-[10px] text-atlas-ink-muted">
                          <span className="font-bold text-atlas-gold uppercase tracking-wider">
                            Formula Breakdown
                          </span>
                          <span>Base: {item.base_price}c</span>
                        </div>
                        <p className="text-atlas-ink leading-relaxed">
                          {reasonSentence}
                        </p>
                        <div className="mt-2 pt-1 border-t border-atlas-line/60 flex items-center justify-between text-[10px] font-mono text-atlas-ink-muted">
                          <span>Stock: {formatCount(item.stock)} / {formatCount(item.target)}</span>
                          <span className="text-atlas-ash">[Esc to close]</span>
                        </div>
                      </div>
                    )}
                  </td>

                  {/* Trend Indicator */}
                  <td className="py-2.5 px-2 text-center">
                    {item.change === "up" && (
                      <span className="inline-flex items-center gap-0.5 text-atlas-ember font-bold" title="Price above base">
                        ▲ <span className="text-[10px]">+{item.price - item.base_price}</span>
                      </span>
                    )}
                    {item.change === "down" && (
                      <span className="inline-flex items-center gap-0.5 text-atlas-moss font-bold" title="Price below base">
                        ▼ <span className="text-[10px]">-{item.base_price - item.price}</span>
                      </span>
                    )}
                    {item.change === "flat" && (
                      <span className="text-atlas-ink-muted font-bold" title="Price at base">
                        —
                      </span>
                    )}
                  </td>

                  {/* Stock vs Target Bar */}
                  <td className="py-2.5 px-2">
                    <div className="flex items-center justify-between text-[10px] text-atlas-ink-muted mb-1">
                      <span>{formatCount(item.stock)}</span>
                      <span>Target: {formatCount(item.target)}</span>
                    </div>
                    <div className="w-full h-1.5 bg-atlas-canvas rounded-full overflow-hidden border border-atlas-line">
                      <div
                        className={`h-full transition-all duration-300 ${
                          stockPct < 50
                            ? "bg-atlas-ember"
                            : stockPct < 85
                              ? "bg-atlas-gold"
                              : "bg-atlas-moss"
                        }`}
                        style={{ width: `${stockPct}%` }}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
