"use client";

import { useState, useMemo } from "react";
import type { GlobalMarketRow, SupplyStatus } from "../lib/global-market.ts";
import { WORLD_NAMES } from "../lib/global-market.ts";
import { formatCoin } from "../lib/format.ts";
import { Icon } from "./ui/Icons.tsx";

interface GlobalMarketTableProps {
  rows: GlobalMarketRow[];
  caption?: string;
}

type SortColumn = "item" | "goblin_warrens" | "cave_hold" | "dino_vale" | "elf_grove" | "spread";
type FilterCategory = "all" | "raw" | "processed";

const WORLD_KEYS = ["goblin_warrens", "cave_hold", "dino_vale", "elf_grove"] as const;

function SupplyBadge({ status }: { status: SupplyStatus | null }) {
  if (!status) {
    return <span className="font-body text-[11px] text-ledger-ink-faded/60">—</span>;
  }

  if (status === "short") {
    return (
      <span
        className="inline-flex items-center gap-1 font-mono text-[10px] text-ledger-wax uppercase tracking-wider"
        title="Shortage: stock is below 80% consumption target"
      >
        <Icon name="alert" size={11} aria-hidden="true" />
        <span>Short</span>
      </span>
    );
  }

  if (status === "plenty") {
    return (
      <span
        className="inline-flex items-center gap-1 font-mono text-[10px] text-ledger-verdigris uppercase tracking-wider"
        title="Surplus: stock exceeds 120% consumption target"
      >
        <Icon name="seal" size={11} aria-hidden="true" />
        <span>Plenty</span>
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1 font-mono text-[10px] text-ledger-ink-faded uppercase tracking-wider"
      title="Balanced: stock within 80% to 120% target"
    >
      <Icon name="scale" size={11} aria-hidden="true" />
      <span>Balanced</span>
    </span>
  );
}

export function GlobalMarketTable({ rows, caption }: GlobalMarketTableProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterCategory>("all");
  const [sortCol, setSortCol] = useState<SortColumn>("spread");
  const [sortAsc, setSortAsc] = useState(false);

  function handleSort(col: SortColumn) {
    if (sortCol === col) {
      setSortAsc(!sortAsc);
    } else {
      setSortCol(col);
      // Default to ascending for item names, descending for prices/spread
      setSortAsc(col === "item");
    }
  }

  // Filter rows by search query and category
  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      // Category filter
      if (filter === "raw" && r.category !== "raw") return false;
      if (filter === "processed" && r.category !== "processed") return false;

      // Search filter
      if (q) {
        const matchesName = r.name.toLowerCase().includes(q);
        const matchesId = r.id.toLowerCase().includes(q);
        if (!matchesName && !matchesId) return false;
      }

      return true;
    });
  }, [rows, query, filter]);

  // Sort filtered rows
  const sortedRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      let comparison = 0;

      if (sortCol === "item") {
        comparison = a.name.localeCompare(b.name);
      } else if (sortCol === "spread") {
        comparison = b.spreadPct - a.spreadPct || b.spreadAbsolute - a.spreadAbsolute;
        if (sortAsc) comparison = -comparison;
        return comparison;
      } else {
        const pA = a.worlds[sortCol]?.price;
        const pB = b.worlds[sortCol]?.price;

        if (pA === null && pB === null) comparison = 0;
        else if (pA === null) comparison = 1;
        else if (pB === null) comparison = -1;
        else comparison = pA - pB;
      }

      return sortAsc ? comparison : -comparison;
    });
  }, [filteredRows, sortCol, sortAsc]);

  const rawCount = useMemo(() => rows.filter((r) => r.category === "raw").length, [rows]);
  const processedCount = useMemo(() => rows.filter((r) => r.category === "processed").length, [rows]);

  function getAriaSort(col: SortColumn): "ascending" | "descending" | "none" {
    if (sortCol !== col) return "none";
    return sortAsc ? "ascending" : "descending";
  }

  function renderSortArrow(col: SortColumn) {
    if (sortCol !== col) {
      return <span aria-hidden="true" className="text-ledger-ink-faded/40">↕</span>;
    }
    return <span aria-hidden="true" className="text-ledger-ink font-bold">{sortAsc ? "▲" : "▼"}</span>;
  }

  return (
    <div className="space-y-4">
      {/* Controls: Search Box and Filter Chips */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-2 border-b border-ledger-ink/10">
        {/* Search input with 44px min-height */}
        <div className="relative flex-1 max-w-sm">
          <label htmlFor="global-market-search" className="sr-only">
            Find an item
          </label>
          <input
            id="global-market-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find an item…"
            className="w-full min-h-[44px] px-3 py-2 bg-ledger-paper border border-ledger-ink/30 text-ledger-ink font-mono text-xs placeholder:text-ledger-ink-faded/60 focus-visible:outline-2 focus-visible:outline-ledger-brass"
          />
        </div>

        {/* Filter chips with 44px targets */}
        <div
          role="group"
          aria-label="Filter goods by type"
          className="flex items-center gap-1.5 flex-wrap"
        >
          <button
            type="button"
            onClick={() => setFilter("all")}
            aria-pressed={filter === "all"}
            className={`min-h-[44px] px-3.5 py-2 font-silk text-xs uppercase tracking-wider border cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-ledger-brass ${
              filter === "all"
                ? "bg-ledger-ink text-ledger-paper border-ledger-ink font-bold"
                : "bg-ledger-paper text-ledger-ink-faded border-ledger-ink/20 hover:bg-ledger-paper-shade/40"
            }`}
          >
            All ({rows.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("raw")}
            aria-pressed={filter === "raw"}
            className={`min-h-[44px] px-3.5 py-2 font-silk text-xs uppercase tracking-wider border cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-ledger-brass ${
              filter === "raw"
                ? "bg-ledger-ink text-ledger-paper border-ledger-ink font-bold"
                : "bg-ledger-paper text-ledger-ink-faded border-ledger-ink/20 hover:bg-ledger-paper-shade/40"
            }`}
          >
            Raw goods ({rawCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter("processed")}
            aria-pressed={filter === "processed"}
            className={`min-h-[44px] px-3.5 py-2 font-silk text-xs uppercase tracking-wider border cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-ledger-brass ${
              filter === "processed"
                ? "bg-ledger-ink text-ledger-paper border-ledger-ink font-bold"
                : "bg-ledger-paper text-ledger-ink-faded border-ledger-ink/20 hover:bg-ledger-paper-shade/40"
            }`}
          >
            Processed goods ({processedCount})
          </button>
        </div>
      </div>

      {/* Ruled Ledger Table */}
      <div
        tabIndex={0}
        role="region"
        aria-label="Four worlds global commodity market ledger"
        className="overflow-x-auto border border-ledger-ink/20 bg-ledger-paper focus-visible:outline-2 focus-visible:outline-ledger-brass"
      >
        <table className="w-full text-left font-mono text-xs border-collapse min-w-[840px]">
          <caption className="sr-only">
            {caption ?? "Four worlds global commodity market prices, supply status, and inter-realm spreads"}
          </caption>
          <thead>
            <tr className="bg-ledger-paper-shade/30 border-b-2 border-ledger-ink/20 text-ledger-ink-faded font-silk text-[11px] uppercase tracking-wider">
              {/* Item Column */}
              <th scope="col" aria-sort={getAriaSort("item")} className="p-0">
                <button
                  type="button"
                  onClick={() => handleSort("item")}
                  className="w-full min-h-[44px] px-3 py-2.5 flex items-center justify-between gap-1 text-left cursor-pointer hover:bg-ledger-paper-shade/50 focus-visible:outline-2 focus-visible:outline-ledger-brass"
                >
                  <span className="font-bold text-ledger-ink">Commodity</span>
                  {renderSortArrow("item")}
                </button>
              </th>

              {/* 4 World Columns */}
              {WORLD_KEYS.map((key) => (
                <th key={key} scope="col" aria-sort={getAriaSort(key)} className="p-0">
                  <button
                    type="button"
                    onClick={() => handleSort(key)}
                    className="w-full min-h-[44px] px-3 py-2.5 flex items-center justify-between gap-1 text-right cursor-pointer hover:bg-ledger-paper-shade/50 focus-visible:outline-2 focus-visible:outline-ledger-brass"
                  >
                    <span className="font-bold text-ledger-ink">{WORLD_NAMES[key]}</span>
                    {renderSortArrow(key)}
                  </button>
                </th>
              ))}

              {/* Spread Column */}
              <th scope="col" aria-sort={getAriaSort("spread")} className="p-0">
                <button
                  type="button"
                  onClick={() => handleSort("spread")}
                  className="w-full min-h-[44px] px-3 py-2.5 flex items-center justify-between gap-1 text-right cursor-pointer hover:bg-ledger-paper-shade/50 focus-visible:outline-2 focus-visible:outline-ledger-brass"
                >
                  <span className="font-bold text-ledger-ink">Spread</span>
                  {renderSortArrow("spread")}
                </button>
              </th>

              {/* Trade Suggestion */}
              <th scope="col" className="px-3 py-2.5 text-left font-bold text-ledger-ink">
                Trade Advice
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-ledger-ink/10">
            {sortedRows.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="p-8 text-center font-body text-sm text-ledger-ink-faded"
                >
                  No commodities match the query &ldquo;{query}&rdquo;.
                </td>
              </tr>
            ) : (
              sortedRows.map((row) => (
                <tr
                  key={row.id}
                  className="hover:bg-ledger-paper-shade/40 transition-colors"
                >
                  {/* Commodity Name & Meta */}
                  <td className="py-2.5 px-3">
                    <span className="font-body font-bold text-sm text-ledger-ink block leading-snug">
                      {row.name}
                    </span>
                    <div className="flex items-center gap-1.5 mt-0.5 font-mono text-[10px] text-ledger-ink-faded">
                      <span>{row.id}</span>
                      <span className="font-silk text-[9px] uppercase px-1 py-0.5 border border-ledger-ink-faded/20 bg-ledger-paper-shade/30 text-ledger-ink-faded leading-none">
                        {row.tier}
                      </span>
                    </div>
                  </td>

                  {/* World Columns */}
                  {WORLD_KEYS.map((key) => {
                    const cell = row.worlds[key];
                    return (
                      <td key={key} className="py-2.5 px-3 text-right">
                        {cell.price !== null ? (
                          <div className="space-y-0.5">
                            <div className="font-mono font-bold text-xs text-ledger-ink tabular-nums">
                              {formatCoin(cell.price)}
                            </div>
                            <div>
                              <SupplyBadge status={cell.supplyStatus} />
                            </div>
                          </div>
                        ) : (
                          <div className="text-ledger-ink-faded/50 font-body text-xs italic">
                            Unlisted
                          </div>
                        )}
                      </td>
                    );
                  })}

                  {/* Spread Column: Arrow plus text */}
                  <td className="py-2.5 px-3 text-right">
                    {row.isExclusive ? (
                      <span className="font-body text-xs text-ledger-ink-faded" title="Produced exclusively in one world">
                        Exclusive
                      </span>
                    ) : row.spreadPct > 0 ? (
                      <div className="space-y-0.5">
                        <span className="inline-flex items-center gap-1 font-mono text-xs font-bold text-ledger-verdigris tabular-nums">
                          <span aria-hidden="true">▲</span>
                          <span>+{row.spreadPct}%</span>
                        </span>
                        <div className="font-mono text-[10px] text-ledger-ink-faded tabular-nums">
                          +{row.spreadAbsolute} coin
                        </div>
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-mono text-xs text-ledger-ink-faded tabular-nums">
                        <span aria-hidden="true">—</span>
                        <span>0% parity</span>
                      </span>
                    )}
                  </td>

                  {/* Trade Suggestion */}
                  <td className="py-2.5 px-3 max-w-xs">
                    <p className="font-body text-xs text-ledger-ink leading-snug">
                      {row.recommendation.summary}
                    </p>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-xs font-mono text-ledger-ink-faded pt-1 px-1">
        <span>
          Showing {sortedRows.length} of {rows.length} commodities
        </span>
        <span>
          Prices updated from real-time local simulation blocks
        </span>
      </div>
    </div>
  );
}

export default GlobalMarketTable;
