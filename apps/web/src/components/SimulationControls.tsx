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
  // Load the saved wallet only after hydration so server and client render the same markup.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe load of a browser-only store
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
      setNotice(`Unlocked 10-minute PREVIEW pass for ${tier}!`);
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

  const stepActions = [
    { label: "+1 Season", fn: onStepSeason, aria: "Advance 1 season (1 step)" },
    { label: "+1 Year (4)", fn: onStepYear, aria: "Advance 1 year (4 steps)" },
    { label: "+10 Yrs (40)", fn: onStepDecade, aria: "Advance 10 years (40 steps)" },
  ];
  const latestSink = wallet.sinkLog[0];

  return (
    <div
      role="region"
      aria-label="Simulation Controls & Pace Settings"
      className="atlas-panel rounded-sm p-3 sm:p-4 border border-atlas-line flex flex-col gap-3 text-xs font-mono"
    >
      <div
        role="toolbar"
        aria-label="Primary Simulation Controls"
        className="flex flex-col md:flex-row md:items-center justify-between gap-3"
      >
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <label htmlFor="arc-select" className="text-atlas-ink-muted font-sans font-medium">World:</label>
            <select
              id="arc-select"
              value={arcId}
              disabled={isRunning}
              onChange={(e) => onSelectArc(e.target.value)}
              className="atlas-focus bg-atlas-surface border border-atlas-line text-atlas-ink px-2 py-1 rounded-xs cursor-pointer min-h-[44px] sm:min-h-[32px]"
            >
              {availableArcs.map((id) => (
                <option key={id} value={id}>
                  {id === "goblin_warrens" ? "Goblin Warrens" : id === "cave_hold" ? "Cave Hold" : id}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            <label htmlFor="seed-input" className="text-atlas-ink-muted font-sans font-medium">Seed:</label>
            <input
              id="seed-input"
              type="text"
              value={seed}
              disabled={isRunning}
              onChange={(e) => onChangeSeed(e.target.value)}
              className="atlas-focus bg-atlas-surface border border-atlas-line text-atlas-gold px-2 py-1 rounded-xs w-28 sm:w-32 min-h-[44px] sm:min-h-[32px]"
              placeholder="world_seed"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {stepActions.map((act) => (
            <button
              key={act.label}
              type="button"
              onClick={act.fn}
              disabled={isRunning}
              aria-label={act.aria}
              className="atlas-focus px-2.5 py-1 rounded-xs bg-atlas-surface border border-atlas-line hover:border-atlas-gold/80 hover:bg-atlas-surface-raised text-atlas-ink font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors min-h-[44px] sm:min-h-[32px] inline-flex items-center justify-center cursor-pointer"
            >
              {act.label}
            </button>
          ))}
          <button
            type="button"
            onClick={onFastForward}
            disabled={isRunning}
            aria-label="Fast-forward 40 steps over 30 seconds"
            className="atlas-focus px-3 py-1 rounded-xs bg-atlas-gold/15 border border-atlas-gold/60 text-atlas-gold hover:bg-atlas-gold/25 font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors min-h-[44px] sm:min-h-[32px] inline-flex items-center gap-1.5 cursor-pointer"
          >
            <span aria-hidden="true">▶</span>
            <span role="status" aria-live="polite">{isRunning ? `Running (${stepsRemaining})` : "Fast-Forward"}</span>
          </button>
          <button
            type="button"
            onClick={onPause}
            disabled={!isRunning}
            aria-label="Pause fast-forward"
            className={`atlas-focus px-2.5 py-1 rounded-xs border font-semibold transition-colors min-h-[44px] sm:min-h-[32px] inline-flex items-center justify-center ${
              isRunning ? "bg-atlas-ember/20 border-atlas-ember text-atlas-ember hover:bg-atlas-ember/30 animate-pulse cursor-pointer" : "bg-atlas-surface border-atlas-line text-atlas-ink-muted/50 cursor-not-allowed opacity-50"
            }`}
          >
            ⏸ Pause
          </button>
          <button
            type="button"
            onClick={onReset}
            aria-label="Reset simulation to step 0"
            className="atlas-focus px-2.5 py-1 rounded-xs bg-atlas-surface border border-atlas-alert/40 text-atlas-alert/90 hover:bg-atlas-alert/15 hover:border-atlas-alert hover:text-atlas-alert font-semibold transition-colors min-h-[44px] sm:min-h-[32px] inline-flex items-center justify-center cursor-pointer"
          >
            ↺ Reset
          </button>
        </div>
      </div>

      <div className="pt-2 border-t border-atlas-line/60 flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-sans font-semibold text-atlas-ink">Pace Switch:</span>
            <span className="text-[11px] text-atlas-ink-muted">
              Official: <strong className="text-atlas-gold">30x</strong> (1 step = 1 season / 91.25d)
            </span>
          </div>
          <div className="flex items-center gap-2 text-atlas-ink bg-atlas-surface-raised px-2 py-0.5 rounded-xs border border-atlas-line">
            <span>🥖 Wallet: <strong className="text-atlas-gold">{wallet.bread}</strong> bread</span>
            <button
              type="button"
              onClick={handleDemoFaucet}
              aria-label="Add 100 demo bread"
              className="atlas-focus text-[11px] px-1.5 py-0.5 rounded-xs bg-atlas-gold/15 text-atlas-gold hover:bg-atlas-gold/25 border border-atlas-gold/40 cursor-pointer min-h-[44px] sm:min-h-[24px] inline-flex items-center"
            >
              +100 Faucet
            </button>
          </div>
        </div>

        <div
          role="radiogroup"
          aria-label="Simulation speed pace"
          className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-9 gap-1.5"
        >
          {FREE_TIERS.map((tier) => {
            const isSelected = currentSpeed === tier;
            return (
              <button
                key={tier}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => handleSelectTier(tier)}
                className={`atlas-focus px-2 py-1 rounded-xs border text-center font-semibold transition-colors min-h-[44px] sm:min-h-[36px] flex flex-col items-center justify-center cursor-pointer ${
                  isSelected
                    ? "bg-atlas-gold text-atlas-canvas border-atlas-gold shadow-xs"
                    : "bg-atlas-surface border-atlas-line text-atlas-ink hover:border-atlas-line-strong hover:bg-atlas-surface-raised"
                }`}
              >
                <span className="text-xs">{tier === "timelapse" ? "Timelapse" : tier}</span>
                <span className="text-[10px] opacity-80">{tier === OFFICIAL_TIER ? "Official" : "Free"}</span>
              </button>
            );
          })}

          {PREVIEW_TIERS.map((tier) => {
            const unlocked = canUse(wallet, tier, now);
            const isSelected = currentSpeed === tier;
            const price = pricePreview(tier);

            return (
              <div
                key={tier}
                className={`relative rounded-xs border p-1 flex flex-col items-center justify-between min-h-[44px] sm:min-h-[36px] transition-colors ${
                  isSelected
                    ? "bg-atlas-gold/20 border-atlas-gold text-atlas-ink"
                    : unlocked
                    ? "bg-atlas-surface border-atlas-moss text-atlas-ink"
                    : "bg-atlas-surface/60 border-atlas-line text-atlas-ink-muted"
                }`}
              >
                <div className="flex items-center justify-between w-full px-0.5">
                  <span className="text-[9px] font-bold tracking-wider text-atlas-ember">PREVIEW</span>
                  {unlocked ? (
                    <span className="text-[10px] text-atlas-moss font-semibold">✓ Pass</span>
                  ) : (
                    <span className="text-[10px] text-atlas-ash font-mono">{price}🍞</span>
                  )}
                </div>

                {unlocked ? (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => handleSelectTier(tier)}
                    className="atlas-focus w-full text-center text-xs font-bold text-atlas-ink hover:text-atlas-gold cursor-pointer min-h-[44px] sm:min-h-[24px] inline-flex items-center justify-center"
                  >
                    {tier}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleBuyPass(tier)}
                    aria-label={`Buy 10-minute PREVIEW pass for ${tier} for ${price} bread`}
                    className="atlas-focus w-full text-[11px] font-semibold text-atlas-gold bg-atlas-gold/15 hover:bg-atlas-gold/25 border border-atlas-gold/40 rounded-xs py-0.5 cursor-pointer min-h-[44px] sm:min-h-[24px] inline-flex items-center justify-center gap-1"
                  >
                    <span>🔒</span>
                    <span>Buy {tier}</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {currentSpeed === "timelapse" && onChangeTimelapseRate && (
          <div className="flex items-center gap-2 bg-atlas-surface px-2 py-1 rounded-xs border border-atlas-line">
            <span className="text-atlas-ink-muted">Timelapse Rate:</span>
            <input
              type="range"
              min="1"
              max="8"
              step="1"
              value={timelapseRate}
              onChange={(e) => onChangeTimelapseRate(Number(e.target.value))}
              aria-label="Timelapse steps per second (1 to 8)"
              className="accent-atlas-gold cursor-pointer"
            />
            <span className="text-atlas-gold font-bold">{timelapseRate} steps/sec</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] text-atlas-ink-muted">
          <div>
            {notice ? (
              <span className="text-atlas-gold font-semibold" role="status">ℹ {notice}</span>
            ) : latestSink ? (
              <span>Recent sink: <strong>{latestSink.description}</strong> ({latestSink.cost} bread)</span>
            ) : (
              <span>Simulated bread wallet active in localStorage.</span>
            )}
          </div>
          <div className="text-[10px] text-atlas-ash italic">
            Official pace is 30x; higher speeds are paid previews; admin can change the real pace later (planned, not built).
          </div>
        </div>
      </div>
    </div>
  );
}
