"use client";

import {
  batchEvents,
  type AnnounceableEvent,
  type BatchAnnouncerOptions,
} from "../../lib/a11y/batch-announcer.ts";

export interface LiveLogProps {
  events: readonly AnnounceableEvent[];
  paused?: boolean;
  windowMs?: number;
  options?: BatchAnnouncerOptions;
  className?: string;
}

/**
 * Visually hidden aria-live="polite" region fed by batchEvents.
 * Screen readers announce newly batched chronicle events politely without spamming.
 */
export function LiveLog({
  events,
  paused = false,
  windowMs = 4000,
  options,
  className = "",
}: LiveLogProps) {
  const mergedOpts: BatchAnnouncerOptions = {
    windowMs,
    paused,
    ...options,
  };

  const messages = batchEvents(events, mergedOpts);
  const announcementText = messages.join(". ");

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={`sr-only ${className}`}
    >
      {announcementText}
    </div>
  );
}

export interface PauseToggleProps {
  paused: boolean;
  onToggle: (nextPaused: boolean) => void;
  className?: string;
  label?: string;
}

/**
 * Accessible toggle button to pause/resume chronicle announcements.
 * Meets WCAG 2.5.5 / 2.5.8 target size minimum (44x44px).
 * Toggles announcement state only; never hides the visible chronicle list.
 */
export function PauseToggle({
  paused,
  onToggle,
  className = "",
  label,
}: PauseToggleProps) {
  const defaultLabel = paused
    ? "Resume chronicle announcements"
    : "Pause chronicle announcements";
  const displayLabel = label ?? defaultLabel;

  return (
    <button
      type="button"
      aria-pressed={paused}
      aria-label={displayLabel}
      onClick={() => onToggle(!paused)}
      className={`min-w-[44px] min-h-[44px] px-3 py-2 text-xs font-mono rounded-xs border transition-colors flex items-center justify-center gap-2 atlas-focus cursor-pointer ${
        paused
          ? "bg-atlas-ember/20 text-atlas-ember border-atlas-ember/40 hover:bg-atlas-ember/30"
          : "bg-atlas-surface-raised text-atlas-ink border-atlas-line hover:border-atlas-gold hover:text-atlas-gold"
      } ${className}`}
      title={displayLabel}
    >
      <span aria-hidden="true" className="text-sm">
        {paused ? "▶" : "⏸"}
      </span>
      <span>{paused ? "Announcements Paused" : "Live Announcements"}</span>
    </button>
  );
}
