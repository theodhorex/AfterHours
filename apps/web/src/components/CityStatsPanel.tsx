"use client";

import React, { useMemo } from "react";
import type { CityView } from "../lib/sim-view.ts";
import { computeCityNeeds } from "../lib/city-needs.ts";
import { LedgerPage } from "./ui/LedgerPage.tsx";
import { TickNumber } from "./ui/TickNumber.tsx";
import { WorldSpecialties } from "./WorldSpecialties.tsx";
import { formatCoin, formatCount } from "../lib/format.ts";

export interface CityStatsPanelProps {
  city: CityView | null;
  loading?: boolean;
}

export function CityStatsPanel({ city, loading = false }: CityStatsPanelProps) {
  const summary = useMemo(() => {
    if (!city) return null;
    return computeCityNeeds(city);
  }, [city]);

  if (loading) {
    return (
      <LedgerPage title="City Statistics" headingLevel="h2">
        <div
          role="status"
          aria-live="polite"
          aria-busy="true"
          className="py-16 text-center border-t border-b border-ledger-ink-faded/20 bg-ledger-paper-shade/20"
        >
          <p className="font-mono text-sm text-ledger-ink-faded animate-pulse">
            Auditing civic registers and tallying storehouses…
          </p>
        </div>
      </LedgerPage>
    );
  }

  if (!city || !summary) {
    return (
      <LedgerPage title="City Statistics" headingLevel="h2">
        <div
          role="status"
          className="py-16 px-4 text-center border-t border-b border-ledger-ink-faded/20 bg-ledger-paper-shade/20"
        >
          <h3 className="font-display text-base font-bold text-ledger-ink mb-1">
            No statistics recorded
          </h3>
          <p className="font-body text-sm text-ledger-ink-faded max-w-md mx-auto">
            Establish a municipal charter and advance the world simulation to tally citizen needs and storehouse reserves.
          </p>
        </div>
      </LedgerPage>
    );
  }

  return (
    <LedgerPage
      title="City Statistics"
      headingLevel="h2"
      headerRight={
        <div className="flex items-center gap-3 font-mono text-xs text-ledger-ink-faded">
          <span>{city.name}</span>
          <span className="hidden sm:inline">•</span>
          <span className="hidden sm:inline">Year {city.year}, {city.season}</span>
        </div>
      }
    >
      {/* Civic Satisfaction and Overview */}
      <section
        aria-label="Civic satisfaction summary"
        className="mb-8 p-4 sm:p-5 border border-ledger-ink-faded/30 bg-ledger-paper-shade/30 rounded-xs flex flex-wrap items-center justify-between gap-6"
      >
        <div>
          <h3 className="font-silk text-xs uppercase tracking-wider text-ledger-ink-faded mb-1">
            Overall citizen satisfaction
          </h3>
          <div className="flex items-baseline gap-3">
            <span className="text-3xl sm:text-4xl font-mono font-bold text-ledger-ink">
              <TickNumber
                value={summary.satisfactionPct}
                format={(n) => `${n}%`}
              />
            </span>
            <span className="font-mono text-xs text-ledger-ink-faded">
              ({summary.satisfactionBps} basis points)
            </span>
          </div>
          <p className="font-body text-xs text-ledger-ink-faded mt-1">
            Weighted index derived from civic dietary, housing, occupational, and luxury consumption.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-ledger-ink-faded border-t sm:border-t-0 sm:border-l border-ledger-ink-faded/20 pt-3 sm:pt-0 sm:pl-6">
          <div>
            <span className="block text-[11px] text-ledger-ink-faded font-silk uppercase">Population</span>
            <span className="text-sm font-bold text-ledger-ink">{formatCount(city.citizens.population)}</span>
          </div>
          <div>
            <span className="block text-[11px] text-ledger-ink-faded font-silk uppercase">Stage</span>
            <span className="text-sm font-bold text-ledger-ink">{city.stage_name}</span>
          </div>
          <div>
            <span className="block text-[11px] text-ledger-ink-faded font-silk uppercase">Citizen purse</span>
            <span className="text-sm font-bold text-ledger-ink">{formatCoin(city.citizens.purse)}</span>
          </div>
        </div>
      </section>

      {/* Citizen Needs Table */}
      <section aria-labelledby="needs-heading" className="mb-8">
        <h3 id="needs-heading" className="font-display text-lg font-bold text-ledger-ink mb-2">
          Citizen needs
        </h3>
        <p className="font-body text-xs text-ledger-ink-faded mb-4">
          Coverage of core civic essentials. Fulfillment bars indicate current supply relative to population consumption.
        </p>

        <div
          tabIndex={0}
          role="region"
          aria-label="Citizen needs fulfillment ledger"
          className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-ledger-brass"
        >
          <table className="w-full text-left font-mono text-xs border-collapse min-w-[560px]">
            <caption className="sr-only">Citizen Needs Coverage and Shortfalls</caption>
            <thead>
              <tr className="border-b-2 border-ledger-ink/20 text-ledger-ink-faded font-silk text-[11px] uppercase tracking-wider">
                <th scope="col" className="py-2.5 px-3 min-w-[100px]">
                  Need
                </th>
                <th scope="col" className="py-2.5 px-3 min-w-[200px]">
                  Coverage
                </th>
                <th scope="col" className="py-2.5 px-3 min-w-[130px]">
                  Shortfall item
                </th>
                <th scope="col" className="py-2.5 px-3">
                  Description
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ledger-ink/10">
              {summary.needs.map((item) => {
                const isFullyCovered = item.coverage >= 100;

                return (
                  <tr key={item.need} className="hover:bg-ledger-paper-shade/40 transition-colors">
                    <td className="py-3 px-3">
                      <span className="font-body font-bold text-sm text-ledger-ink block">
                        {item.label}
                      </span>
                      <span className="font-mono text-[10px] text-ledger-ink-faded">
                        key: {item.need}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      {/* Bar is NEVER colour-only: includes explicit text and high-contrast numerical progress */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-mono">
                          <span className="font-bold text-ledger-ink">
                            {item.coverage}%
                          </span>
                          <span className="text-[10px] text-ledger-ink-faded">
                            {isFullyCovered ? "Fully satisfied" : "Deficit observed"}
                          </span>
                        </div>
                        <div
                          role="progressbar"
                          aria-valuenow={item.coverage}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`${item.label} coverage: ${item.coverage}%`}
                          className="h-3 w-full bg-ledger-paper-shade/70 border border-ledger-ink-faded/40 p-0.5 relative overflow-hidden"
                        >
                          <div
                            className={`h-full transition-all duration-300 ${
                              isFullyCovered
                                ? "bg-ledger-verdigris"
                                : item.coverage >= 50
                                ? "bg-ledger-brass"
                                : "bg-ledger-wax"
                            }`}
                            style={{ width: `${Math.min(100, item.coverage)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      {item.shortfallItem ? (
                        <div className="inline-flex items-center gap-1.5 px-2 py-1 border border-ledger-wax/40 bg-ledger-wax/10 text-ledger-wax font-mono text-xs font-semibold">
                          <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-ledger-wax" />
                          <span>{item.shortfallItem}</span>
                        </div>
                      ) : (
                        <span className="text-ledger-ink-faded font-body italic text-xs">
                          None (sufficient)
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 font-body text-xs text-ledger-ink-faded">
                      {item.description}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Market Imbalances: In Demand & Oversupplied Lists */}
      <section aria-label="Market commodity balances" className="mb-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* In Demand */}
        <div className="border border-ledger-ink-faded/30 bg-ledger-paper/40 p-4 sm:p-5">
          <header className="border-b border-ledger-ink-faded/20 pb-3 mb-3 flex items-baseline justify-between gap-2">
            <div>
              <h3 className="font-display text-base font-bold text-ledger-ink">
                In demand commodities
              </h3>
              <p className="font-body text-xs text-ledger-ink-faded">
                Commodities with prices above base or inventories below target reserves.
              </p>
            </div>
            <span className="font-mono text-xs text-ledger-ink-faded">
              {summary.inDemand.length} {summary.inDemand.length === 1 ? "item" : "items"}
            </span>
          </header>

          {summary.inDemand.length === 0 ? (
            <p className="font-body text-xs text-ledger-ink-faded py-6 text-center italic">
              No commodities are currently facing shortage or elevated prices.
            </p>
          ) : (
            <ul role="list" className="divide-y divide-ledger-ink/10">
              {summary.inDemand.map((item) => (
                <li key={item.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-baseline justify-between gap-2 mb-1">
                    <span className="font-body font-bold text-sm text-ledger-ink">
                      {item.name}
                    </span>
                    <div className="font-mono text-xs text-right">
                      <span className="font-bold text-ledger-wax">{formatCoin(item.price)}</span>
                      <span className="text-ledger-ink-faded text-[11px] ml-1.5">
                        (base: {item.basePrice})
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs font-mono text-ledger-ink-faded">
                    <span>Stock: {formatCount(item.stock)} / Target: {formatCount(item.target)}</span>
                    <span className="text-[11px] text-ledger-wax">High demand</span>
                  </div>
                  <p className="font-body text-xs text-ledger-ink-faded mt-1 leading-snug">
                    {item.reason}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Oversupplied */}
        <div className="border border-ledger-ink-faded/30 bg-ledger-paper/40 p-4 sm:p-5">
          <header className="border-b border-ledger-ink-faded/20 pb-3 mb-3 flex items-baseline justify-between gap-2">
            <div>
              <h3 className="font-display text-base font-bold text-ledger-ink">
                Oversupplied commodities
              </h3>
              <p className="font-body text-xs text-ledger-ink-faded">
                Commodities where current stock significantly exceeds consumption targets.
              </p>
            </div>
            <span className="font-mono text-xs text-ledger-ink-faded">
              {summary.oversupplied.length} {summary.oversupplied.length === 1 ? "item" : "items"}
            </span>
          </header>

          {summary.oversupplied.length === 0 ? (
            <p className="font-body text-xs text-ledger-ink-faded py-6 text-center italic">
              No storehouses currently hold excess inventories above target reserves.
            </p>
          ) : (
            <ul role="list" className="divide-y divide-ledger-ink/10">
              {summary.oversupplied.map((item) => (
                <li key={item.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-baseline justify-between gap-2 mb-1">
                    <span className="font-body font-bold text-sm text-ledger-ink">
                      {item.name}
                    </span>
                    <div className="font-mono text-xs text-right">
                      <span className="font-bold text-ledger-verdigris">{formatCoin(item.price)}</span>
                      <span className="text-ledger-ink-faded text-[11px] ml-1.5">
                        (base: {item.basePrice})
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs font-mono text-ledger-ink-faded">
                    <span>Stock: {formatCount(item.stock)} / Target: {formatCount(item.target)}</span>
                    <span className="text-[11px] text-ledger-verdigris">Surplus</span>
                  </div>
                  <p className="font-body text-xs text-ledger-ink-faded mt-1 leading-snug">
                    {item.reason}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* World Specialties Card */}
      <section aria-label="Realm specialties ledger entry" className="pt-2 border-t border-ledger-ink-faded/20">
        <WorldSpecialties arcId={city.arc_id} />
      </section>
    </LedgerPage>
  );
}

export default CityStatsPanel;
