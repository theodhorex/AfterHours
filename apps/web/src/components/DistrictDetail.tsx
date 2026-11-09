"use client";

import type { Sector } from "../data/mock-city.ts";
import { formatCoin, formatCount } from "../lib/format.ts";
import { LedgerPage } from "./ui/LedgerPage.tsx";
import { Icon } from "./ui/Icons.tsx";

interface DistrictDetailProps {
  sector: Sector;
}

export function DistrictDetail({ sector }: DistrictDetailProps) {
  const openCount = sector.businesses.filter((b) => b.open && b.insolvent_steps === 0).length;
  const closedCount = sector.businesses.length - openCount;

  return (
    <LedgerPage
      title={sector.name}
      headingLevel="h2"
      headerRight={
        <div className="flex items-center gap-2 font-mono text-xs text-ledger-ink-faded">
          <span className="font-silk uppercase tracking-wider px-1.5 py-0.5 border border-ledger-ink-faded/30 bg-ledger-paper-shade/30">
            Sector {sector.idx}
          </span>
          <span className="capitalize">{sector.kind}</span>
        </div>
      }
    >
      <div className="space-y-6" aria-live="polite">
        {/* District Overview & Status Summary */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-ledger-ink-faded/20 pb-4">
          <p className="font-body text-xs sm:text-sm text-ledger-ink-faded italic max-w-2xl leading-relaxed">
            {sector.description}
          </p>
          <div className="font-mono text-xs text-ledger-ink shrink-0 flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5">
              <Icon name="seal" size={14} className="text-ledger-verdigris" aria-hidden="true" />
              <span>{openCount} active</span>
            </span>
            {closedCount > 0 && (
              <span className="inline-flex items-center gap-1.5 text-ledger-wax">
                <Icon name="alert" size={14} aria-hidden="true" />
                <span>{closedCount} insolvent</span>
              </span>
            )}
          </div>
        </div>

        {/* Ruled Table of Businesses */}
        <div className="space-y-2">
          <div className="flex items-center justify-between font-silk text-[11px] uppercase tracking-wider text-ledger-ink-faded">
            <span>Registered Establishments & Stalls ({sector.businesses.length})</span>
            <span>Commercial Registry</span>
          </div>

          <div
            tabIndex={0}
            role="region"
            aria-label="District establishments and stalls ledger table"
            className="overflow-x-auto border border-ledger-ink-faded/30 bg-ledger-paper-shade/20 focus-visible:outline-2 focus-visible:outline-ledger-brass"
          >
            <table className="w-full text-left font-mono text-xs border-collapse min-w-[540px]">
              <caption className="sr-only">
                District establishments and businesses ledger in {sector.name}
              </caption>
              <thead className="bg-ledger-paper-shade/40 border-b border-ledger-ink-faded/30 text-ledger-ink-faded font-silk text-[10px] uppercase tracking-wider">
                <tr>
                  <th scope="col" className="py-2.5 px-3">Establishment</th>
                  <th scope="col" className="py-2.5 px-3">Trade / Recipe</th>
                  <th scope="col" className="py-2.5 px-3">Status</th>
                  <th scope="col" className="py-2.5 px-3 text-right">Vault / Purse</th>
                  <th scope="col" className="py-2.5 px-3">Stock on Hand</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ledger-ink/10">
                {sector.businesses.map((biz) => {
                  const isOpen = biz.open && biz.insolvent_steps === 0;
                  const inventoryEntries = Object.entries(biz.inventory);

                  return (
                    <tr
                      key={biz.id}
                      className={`transition-colors ${
                        isOpen ? "hover:bg-ledger-paper-shade/50" : "bg-ledger-wax/5 hover:bg-ledger-wax/10"
                      }`}
                    >
                      {/* Name & ID */}
                      <td className="py-2.5 px-3">
                        <span className="font-body font-bold text-sm text-ledger-ink block leading-snug">
                          {biz.name}
                        </span>
                        <span className="font-mono text-[10px] text-ledger-ink-faded">
                          id: {biz.id}
                        </span>
                      </td>

                      {/* Trade / Recipe */}
                      <td className="py-2.5 px-3">
                        <span className="inline-flex items-center gap-1.5 font-body text-xs text-ledger-ink">
                          <Icon name="anvil" size={13} className="text-ledger-ink-faded" aria-hidden="true" />
                          <span>{biz.recipe}</span>
                        </span>
                      </td>

                      {/* Status: Icon plus word (never colour alone) */}
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 border text-[10px] font-silk font-bold uppercase tracking-wider ${
                            isOpen
                              ? "border-ledger-verdigris/50 bg-ledger-verdigris/10 text-ledger-verdigris"
                              : "border-ledger-wax/50 bg-ledger-wax/10 text-ledger-wax"
                          }`}
                        >
                          <Icon
                            name={isOpen ? "seal" : "alert"}
                            size={12}
                            aria-hidden="true"
                          />
                          <span>{isOpen ? "Open" : `Insolvent (${biz.insolvent_steps}s)`}</span>
                        </span>
                      </td>

                      {/* Vault / Purse */}
                      <td className="py-2.5 px-3 text-right font-mono text-xs tabular-nums font-bold">
                        <span className={biz.coin >= 0 ? "text-ledger-ink" : "text-ledger-wax"}>
                          {formatCoin(biz.coin)}
                        </span>
                      </td>

                      {/* Stock on Hand */}
                      <td className="py-2.5 px-3">
                        {inventoryEntries.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {inventoryEntries.map(([itemName, count]) => (
                              <span
                                key={itemName}
                                className="px-1.5 py-0.5 border border-ledger-ink-faded/20 bg-ledger-paper text-ledger-ink text-[11px] font-mono tabular-nums leading-none"
                              >
                                {itemName}:{" "}
                                <strong className="font-bold text-ledger-ink-faded">
                                  {formatCount(count)}
                                </strong>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-ledger-ink-faded italic text-[11px] font-body">
                            Empty inventory
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </LedgerPage>
  );
}

export default DistrictDetail;
