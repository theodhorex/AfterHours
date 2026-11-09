"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FREE_TIERS,
  PREVIEW_TIERS,
  OFFICIAL_TIER,
  pricePreview,
  canUse,
  buyTicket,
  getActiveSpeed,
  DEFAULT_WALLET_BALANCE,
  loadWalletFromStorage,
  saveWalletToStorage,
  clampWalletBalance,
  type SpeedTier,
  type SpeedWallet,
} from "../lib/timespeed.ts";
import { Icon } from "./ui/Icons.tsx";
import { TickNumber } from "./ui/TickNumber.tsx";
import { SpeedTicket } from "./ui/SpeedTicket.tsx";

interface SimulationControlsProps {
  arcId: string;
  seed: string;
  availableArcs: readonly string[];
  isRunning: boolean;
  stepsRemaining: number;
  onSelectArc: (arcId: string) => void;
  onChangeSeed: (seed: string) => void;
  onStepSeason: () => void;
  onStepYear: () => void;
  onStepDecade: () => void;
  onFastForward: () => void;
  onPause: () => void;
  onReset: () => void;
  speedTier?: SpeedTier;
  onSelectSpeedTier?: (tier: SpeedTier) => void;
  timelapseRate?: number;
  onChangeTimelapseRate?: (rate: number) => void;
}

const ARC_NAMES: Record<string, string> = {
  goblin_warrens: "Goblin Warrens",
  cave_hold: "Cave Hold",
  dino_vale: "Dino Vale",
  elf_grove: "Elf Grove",
};

export function SimulationControls({
  arcId,
  seed,
  availableArcs,
  isRunning,
  stepsRemaining,
  onSelectArc,
  onChangeSeed,
  onStepSeason,
  onStepYear,
  onStepDecade,
  onFastForward,
  onPause,
  onReset,
  speedTier: propSpeedTier,
  onSelectSpeedTier,
  timelapseRate = 4,
  onChangeTimelapseRate,
}: SimulationControlsProps) {
  const [internalSpeed, setInternalSpeed] = useState<SpeedTier>(OFFICIAL_TIER);
  const [wallet, setWallet] = useState<SpeedWallet>({
    bread: DEFAULT_WALLET_BALANCE,
    activeTicket: null,
    sinkLog: [],
  });

  // Load the saved wallet only after hydration for SSR stability
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWallet(loadWalletFromStorage());
  }, []);

  const [notice, setNotice] = useState<string | null>(null);
  const [now, setNow] = useState<number>(0);
  const currentSpeed = propSpeedTier ?? internalSpeed;

  useEffect(() => {
    const timer = setInterval(() => {
      const currentNow = Date.now();
      setNow(currentNow);
      setWallet((prev) => {
        const nextSpeed = getActiveSpeed(currentSpeed, prev, currentNow);
        if (nextSpeed !== currentSpeed) {
          if (onSelectSpeedTier) onSelectSpeedTier(nextSpeed);
          else setInternalSpeed(nextSpeed);
          setNotice(`Preview pass expired. Reverted to official ${OFFICIAL_TIER} pace.`);
        }
        return prev;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [currentSpeed, onSelectSpeedTier]);

  const handleSelectTier = useCallback((tier: SpeedTier) => {
    const currentNow = Date.now();
    setNow(currentNow);
    if (canUse(wallet, tier, currentNow)) {
      if (onSelectSpeedTier) onSelectSpeedTier(tier);
      else setInternalSpeed(tier);
      setNotice(null);
    } else {
      const cost = pricePreview(tier);
      setNotice(`Tier ${tier} is locked. Unlock a 10-minute pass for ${cost} bread.`);
    }
  }, [wallet, onSelectSpeedTier]);

  const handleBuyPass = useCallback((tier: SpeedTier) => {
    const currentNow = Date.now();
    const result = buyTicket(wallet, tier, currentNow);
    if (result.success) {
      setWallet(result.wallet);
      saveWalletToStorage(result.wallet);
      if (onSelectSpeedTier) onSelectSpeedTier(tier);
      else setInternalSpeed(tier);
      setNotice(`Unlocked 10-minute preview pass for ${tier}.`);
    } else {
      setNotice(result.error ?? "Could not purchase ticket.");
    }
  }, [wallet, onSelectSpeedTier]);

  const handleDemoFaucet = useCallback(() => {
    setWallet((prev) => {
      const updated = { ...prev, bread: clampWalletBalance(prev.bread + 100) };
      saveWalletToStorage(updated);
      return updated;
    });
    setNotice("Added 100 bread from demo bakery.");
  }, []);

  const latestSink = wallet.sinkLog[0];

  return (
    <div
      role="region"
      aria-label="Simulation Controls & Pace Settings"
      className="ledger-chrome border-2 border-ledger-twilight p-3 sm:p-4 flex flex-col gap-3 text-xs font-mono"
    >
      {/* Row 1: Primary Controls */}
      <div
        role="toolbar"
        aria-label="Primary Simulation Controls"
        className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-ledger-twilight"
      >
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label htmlFor="arc-select" className="text-ledger-paper/70 font-sans font-medium">World:</label>
            <select
              id="arc-select"
              value={arcId}
              onChange={(e) => onSelectArc(e.target.value)}
              className="min-h-[44px] bg-ledger-night border border-ledger-twilight text-ledger-paper px-2.5 py-1.5 rounded-xs cursor-pointer focus-visible:outline-2 focus-visible:outline-ledger-brass"
            >
              {availableArcs.map((id) => (
                <option key={id} value={id}>
                  {ARC_NAMES[id] ?? id}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="seed-input" className="text-ledger-paper/70 font-sans font-medium">Seed:</label>
            <input
              id="seed-input"
              type="text"
              value={seed}
              onChange={(e) => onChangeSeed(e.target.value)}
              className="min-h-[44px] bg-ledger-night border border-ledger-twilight text-ledger-brass px-2.5 py-1.5 rounded-xs w-28 sm:w-32 focus-visible:outline-2 focus-visible:outline-ledger-brass font-mono"
              placeholder="world_seed"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {[
            { label: "+1 season", fn: onStepSeason, aria: "Advance 1 season (1 step)" },
            { label: "+1 year", fn: onStepYear, aria: "Advance 1 year (4 steps)" },
            { label: "+10 years", fn: onStepDecade, aria: "Advance 10 years (40 steps)" },
          ].map((act) => (
            <button
              key={act.label}
              type="button"
              onClick={act.fn}
              disabled={isRunning}
              aria-label={act.aria}
              className="min-h-[44px] px-3 py-1.5 rounded-xs bg-ledger-twilight/40 border border-ledger-twilight hover:border-ledger-brass hover:bg-ledger-twilight/80 text-ledger-paper font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center cursor-pointer focus-visible:outline-2 focus-visible:outline-ledger-brass"
            >
              {act.label}
            </button>
          ))}

          <button
            type="button"
            onClick={onFastForward}
            disabled={isRunning}
            aria-label="Fast-forward 40 steps over 30 seconds"
            className="min-h-[44px] px-3.5 py-1.5 rounded-xs bg-ledger-brass/20 border border-ledger-brass/80 text-ledger-brass hover:bg-ledger-brass hover:text-ledger-night font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-1.5 cursor-pointer focus-visible:outline-2 focus-visible:outline-ledger-brass"
          >
            <Icon name="play" size={14} />
            <span role="status" aria-live="polite">
              {isRunning ? `Running (${stepsRemaining})` : "Fast-forward"}
            </span>
          </button>

          <button
            type="button"
            onClick={onPause}
            disabled={!isRunning}
            aria-label="Pause simulation"
            className={`min-h-[44px] px-3 py-1.5 rounded-xs border font-semibold transition-colors inline-flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-ledger-brass ${
              isRunning
                ? "bg-ledger-wax/20 border-ledger-wax text-ledger-paper hover:bg-ledger-wax/40 cursor-pointer"
                : "bg-ledger-night border-ledger-twilight text-ledger-paper/40 cursor-not-allowed opacity-50"
            }`}
          >
            <Icon name="pause" size={14} />
            <span>Pause</span>
          </button>

          <button
            type="button"
            onClick={onReset}
            aria-label="Reset simulation to step 0"
            className="min-h-[44px] px-3 py-1.5 rounded-xs bg-ledger-night border border-ledger-wax/60 text-ledger-paper hover:bg-ledger-wax hover:text-ledger-paper font-semibold transition-colors inline-flex items-center justify-center cursor-pointer focus-visible:outline-2 focus-visible:outline-ledger-brass"
          >
            Reset world
          </button>
        </div>
      </div>

      {/* Row 2: Pace Switch & Tickets & Wallet */}
      <div className="flex flex-col gap-2.5 pt-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-sans font-semibold text-ledger-paper">Pace switch:</span>
            <span className="text-[11px] text-ledger-paper/70">
              Official: <strong className="text-ledger-brass">30x</strong> (1 step = 1 season / 91.25d)
            </span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1 rounded-xs border border-ledger-twilight bg-ledger-twilight/30 text-ledger-paper">
            <Icon name="bread" size={16} className="text-ledger-brass" />
            <span>
              Purse: <TickNumber value={wallet.bread} className="font-bold text-ledger-brass" /> bread
            </span>
            <button
              type="button"
              onClick={handleDemoFaucet}
              aria-label="Add 100 demo bread to wallet"
              className="min-h-[44px] sm:min-h-[26px] px-2 py-0.5 rounded-xs bg-ledger-brass/20 text-ledger-brass hover:bg-ledger-brass hover:text-ledger-night border border-ledger-brass/50 text-[11px] font-bold cursor-pointer inline-flex items-center focus-visible:outline-2 focus-visible:outline-ledger-brass transition-colors ml-1"
            >
              +100 bread
            </button>
          </div>
        </div>

        <div
          role="radiogroup"
          aria-label="Simulation speed pace"
          className="flex flex-wrap lg:flex-nowrap items-stretch gap-2"
        >
          <div className="inline-flex rounded-xs border border-ledger-twilight divide-x divide-ledger-twilight overflow-hidden shrink-0">
            {FREE_TIERS.map((tier) => {
              const isSelected = currentSpeed === tier;
              return (
                <button
                  key={tier}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => handleSelectTier(tier)}
                  className={`min-h-[44px] px-3.5 py-1.5 text-center font-mono font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 focus-visible:outline-2 focus-visible:outline-ledger-brass ${
                    isSelected
                      ? "bg-ledger-brass text-ledger-night shadow-inner"
                      : "bg-ledger-night text-ledger-paper/80 hover:text-ledger-paper hover:bg-ledger-twilight/60"
                  }`}
                >
                  {isSelected && <span aria-hidden="true" className="font-mono text-xs font-black">✓</span>}
                  <span>{tier === "timelapse" ? "Timelapse" : tier}</span>
                  {tier === OFFICIAL_TIER && (
                    <span
                      className={`text-[9px] uppercase font-silk px-1 py-0.5 rounded-xs border leading-none ${
                        isSelected
                          ? "bg-ledger-night/20 text-ledger-night border-ledger-night/30"
                          : "bg-ledger-twilight text-ledger-brass border-ledger-brass/30"
                      }`}
                    >
                      Official
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-stretch gap-1.5 flex-1">
            {PREVIEW_TIERS.map((tier) => (
              <SpeedTicket
                key={tier}
                tier={tier}
                price={pricePreview(tier)}
                unlocked={canUse(wallet, tier, now)}
                isSelected={currentSpeed === tier}
                onSelect={handleSelectTier}
                onBuy={handleBuyPass}
              />
            ))}
          </div>
        </div>

        {currentSpeed === "timelapse" && onChangeTimelapseRate && (
          <div className="flex items-center gap-3 bg-ledger-twilight/30 px-3 py-1.5 rounded-xs border border-ledger-twilight">
            <span className="text-ledger-paper/70">Timelapse rate:</span>
            <input
              type="range"
              min="1"
              max="8"
              step="1"
              value={timelapseRate}
              onChange={(e) => onChangeTimelapseRate(Number(e.target.value))}
              aria-label="Timelapse steps per second (1 to 8)"
              className="accent-ledger-brass cursor-pointer"
            />
            <span className="text-ledger-brass font-bold">{timelapseRate} steps/sec</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] text-ledger-paper/60 pt-1.5 border-t border-ledger-twilight/60">
          <div>
            {notice ? (
              <span className="text-ledger-brass font-semibold" role="status">{notice}</span>
            ) : latestSink ? (
              <span>Recent sink: <strong>{latestSink.description}</strong> ({latestSink.cost} bread)</span>
            ) : (
              <span>Simulated bread wallet active in localStorage.</span>
            )}
          </div>
          <div className="text-[10px] text-ledger-paper/40 italic">
            Official pace is 30x; higher speeds are paid preview tickets.
          </div>
        </div>
      </div>
    </div>
  );
}
