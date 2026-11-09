"use client";

import { useState } from "react";
import type { ChronicleEvent } from "../data/mock-city.ts";
import { formatStep } from "../lib/format.ts";
import { LiveLog, PauseToggle } from "./ui/LiveLog.tsx";
import { LedgerPage } from "./ui/LedgerPage.tsx";
import { Icon, type IconName } from "./ui/Icons.tsx";

interface ChronicleListProps {
  events: ChronicleEvent[];
}

const KIND_METADATA: Record<
  ChronicleEvent["kind"],
  { label: string; icon: IconName }
> = {
  raid: { label: "Raid", icon: "alert" },
  drought: { label: "Drought", icon: "hourglass" },
  bloom: { label: "Bloom", icon: "bread" },
  plague: { label: "Plague", icon: "alert" },
  business: { label: "Trade", icon: "coin" },
  stage: { label: "Epoch", icon: "seal" },
  civic: { label: "Civic", icon: "quill" },
};

export function ChronicleList({ events }: ChronicleListProps) {
  const [paused, setPaused] = useState(false);

  return (
    <div>
      <LiveLog events={events} paused={paused} />
      <LedgerPage
        title="Chronicle of Events"
        headingLevel="h2"
        headerRight={
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-ledger-ink-faded">
              {events.length} {events.length === 1 ? "record" : "records"}
            </span>
            <PauseToggle paused={paused} onToggle={setPaused} />
          </div>
        }
      >
        <p className="font-body text-xs sm:text-sm text-ledger-ink-faded mb-5">
          Chronological ledger of settlements, expeditions, blights, and municipal milestones recorded by city notaries.
        </p>

        {events.length === 0 ? (
          <div
            role="status"
            className="py-12 px-4 text-center font-body text-sm text-ledger-ink-faded border-t border-b border-ledger-ink-faded/20"
          >
            No historical events recorded yet for this settlement.
          </div>
        ) : (
          <ol className="divide-y divide-ledger-ink/15 border-t border-b border-ledger-ink/20">
            {events.map((ev) => {
              const meta = KIND_METADATA[ev.kind] ?? KIND_METADATA.civic;
              // Pixel font only if short (<= 28 chars), otherwise Alegreya body font
              const isShortTitle = ev.title.trim().length <= 28;

              return (
                <li
                  key={ev.id}
                  className="py-4 px-2 sm:px-3 hover:bg-ledger-paper-shade/30 transition-colors flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-6"
                >
                  {/* Left margin column: Year and Season */}
                  <div className="shrink-0 w-28 sm:border-r sm:border-ledger-ink/15 sm:pr-4 flex flex-row sm:flex-col items-baseline justify-between sm:justify-start gap-1">
                    <span className="font-mono font-bold text-sm text-ledger-ink tabular-nums">
                      Year {ev.year}
                    </span>
                    <span className="font-body text-xs text-ledger-ink-faded">
                      {ev.season}
                    </span>
                    <span className="font-mono text-[10px] text-ledger-ink-faded/80 sm:mt-1">
                      {formatStep(ev.step)}
                    </span>
                  </div>

                  {/* Right main column: Kind, Title, Description */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-baseline gap-2 mb-1.5">
                      {/* Kind shown as icon plus word */}
                      <span className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded-xs border border-ledger-ink-faded/30 bg-ledger-paper-shade/50 font-mono text-[11px] text-ledger-ink-faded">
                        <Icon name={meta.icon} size={13} className="text-ledger-ink-faded" />
                        <span>{meta.label}</span>
                      </span>

                      {/* Title: pixel heading font if short, body font if longer */}
                      <h3
                        className={`text-ledger-ink leading-snug ${
                          isShortTitle
                            ? "font-pixel text-sm sm:text-base font-bold"
                            : "font-body text-base font-bold"
                        }`}
                      >
                        {ev.title}
                      </h3>
                    </div>

                    {/* Description in Alegreya body font */}
                    <p className="font-body text-sm text-ledger-ink leading-relaxed">
                      {ev.description}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </LedgerPage>
    </div>
  );
}
