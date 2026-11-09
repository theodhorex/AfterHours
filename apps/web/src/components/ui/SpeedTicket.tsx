import React from "react";
import type { SpeedTier } from "../../lib/timespeed.ts";
import { Icon } from "./Icons.tsx";

export interface SpeedTicketProps {
  tier: SpeedTier;
  price: number;
  unlocked: boolean;
  isSelected: boolean;
  onSelect: (tier: SpeedTier) => void;
  onBuy: (tier: SpeedTier) => void;
}

export function SpeedTicket({
  tier,
  price,
  unlocked,
  isSelected,
  onSelect,
  onBuy,
}: SpeedTicketProps) {
  return (
    <div
      className={`relative flex-1 min-w-[95px] rounded-xs border border-dashed p-1.5 flex flex-col justify-between transition-colors min-h-[44px] ${
        isSelected
          ? "bg-ledger-brass/20 border-ledger-brass text-ledger-paper"
          : unlocked
            ? "bg-ledger-twilight/40 border-ledger-verdigris/70 text-ledger-paper"
            : "bg-ledger-night/80 border-ledger-twilight/80 text-ledger-paper/70"
      }`}
    >
      <div className="flex items-center justify-between gap-1 w-full pb-1 border-b border-dashed border-ledger-twilight/60 text-[10px]">
        <span className="font-silk text-[9px] uppercase tracking-wider text-ledger-brass">
          PREVIEW
        </span>
        {unlocked ? (
          <span className="text-[10px] font-mono text-ledger-verdigris flex items-center gap-0.5">
            <span aria-hidden="true">✓</span> Pass
          </span>
        ) : (
          <span className="text-[10px] font-mono text-ledger-paper/70 flex items-center gap-0.5">
            <Icon name="bread" size={12} className="text-ledger-brass" />
            <span>{price}</span>
          </span>
        )}
      </div>

      {unlocked ? (
        <button
          type="button"
          role="radio"
          aria-checked={isSelected}
          onClick={() => onSelect(tier)}
          className={`min-h-[44px] sm:min-h-[26px] w-full mt-1 px-2 py-1 rounded-xs font-mono font-bold text-xs flex items-center justify-center gap-1 cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-ledger-brass ${
            isSelected
              ? "bg-ledger-brass text-ledger-night shadow-inner"
              : "bg-ledger-twilight/60 text-ledger-paper hover:bg-ledger-twilight hover:text-ledger-brass"
          }`}
        >
          {isSelected && <span aria-hidden="true" className="font-mono text-xs font-black">✓</span>}
          <span>{tier}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => onBuy(tier)}
          aria-label={`Buy 10-minute preview pass for ${tier} for ${price} bread`}
          className="min-h-[44px] sm:min-h-[26px] w-full mt-1 px-1.5 py-1 rounded-xs bg-ledger-twilight/80 hover:bg-ledger-brass hover:text-ledger-night text-ledger-brass font-mono font-bold text-[11px] flex items-center justify-center gap-1 cursor-pointer border border-ledger-twilight transition-colors focus-visible:outline-2 focus-visible:outline-ledger-brass"
        >
          <svg
            width={11}
            height={11}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span>Buy {tier}</span>
        </button>
      )}
    </div>
  );
}
