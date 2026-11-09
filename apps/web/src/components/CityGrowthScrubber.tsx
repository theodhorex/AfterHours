"use client";

import { useState, useEffect, useRef } from "react";
import {
  formatAgeStats,
  generateLiveRegionText,
} from "../lib/iso/growth-render-pure.ts";

export interface CityGrowthScrubberProps {
  currentStep: number;
  maxStep?: number;
  cityName: string;
  arcId: string;
  stageName: string;
  population: number;
  openBiz: number;
  totalBiz: number;
  satisfaction?: number;
  patinaName: string;
  onScrub: (step: number) => void;
}

export function CityGrowthScrubber({
  currentStep,
  maxStep = 10000,
  cityName,
  stageName,
  population,
  openBiz,
  totalBiz,
  satisfaction = 90,
  patinaName,
  onScrub,
}: CityGrowthScrubberProps) {
  const year = Math.floor(currentStep / 4);
  const season = ((currentStep % 4) + 4) % 4;

  const stats = formatAgeStats({
    year,
    season,
    stageName,
    population,
    openBiz,
    totalBiz,
    satisfaction,
    patinaName,
  });

  // Track previous stage name to detect and announce stage advances in live region
  const prevStageRef = useRef<string>(stageName);
  const [liveAnnouncement, setLiveAnnouncement] = useState<string>("");

  useEffect(() => {
    const text = generateLiveRegionText({
      cityName,
      year,
      stageName,
      prevStageName: prevStageRef.current,
      population,
      openBiz,
    });
    setLiveAnnouncement(text);
    prevStageRef.current = stageName;
  }, [cityName, year, stageName, population, openBiz]);

  const stepJump = (deltaYears: number) => {
    const nextStep = Math.max(0, Math.min(maxStep, currentStep + deltaYears * 4));
    onScrub(nextStep);
  };

  const handleSliderKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    let nextStep: number | null = null;
    switch (e.key) {
      case "ArrowLeft":
      case "ArrowDown":
        e.preventDefault();
        nextStep = Math.max(0, currentStep - 1);
        break;
      case "ArrowRight":
      case "ArrowUp":
        e.preventDefault();
        nextStep = Math.min(maxStep, currentStep + 1);
        break;
      case "PageDown":
        e.preventDefault();
        nextStep = Math.max(0, currentStep - 4);
        break;
      case "PageUp":
        e.preventDefault();
        nextStep = Math.min(maxStep, currentStep + 4);
        break;
      case "Home":
        e.preventDefault();
        nextStep = 0;
        break;
      case "End":
        e.preventDefault();
        nextStep = maxStep;
        break;
      default:
        return;
    }
    if (nextStep !== null) {
      onScrub(nextStep);
    }
  };

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // If click directly targeted the input element, native onChange handles it
    if (e.target !== e.currentTarget && (e.target as HTMLElement).tagName === "INPUT") {
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const targetStep = Math.round(ratio * maxStep);
    onScrub(targetStep);
  };

  return (
    <section
      aria-label="City Age and Timeline Scrubber"
      className="atlas-panel rounded-sm p-3 sm:p-4 bg-atlas-surface border border-atlas-line space-y-3"
    >
      {/* 1. Screen-reader live region */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {liveAnnouncement}
      </div>

      {/* 2. Compact Age / Stats Strip */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-atlas-line pb-2.5 text-xs font-mono">
        {/* Year and Season */}
        <div className="flex items-center gap-2">
          <span className="text-atlas-gold font-bold text-sm tracking-wide">
            {stats.yearLabel}
          </span>
          <span className="px-2 py-0.5 rounded-xs bg-atlas-canvas border border-atlas-line text-atlas-ink">
            {stats.seasonName}
          </span>
          <span className="px-2 py-0.5 rounded-xs bg-atlas-gold/15 border border-atlas-gold/40 text-atlas-gold font-semibold uppercase text-[10px]">
            {stats.stageName}
          </span>
        </div>

        {/* Vital stats row */}
        <div className="flex flex-wrap items-center gap-3 text-atlas-ink-muted">
          <div>
            <span className="text-atlas-ash mr-1">Pop:</span>
            <span className="text-atlas-ink font-semibold">{stats.popLabel}</span>
          </div>
          <div>
            <span className="text-atlas-ash mr-1">Businesses:</span>
            <span className="text-atlas-ink font-semibold">{stats.bizLabel}</span>
          </div>
          <div>
            <span className="text-atlas-ash mr-1">Mood:</span>
            <span className="text-atlas-moss font-semibold">{stats.satisfactionLabel}</span>
          </div>
          <div className="hidden md:inline-flex items-center gap-1 text-[11px] text-atlas-gold/90">
            <span aria-hidden="true">🏛️</span>
            <span>{stats.patinaName}</span>
          </div>
        </div>
      </div>

      {/* 3. 0..10000 Scrub Slider */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] font-mono text-atlas-ink-muted">
          <label htmlFor="city-timeline-slider" className="font-semibold text-atlas-ink">
            Timeline Scrubber (0..{maxStep} steps / 2500 years)
          </label>
          <span className="text-atlas-gold font-semibold">
            Step {currentStep} / {maxStep}
          </span>
        </div>

        {/* 44px minimum touch/click target container operating track click without dragging */}
        <div
          role="presentation"
          onClick={handleTrackClick}
          className="relative flex items-center min-h-[44px] cursor-pointer py-1"
        >
          <input
            id="city-timeline-slider"
            type="range"
            role="slider"
            min={0}
            max={maxStep}
            step={1}
            value={currentStep}
            onChange={(e) => onScrub(Number(e.target.value))}
            onKeyDown={handleSliderKeyDown}
            aria-label="Simulation timeline scrubber"
            aria-valuemin={0}
            aria-valuemax={maxStep}
            aria-valuenow={currentStep}
            aria-valuetext={`Year ${year}, ${stats.seasonName}`}
            className="w-full h-3 min-h-[44px] bg-atlas-canvas rounded-lg appearance-none cursor-pointer accent-atlas-gold focus:outline-hidden focus:ring-2 focus:ring-atlas-gold"
          />
        </div>

        {/* Milestone ticks */}
        <div
          aria-hidden="true"
          className="flex justify-between text-[10px] font-mono text-atlas-ash select-none px-0.5"
        >
          <span>Yr 0</span>
          <span>Yr 500</span>
          <span>Yr 1000</span>
          <span>Yr 1500</span>
          <span>Yr 2000</span>
          <span>Yr 2500</span>
        </div>
      </div>

      {/* 4. Keyboard accessible step buttons */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
          <span className="text-atlas-ash text-[10px] mr-1 hidden sm:inline">Jump:</span>
          <button
            type="button"
            onClick={() => stepJump(-100)}
            disabled={currentStep <= 0}
            className="atlas-focus px-2 py-1 rounded-xs bg-atlas-surface-raised hover:bg-atlas-line border border-atlas-line text-atlas-ink hover:text-atlas-gold disabled:opacity-40 transition-colors"
            title="Step back 100 years"
          >
            -100y
          </button>
          <button
            type="button"
            onClick={() => stepJump(-10)}
            disabled={currentStep <= 0}
            className="atlas-focus px-2 py-1 rounded-xs bg-atlas-surface-raised hover:bg-atlas-line border border-atlas-line text-atlas-ink hover:text-atlas-gold disabled:opacity-40 transition-colors"
            title="Step back 10 years"
          >
            -10y
          </button>
          <button
            type="button"
            onClick={() => stepJump(-1)}
            disabled={currentStep <= 0}
            className="atlas-focus px-2 py-1 rounded-xs bg-atlas-surface-raised hover:bg-atlas-line border border-atlas-line text-atlas-ink hover:text-atlas-gold disabled:opacity-40 transition-colors"
            title="Step back 1 year"
          >
            -1y
          </button>
          <button
            type="button"
            onClick={() => stepJump(1)}
            disabled={currentStep >= maxStep}
            className="atlas-focus px-2 py-1 rounded-xs bg-atlas-surface-raised hover:bg-atlas-line border border-atlas-line text-atlas-ink hover:text-atlas-gold disabled:opacity-40 transition-colors"
            title="Step forward 1 year"
          >
            +1y
          </button>
          <button
            type="button"
            onClick={() => stepJump(10)}
            disabled={currentStep >= maxStep}
            className="atlas-focus px-2 py-1 rounded-xs bg-atlas-surface-raised hover:bg-atlas-line border border-atlas-line text-atlas-ink hover:text-atlas-gold disabled:opacity-40 transition-colors"
            title="Step forward 10 years"
          >
            +10y
          </button>
          <button
            type="button"
            onClick={() => stepJump(100)}
            disabled={currentStep >= maxStep}
            className="atlas-focus px-2 py-1 rounded-xs bg-atlas-surface-raised hover:bg-atlas-line border border-atlas-line text-atlas-ink hover:text-atlas-gold disabled:opacity-40 transition-colors"
            title="Step forward 100 years"
          >
            +100y
          </button>
        </div>

        {/* Milestone Quick Jumps */}
        <div className="flex items-center gap-1.5 text-[10px] font-mono">
          <button
            type="button"
            onClick={() => onScrub(0)}
            className="atlas-focus px-2 py-1 rounded-xs bg-atlas-canvas hover:bg-atlas-surface-raised border border-atlas-line text-atlas-ink-muted hover:text-atlas-gold transition-colors"
          >
            Genesis (Yr 0)
          </button>
          <button
            type="button"
            onClick={() => onScrub(480)}
            className="atlas-focus px-2 py-1 rounded-xs bg-atlas-canvas hover:bg-atlas-surface-raised border border-atlas-line text-atlas-ink-muted hover:text-atlas-gold transition-colors"
          >
            Town (Yr 120)
          </button>
          <button
            type="button"
            onClick={() => onScrub(maxStep)}
            className="atlas-focus px-2 py-1 rounded-xs bg-atlas-canvas hover:bg-atlas-surface-raised border border-atlas-line text-atlas-ink-muted hover:text-atlas-gold transition-colors"
          >
            Ancient (Yr 2500)
          </button>
        </div>
      </div>
    </section>
  );
}
