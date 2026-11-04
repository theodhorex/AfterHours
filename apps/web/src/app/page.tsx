"use client";

import { useState } from "react";
import { MOCK_CITY } from "../data/mock-city.ts";
import { Header } from "../components/Header.tsx";
import { AtlasMap } from "../components/AtlasMap.tsx";
import { DistrictDetail } from "../components/DistrictDetail.tsx";
import { MarketPanel } from "../components/MarketPanel.tsx";
import { ChronicleList } from "../components/ChronicleList.tsx";

export default function CityViewPage() {
  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const selectedSector = MOCK_CITY.sectors[selectedIdx] ?? MOCK_CITY.sectors[0];

  return (
    <div className="min-h-screen bg-atlas-canvas text-atlas-ink flex flex-col">
      {/* 1. Header with World Clock, Stage badge, and stats */}
      <Header city={MOCK_CITY} />

      {/* Main Layout Container: responsive from 360px with 16px gutter */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 sm:px-6 sm:py-8 space-y-6">
        {/* Intro banner */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-atlas-line pb-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-display font-bold text-atlas-ink">
              Settlement Ledger & Cavern Overview
            </h2>
            <p className="text-xs sm:text-sm text-atlas-ink-muted mt-0.5">
              Autonomous subterranean living world. Six charted sectors, open exchange markets, and historical records.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="font-mono text-xs px-2.5 py-1 rounded-xs bg-atlas-surface border border-atlas-line text-atlas-ink-muted">
              World Seed: <span className="text-atlas-gold font-bold">goblin_seed_0</span>
            </span>
          </div>
        </div>

        {/* 2-Column Responsive Grid on large screens, linear stack on mobile/tablet */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left / Primary Column: Atlas Map & District Detail */}
          <div className="lg:col-span-7 space-y-6">
            <AtlasMap
              sectors={MOCK_CITY.sectors}
              selectedIdx={selectedIdx}
              onSelectSector={setSelectedIdx}
            />

            <DistrictDetail sector={selectedSector} />
          </div>

          {/* Right / Secondary Column: Market Panel & Chronicle List */}
          <div className="lg:col-span-5 space-y-6">
            <MarketPanel items={MOCK_CITY.market} />

            <ChronicleList events={MOCK_CITY.chronicle} />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-atlas-line bg-atlas-surface/60 py-6 mt-12 text-center text-xs text-atlas-ink-muted">
        <div className="max-w-7xl mx-auto px-4 space-y-1.5">
          <p className="font-display tracking-wider text-atlas-ink font-semibold">
            AfterEarth • Goblin Warrens Arc
          </p>
          <p className="font-mono text-[11px] text-atlas-ash">
            Year 120 • Step 480 • Simulated state verification preview • No simulated network calls
          </p>
        </div>
      </footer>
    </div>
  );
}
