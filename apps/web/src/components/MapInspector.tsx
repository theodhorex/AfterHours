"use client";

import { useEffect, useRef, useMemo } from "react";
import type { Sector } from "../data/mock-city.ts";
import type { Citizens } from "../data/mock-city.ts";
import { formatLevelLabel, getNextLevelHint } from "../lib/iso/inspect.ts";
import { formatCoin } from "../lib/format.ts";
import { Icon } from "./ui/Icons.tsx";
import { TrendSparkline } from "./ui/TrendSparkline.tsx";

export interface InspectedTarget {
  type: "building" | "house";
  id: string;
  name?: string;
  sectorIdx?: number;
  sector?: Sector;
  level: number;
  tileX: number;
  tileY: number;
  citizens?: Citizens;
}

export interface MapInspectorProps {
  target: InspectedTarget | null;
  onClose: () => void;
  onOpenLedger: (sectorIdx: number) => void;
  onTryStrategy: (kind: string, sectorIdx: number) => void;
  strategyResult?: string | null;
  focusReturnElement?: HTMLElement | null;
}

export function MapInspector({
  target,
  onClose,
  onOpenLedger,
  onTryStrategy,
  strategyResult,
  focusReturnElement,
}: MapInspectorProps) {
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Return focus to trigger element on unmount or close
  useEffect(() => {
    if (target) {
      closeBtnRef.current?.focus();
    }
  }, [target]);

  // Listen for Escape key
  useEffect(() => {
    if (!target) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        focusReturnElement?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [target, onClose, focusReturnElement]);

  // Calculate 20-step trend points deterministically
  const trendPoints = useMemo(() => {
    if (!target) return [];
    if (target.type === "building" && target.sector) {
      const baseCoin = target.sector.businesses.reduce((sum, b) => sum + b.coin, 0);
      return Array.from({ length: 20 }, (_, i) => {
        const offset = ((i * 17 + target.level * 13) % 29) - 14;
        return Math.max(10, baseCoin + offset * 5);
      });
    }
    if (target.type === "house") {
      const baseWealth = target.citizens ? Math.round(target.citizens.purse / Math.max(1, target.citizens.population)) : 50;
      return Array.from({ length: 20 }, (_, i) => {
        const offset = ((i * 13 + target.level * 7) % 19) - 9;
        return Math.max(5, baseWealth + offset * 2);
      });
    }
    return [];
  }, [target]);

  if (!target) return null;

  const isBuilding = target.type === "building";
  const sector = target.sector;
  const sectorKind = sector?.kind ?? "food";
  const title = isBuilding ? (sector?.name ?? "Municipal District") : `Citizen House (Tile ${target.tileX}, ${target.tileY})`;
  const kindLabel = isBuilding ? sectorKind : "residential";
  const levelLabel = formatLevelLabel(target.level, kindLabel);
  const nextHint = getNextLevelHint(kindLabel, target.level);

  const handleClose = () => {
    onClose();
    focusReturnElement?.focus();
  };

  return (
    <div
      ref={cardRef}
      role="dialog"
      aria-modal="false"
      aria-label={`${title} inspection details`}
      className="absolute right-4 bottom-4 z-20 w-88 max-w-[calc(100%-2rem)] rounded-xs border-2 border-ledger-brass bg-ledger-paper text-ledger-ink shadow-2xl p-4 font-body text-xs space-y-3.5 animate-in fade-in zoom-in-95 duration-150"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 border-b border-ledger-ink-faded/25 pb-2.5">
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5 font-mono text-[10px] text-ledger-ink-faded uppercase tracking-wider">
            <span className="font-silk px-1.5 py-0.5 border border-ledger-ink-faded/30 bg-ledger-paper-shade/30">
              {isBuilding ? `Sector ${target.sectorIdx}` : "Dwelling"}
            </span>
            <span className="capitalize">{kindLabel}</span>
          </div>
          <h2 className="font-display font-bold text-sm text-ledger-ink leading-tight">
            {title}
          </h2>
          <div className="font-mono text-[11px] text-ledger-ink-faded">
            {levelLabel}
          </div>
        </div>

        {/* 44px accessible close button */}
        <button
          ref={closeBtnRef}
          type="button"
          onClick={handleClose}
          aria-label="Close inspection card"
          title="Close (Escape)"
          className="w-11 h-11 flex items-center justify-center rounded-xs text-ledger-ink hover:text-ledger-wax hover:bg-ledger-paper-shade/50 focus-visible:outline-2 focus-visible:outline-ledger-brass cursor-pointer"
        >
          <span className="text-base font-bold leading-none" aria-hidden="true">✕</span>
        </button>
      </div>

      {/* Upgrade Hint */}
      <div className="p-2 rounded-xs border border-ledger-ink-faded/20 bg-ledger-paper-shade/30 font-body text-[11px] text-ledger-ink-faded leading-relaxed">
        {nextHint}
      </div>

      {/* Trend Sparkline */}
      <div className="space-y-1">
        <div className="flex items-center justify-between font-silk text-[10px] uppercase tracking-wider text-ledger-ink-faded">
          <span>20-Step Trend</span>
          <span>{isBuilding ? "Treasury (Coin)" : "Household Wealth"}</span>
        </div>
        <TrendSparkline values={trendPoints} unit={isBuilding ? "coin" : "gold"} />
      </div>

      {/* Content for Building / Sector */}
      {isBuilding && sector && (
        <div className="space-y-2">
          <div className="font-silk text-[10px] uppercase tracking-wider text-ledger-ink-faded flex justify-between">
            <span>Establishments ({sector.businesses.length})</span>
            <span>Status</span>
          </div>
          <ul role="list" className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
            {sector.businesses.map((biz) => {
              const isOpen = biz.open && biz.insolvent_steps === 0;
              return (
                <li
                  key={biz.id}
                  className="flex items-center justify-between p-1.5 rounded-xs border border-ledger-ink-faded/20 bg-ledger-paper-shade/20 text-[11px]"
                >
                  <div className="truncate max-w-[150px]">
                    <div className="font-semibold text-ledger-ink truncate">{biz.name}</div>
                    <div className="text-[10px] text-ledger-ink-faded font-mono capitalize">{biz.recipe.replace(/_/g, " ")}</div>
                  </div>
                  <div className="flex items-center gap-2 font-mono shrink-0">
                    <span className="text-ledger-ink font-semibold">{formatCoin(biz.coin)}</span>
                    <span
                      className={`inline-flex items-center gap-1 font-mono text-[10px] px-1 py-0.5 rounded-xs border ${
                        isOpen
                          ? "border-ledger-verdigris/30 text-ledger-verdigris bg-ledger-verdigris/10"
                          : "border-ledger-wax/30 text-ledger-wax bg-ledger-wax/10"
                      }`}
                    >
                      <Icon name={isOpen ? "seal" : "alert"} size={12} aria-hidden="true" />
                      <span>{isOpen ? "Open" : "Closed"}</span>
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Content for Residential House */}
      {!isBuilding && target.citizens && (
        <div className="space-y-2 font-mono text-[11px] p-2 rounded-xs border border-ledger-ink-faded/20 bg-ledger-paper-shade/20">
          <div className="flex justify-between">
            <span className="text-ledger-ink-faded">Household Satisfaction:</span>
            <span className="font-bold text-ledger-ink">
              {Math.round(target.citizens.satisfaction_bps / 100)}%
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-ledger-ink-faded">Municipal Purse:</span>
            <span className="font-bold text-ledger-ink">
              {formatCoin(target.citizens.purse)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-ledger-ink-faded">Shelter Quality:</span>
            <span className="font-bold text-ledger-ink">Tier {target.level} Haven</span>
          </div>
        </div>
      )}

      {/* Backtest Strategy Result (if any) */}
      {strategyResult && (
        <div
          role="status"
          className="p-2 rounded-xs border border-ledger-verdigris/40 bg-ledger-verdigris/10 font-mono text-[11px] text-ledger-ink flex items-center gap-2"
        >
          <Icon name="seal" size={14} className="text-ledger-verdigris shrink-0" aria-hidden="true" />
          <span className="leading-snug">{strategyResult}</span>
        </div>
      )}

      {/* Action Buttons (min 44px height for touch) */}
      <div className="pt-1 flex flex-col gap-2">
        {isBuilding && (
          <button
            type="button"
            onClick={() => onOpenLedger(target.sectorIdx ?? 0)}
            className="w-full min-h-[44px] px-3 py-2 rounded-xs border border-ledger-ink-faded/40 bg-ledger-paper-shade text-ledger-ink font-semibold hover:border-ledger-ink focus-visible:outline-2 focus-visible:outline-ledger-brass transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            <Icon name="scroll" size={16} aria-hidden="true" />
            <span>Open full ledger page</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => onTryStrategy(kindLabel, target.sectorIdx ?? 0)}
          className="w-full min-h-[44px] px-3 py-2 rounded-xs border-2 border-ledger-brass bg-ledger-brass/15 text-ledger-ink font-bold hover:bg-ledger-brass/25 focus-visible:outline-2 focus-visible:outline-ledger-brass transition-colors cursor-pointer flex items-center justify-center gap-2"
        >
          <Icon name="quill" size={16} aria-hidden="true" />
          <span>Try a strategy here</span>
        </button>
      </div>
    </div>
  );
}
