"use client";

import { useMemo } from "react";
import type { CityView } from "../../lib/sim-view.ts";
import { computeCityReport } from "../../lib/city-report.ts";
import { Icon } from "./Icons.tsx";

export interface CityReportStripProps {
  city: CityView;
  initialTreasury?: number;
  initialPopulation?: number;
  className?: string;
}

export function CityReportStrip({
  city,
  initialTreasury,
  initialPopulation,
  className = "",
}: CityReportStripProps) {
  const report = useMemo(
    () => computeCityReport(city, { initialTreasury, initialPopulation }),
    [city, initialTreasury, initialPopulation]
  );

  const renderArrow = (dir: "up" | "down" | "flat") => {
    if (dir === "up") {
      return <span className="text-ledger-verdigris font-bold text-xs" aria-hidden="true">▲</span>;
    }
    if (dir === "down") {
      return <span className="text-ledger-wax font-bold text-xs" aria-hidden="true">▼</span>;
    }
    return <span className="text-ledger-brass font-bold text-xs" aria-hidden="true">■</span>;
  };

  return (
    <section
      aria-label="Municipal city progress report"
      className={`grid grid-cols-2 sm:grid-cols-4 gap-2 p-2.5 rounded-xs border border-ledger-ink-faded/30 bg-ledger-paper text-ledger-ink font-body text-xs shadow-xs ${className}`}
    >
      {/* Citizens */}
      <div className="flex items-center gap-2 p-2 rounded-xs bg-ledger-paper-shade/30 border border-ledger-ink-faded/15">
        <Icon name="scale" size={16} className="text-ledger-ink-faded shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <div className="font-silk text-[9px] uppercase tracking-wider text-ledger-ink-faded">
            Population
          </div>
          <div className="font-mono font-semibold text-xs flex items-center gap-1 truncate">
            {renderArrow(report.citizens.direction)}
            <span className="truncate">{report.citizens.label}</span>
          </div>
        </div>
      </div>

      {/* New buildings last 100 years */}
      <div className="flex items-center gap-2 p-2 rounded-xs bg-ledger-paper-shade/30 border border-ledger-ink-faded/15">
        <Icon name="anvil" size={16} className="text-ledger-ink-faded shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <div className="font-silk text-[9px] uppercase tracking-wider text-ledger-ink-faded">
            Growth (100 Yrs)
          </div>
          <div className="font-mono font-semibold text-xs flex items-center gap-1 truncate">
            {renderArrow(report.buildings100y.direction)}
            <span className="truncate">{report.buildings100y.label}</span>
          </div>
        </div>
      </div>

      {/* Businesses open / closed */}
      <div className="flex items-center gap-2 p-2 rounded-xs bg-ledger-paper-shade/30 border border-ledger-ink-faded/15">
        <Icon name="seal" size={16} className="text-ledger-ink-faded shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <div className="font-silk text-[9px] uppercase tracking-wider text-ledger-ink-faded">
            Establishments
          </div>
          <div className="font-mono font-semibold text-xs flex items-center gap-1 truncate">
            {renderArrow(report.businesses.direction)}
            <span className="truncate">{report.businesses.label}</span>
          </div>
        </div>
      </div>

      {/* Treasury change */}
      <div className="flex items-center gap-2 p-2 rounded-xs bg-ledger-paper-shade/30 border border-ledger-ink-faded/15">
        <Icon name="coin" size={16} className="text-ledger-ink-faded shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <div className="font-silk text-[9px] uppercase tracking-wider text-ledger-ink-faded">
            Civic Reserve
          </div>
          <div className="font-mono font-semibold text-xs flex items-center gap-1 truncate">
            {renderArrow(report.treasury.direction)}
            <span className="truncate">{report.treasury.label}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
