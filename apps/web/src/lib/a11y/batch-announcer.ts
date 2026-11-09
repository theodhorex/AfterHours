/**
 * Pure helper for batching chronicle events into accessible live announcements.
 * Groups events into at most one polite message per window (default 4000ms),
 * deterministic ordering, caps each message at 3 events plus "and N more",
 * and supports a paused flag.
 */

export interface AnnounceableEvent {
  id: string;
  title: string;
  description?: string;
  step?: number;
  timestamp?: number;
  time?: number;
}

export interface BatchAnnouncerOptions {
  windowMs?: number;
  maxEvents?: number;
  paused?: boolean;
}

/**
 * Returns an event's temporal coordinate in ms.
 * Prefers timestamp > time > step > 0.
 */
function getEventTime(event: AnnounceableEvent): number {
  if (typeof event.timestamp === "number" && !Number.isNaN(event.timestamp)) {
    return event.timestamp;
  }
  if (typeof event.time === "number" && !Number.isNaN(event.time)) {
    return event.time;
  }
  if (typeof event.step === "number" && !Number.isNaN(event.step)) {
    return event.step;
  }
  return 0;
}

/**
 * Strips terminal period and trims whitespace for clean compounding.
 */
function cleanTitle(title: string): string {
  if (!title) return "";
  return title.trim().replace(/\.+$/, "");
}

/**
 * Groups events into polite messages per window.
 * Returns array of message strings (one per window, in window order).
 */
export function batchEvents(
  events: readonly AnnounceableEvent[],
  opts?: BatchAnnouncerOptions,
): string[] {
  if (opts?.paused) {
    return [];
  }
  if (!events || events.length === 0) {
    return [];
  }

  const windowMs = opts?.windowMs && opts.windowMs > 0 ? opts.windowMs : 4000;
  const maxEvents = opts?.maxEvents && opts.maxEvents > 0 ? opts.maxEvents : 3;

  // Group events by window index: Math.floor(time / windowMs)
  const windowBuckets = new Map<number, AnnounceableEvent[]>();

  for (const ev of events) {
    const t = getEventTime(ev);
    const windowIdx = Math.floor(t / windowMs);
    let bucket = windowBuckets.get(windowIdx);
    if (!bucket) {
      bucket = [];
      windowBuckets.set(windowIdx, bucket);
    }
    bucket.push(ev);
  }

  // Sort window keys in chronological order
  const sortedWindowKeys = Array.from(windowBuckets.keys()).sort((a, b) => a - b);
  const messages: string[] = [];

  for (const winKey of sortedWindowKeys) {
    const bucket = windowBuckets.get(winKey);
    if (!bucket || bucket.length === 0) continue;

    // Deterministic ordering within window: by time ascending, then by id
    bucket.sort((a, b) => {
      const timeDiff = getEventTime(a) - getEventTime(b);
      if (timeDiff !== 0) return timeDiff;
      return a.id.localeCompare(b.id);
    });

    const displayEvents = bucket.slice(0, maxEvents);
    const titles = displayEvents
      .map((e) => cleanTitle(e.title))
      .filter((t) => t.length > 0);

    if (titles.length === 0) continue;

    let message = titles.join(". ");

    if (bucket.length > maxEvents) {
      const remaining = bucket.length - maxEvents;
      message += `, and ${remaining} more`;
    }

    messages.push(message);
  }

  return messages;
}
