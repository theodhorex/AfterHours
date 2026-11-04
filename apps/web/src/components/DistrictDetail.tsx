"use client";

import type { Sector } from "../data/mock-city.ts";
import { formatCoin, formatCount } from "../lib/format.ts";

interface DistrictDetailProps {
  sector: Sector;
}

export function DistrictDetail({ sector }: DistrictDetailProps) {
  const openCount = sector.businesses.filter((b) => b.open && b.insolvent_steps === 0).length;
  const closedCount = sector.businesses.length - openCount;

  return (
    <div className="atlas-panel-raised rounded-sm p-4 sm:p-5" aria-live="polite">
      {/* Header */}
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-atlas-line pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs uppercase tracking-widest px-1.5 py-0.5 rounded-xs bg-atlas-gold/15 text-atlas-gold border border-atlas-gold/30">
              Sector {sector.idx}
            </span>
            <span className="font-mono text-xs text-atlas-ash uppercase tracking-wider">
              {sector.kind}
            </span>
          </div>
          <h3 className="text-lg sm:text-xl font-display font-bold text-atlas-ink mt-1">
            {sector.name}
          </h3>
        </div>

        <div className="text-xs font-mono text-atlas-ink-muted">
          <span>{openCount} active</span>
          {closedCount > 0 && (
            <span className="text-atlas-alert ml-2">• {closedCount} insolvent</span>
          )}
        </div>
      </div>

      <p className="text-sm text-atlas-ink-muted my-3 italic">
        {sector.description}
      </p>

      {/* Businesses list */}
      <div className="space-y-3 mt-4">
        <h4 className="text-xs font-mono uppercase tracking-wider text-atlas-ink font-semibold">
          Registered Establishments & Stalls ({sector.businesses.length})
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {sector.businesses.map((biz) => {
            const isOpen = biz.open && biz.insolvent_steps === 0;
            const inventoryEntries = Object.entries(biz.inventory);

            return (
              <div
                key={biz.id}
                className={`p-3 rounded-xs border transition-colors ${
                  isOpen
                    ? "bg-atlas-surface border-atlas-line hover:border-atlas-line-strong"
                    : "bg-atlas-alert/5 border-atlas-alert/40"
                }`}
              >
                {/* Biz header */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <div className="font-display font-semibold text-sm text-atlas-ink">
                      {biz.name}
                    </div>
                    <div className="text-[11px] font-mono text-atlas-ink-muted">
                      Trade: <span className="text-atlas-gold">{biz.recipe}</span>
                    </div>
                  </div>

                  {/* Status Pill */}
                  <span
                    className={`text-[10px] font-mono font-medium px-1.5 py-0.5 rounded-xs border uppercase tracking-wider ${
                      isOpen
                        ? "bg-atlas-moss/10 text-atlas-moss border-atlas-moss/30"
                        : "bg-atlas-alert/20 text-atlas-alert border-atlas-alert/50"
                    }`}
                  >
                    {isOpen ? "Open" : `Insolvent (${biz.insolvent_steps}s)`}
                  </span>
                </div>

                {/* Vault / Coin */}
                <div className="text-xs font-mono flex items-center justify-between py-1 border-t border-atlas-line/60">
                  <span className="text-atlas-ink-muted">Purse:</span>
                  <span className={biz.coin >= 0 ? "text-atlas-gold font-bold" : "text-atlas-alert font-bold"}>
                    {formatCoin(biz.coin)}
                  </span>
                </div>

                {/* Stock on hand */}
                <div className="text-xs font-mono pt-1">
                  <span className="text-atlas-ink-muted block text-[11px] mb-1">Stock on Hand:</span>
                  {inventoryEntries.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {inventoryEntries.map(([itemName, count]) => (
                        <span
                          key={itemName}
                          className="px-1.5 py-0.5 rounded-xs bg-atlas-canvas text-atlas-ink text-[11px] border border-atlas-line"
                        >
                          {itemName}: <span className="font-bold text-atlas-ink-muted">{formatCount(count)}</span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-atlas-ash italic text-[11px]">Empty inventory</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
