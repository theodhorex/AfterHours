"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { LedgerPage } from "../../../components/ui/LedgerPage.tsx";
import { Icon } from "../../../components/ui/Icons.tsx";
import { GlobalMarketTable } from "../../../components/GlobalMarketTable.tsx";
import {
  buildGlobalMarketRows,
  getBestTrades,
  type GlobalMarketRow,
} from "../../../lib/global-market.ts";
import { AVAILABLE_ARCS, createWorld, advanceWorld } from "../../../lib/sim-adapter.ts";
import { stateToCityView, type CityView } from "../../../lib/sim-view.ts";
import { formatCoin } from "../../../lib/format.ts";

export default function MarketPage() {
  const [rows, setRows] = useState<GlobalMarketRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    // Yield execution to allow loading skeleton to paint
    const timer = setTimeout(() => {
      try {
        const views: Record<string, CityView> = {};
        for (const arcId of AVAILABLE_ARCS) {
          let w = createWorld(arcId, "market-sim-canonical-seed");
          w = advanceWorld(w, 40);
          views[arcId] = stateToCityView(w.state, w.arc, w.pricing);
        }
        const marketRows = buildGlobalMarketRows(views);
        if (isMounted) {
          setRows(marketRows);
          setIsLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : String(err));
          setIsLoading(false);
        }
      }
    }, 0);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, []);

  const bestTrades = useMemo(() => getBestTrades(rows, 5), [rows]);

  return (
    <main className="w-full mx-auto max-w-[1600px] p-4 sm:p-6">
      <LedgerPage
        title={
          <span className="flex items-center gap-2">
            <Icon name="scale" size={22} className="text-ledger-brass" />
            <span>Global Market</span>
          </span>
        }
        headingLevel="h1"
        headerRight={
          <span className="font-mono text-xs text-ledger-ink-faded">
            4 realms simulated &bull; Step 40
          </span>
        }
      >
        <div className="space-y-8 font-mono text-xs text-ledger-ink">
          {/* Honesty Sentence (Required: prominent, plain sentence) */}
          <div className="p-4 border border-ledger-ink/20 bg-ledger-paper-shade/30">
            <p className="font-body text-sm sm:text-base text-ledger-ink leading-relaxed">
              Prices come from the four simulated worlds. Player offers appear here when wallets list them.
            </p>
          </div>

          {/* Loading Skeleton */}
          {isLoading && (
            <div
              role="status"
              aria-live="polite"
              aria-busy="true"
              aria-label="Simulating four-world market conditions..."
              className="space-y-4"
            >
              <div className="p-4 border border-ledger-ink/10 bg-ledger-paper-shade/20 text-ledger-ink-faded font-mono text-xs animate-pulse">
                Simulating step 40 economic state across Goblin Warrens, Cave Hold, Dino Vale, and Elf Grove…
              </div>
              <div className="border border-ledger-ink/20 bg-ledger-paper divide-y divide-ledger-ink/10">
                <div className="h-11 bg-ledger-paper-shade/40" />
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-14 bg-ledger-paper animate-pulse opacity-75" />
                ))}
              </div>
            </div>
          )}

          {/* Error Notice */}
          {error && (
            <div
              role="alert"
              className="p-4 border border-ledger-wax/40 bg-ledger-wax/10 text-ledger-wax font-mono text-xs flex items-center gap-2"
            >
              <Icon name="alert" size={16} aria-hidden="true" />
              <span>Simulation error: {error}</span>
            </div>
          )}

          {!isLoading && !error && (
            <>
              {/* Best Trades Right Now (Top 5 spreads) */}
              <section aria-labelledby="best-trades-heading" className="space-y-3">
                <div className="flex items-center justify-between border-b border-ledger-ink/20 pb-2">
                  <h2
                    id="best-trades-heading"
                    className="font-silk text-xs uppercase tracking-wider text-ledger-ink font-bold flex items-center gap-2"
                  >
                    <Icon name="caravan" size={14} className="text-ledger-brass" aria-hidden="true" />
                    <span>Best trades right now</span>
                  </h2>
                  <span className="font-mono text-[11px] text-ledger-ink-faded">
                    Top 5 arbitrage spreads across realms
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
                  {bestTrades.map((trade) => {
                    const buy = trade.recommendation.buyHere;
                    const sell = trade.recommendation.sellHere;
                    if (!buy || !sell) return null;

                    return (
                      <div
                        key={trade.id}
                        className="p-3.5 border border-ledger-ink/20 bg-ledger-paper space-y-2 flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="font-body font-bold text-sm text-ledger-ink">
                              {trade.name}
                            </span>
                            <span className="font-mono text-xs font-bold text-ledger-verdigris tabular-nums">
                              ▲ +{trade.spreadPct}%
                            </span>
                          </div>
                          <div className="font-silk text-[9px] uppercase tracking-wider text-ledger-ink-faded mb-2">
                            Margin: +{trade.spreadAbsolute} coin/unit
                          </div>
                          <div className="space-y-1 font-mono text-[11px] text-ledger-ink-faded border-t border-ledger-ink/10 pt-2">
                            <div className="flex items-center justify-between">
                              <span>Buy ({buy.worldName}):</span>
                              <strong className="text-ledger-ink font-medium tabular-nums">
                                {formatCoin(buy.price)}
                              </strong>
                            </div>
                            <div className="flex items-center justify-between">
                              <span>Sell ({sell.worldName}):</span>
                              <strong className="text-ledger-ink font-medium tabular-nums">
                                {formatCoin(sell.price)}
                              </strong>
                            </div>
                          </div>
                        </div>
                        <p className="font-body text-[11px] text-ledger-ink-faded pt-2 border-t border-ledger-ink/10 leading-snug">
                          {trade.recommendation.summary}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Main Four-World Commodity Market Table */}
              <section aria-labelledby="all-markets-heading" className="space-y-3">
                <div className="flex items-center justify-between border-b border-ledger-ink/20 pb-2">
                  <h2
                    id="all-markets-heading"
                    className="font-silk text-xs uppercase tracking-wider text-ledger-ink font-bold"
                  >
                    Four-world commodity ledger
                  </h2>
                  <span className="font-mono text-[11px] text-ledger-ink-faded">
                    Side-by-side pricing, supply levels, and trade advice
                  </span>
                </div>

                <GlobalMarketTable
                  rows={rows}
                  caption="Four worlds global commodity market prices, supply status, and inter-realm spreads"
                />
              </section>

              {/* Player Offers Empty State */}
              <section
                aria-labelledby="player-offers-heading"
                className="p-6 border border-dashed border-ledger-ink/30 bg-ledger-paper-shade/20 text-center space-y-3"
              >
                <div className="inline-flex items-center justify-center w-10 h-10 border border-ledger-ink/20 bg-ledger-paper text-ledger-ink-faded mx-auto">
                  <Icon name="scroll" size={18} aria-hidden="true" />
                </div>
                <h2
                  id="player-offers-heading"
                  className="font-silk text-xs uppercase tracking-wider text-ledger-ink font-bold"
                >
                  Player offers
                </h2>
                <p className="font-body text-sm text-ledger-ink-faded max-w-lg mx-auto leading-relaxed">
                  No player offers yet. Cities listed on the exchange will appear here.
                </p>
                <div className="pt-1">
                  <Link
                    href="/atlas/exchange"
                    className="inline-flex items-center justify-center min-h-[44px] px-5 py-2 font-mono text-xs font-bold text-ledger-ink bg-ledger-paper border border-ledger-ink shadow-[2px_2px_0_0_var(--ledger-ink)] hover:bg-ledger-paper-shade/60 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none focus-visible:outline-2 focus-visible:outline-ledger-brass"
                  >
                    Go to exchange
                  </Link>
                </div>
              </section>
            </>
          )}
        </div>
      </LedgerPage>
    </main>
  );
}
