"use client";

import type { ChronicleEvent } from "../data/mock-city.ts";
import { formatStep } from "../lib/format.ts";

interface ChronicleListProps {
  events: ChronicleEvent[];
}

const KIND_COLORS: Record<ChronicleEvent["kind"], { label: string; bg: string; text: string; border: string }> = {
  raid: { label: "Raid", bg: "bg-atlas-alert/15", text: "text-atlas-alert", border: "border-atlas-alert/40" },
  drought: { label: "Drought", bg: "bg-atlas-ember/15", text: "text-atlas-ember", border: "border-atlas-ember/40" },
  bloom: { label: "Bloom", bg: "bg-atlas-moss/15", text: "text-atlas-moss", border: "border-atlas-moss/40" },
  plague: { label: "Plague", bg: "bg-atlas-alert/20", text: "text-atlas-alert", border: "border-atlas-alert/50" },
  business: { label: "Trade", bg: "bg-atlas-gold/15", text: "text-atlas-gold", border: "border-atlas-gold/40" },
  stage: { label: "Epoch", bg: "bg-atlas-arcane/15", text: "text-atlas-arcane", border: "border-atlas-arcane/40" },
  civic: { label: "Civic", bg: "bg-atlas-surface-raised", text: "text-atlas-ink", border: "border-atlas-line" },
};

export function ChronicleList({ events }: ChronicleListProps) {
  return (
    <div className="atlas-panel rounded-sm p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-atlas-line pb-3 mb-4">
        <div>
          <h2 className="text-base sm:text-lg font-display font-semibold text-atlas-ink">
            Chronicle of the Warrens
          </h2>
          <p className="text-xs text-atlas-ink-muted">
            Historical records, dragon raids, blights, and settlement milestones.
          </p>
        </div>
        <span className="text-xs font-mono text-atlas-ink-muted">
          {events.length} Historical Records
        </span>
      </div>

      {/* Events timeline */}
      {events.length === 0 ? (
        <div role="status" className="text-xs font-mono text-atlas-ash italic py-4 text-center">
          No historical events recorded yet for this settlement.
        </div>
      ) : (
        <ol className="relative border-l border-atlas-line-strong ml-2 space-y-4">
          {events.map((ev) => {
            const style = KIND_COLORS[ev.kind] ?? KIND_COLORS.civic;

            return (
              <li key={ev.id} className="ml-4 pl-1">
                {/* Timeline marker pip */}
                <div
                  className="absolute -left-1.5 mt-1.5 w-3 h-3 rounded-full bg-atlas-canvas border-2 border-atlas-line-strong"
                  aria-hidden="true"
                />

                <div className="bg-atlas-surface-raised/60 hover:bg-atlas-surface-raised p-3 rounded-xs border border-atlas-line transition-colors">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-mono font-medium uppercase tracking-wider px-1.5 py-0.5 rounded-xs border ${style.bg} ${style.text} ${style.border}`}
                      >
                        {style.label}
                      </span>
                      <h3 className="font-display font-semibold text-sm text-atlas-ink">
                        {ev.title}
                      </h3>
                    </div>

                    <span className="font-mono text-[11px] text-atlas-gold">
                      {formatStep(ev.step)}
                    </span>
                  </div>

                  <p className="text-xs text-atlas-ink-muted leading-relaxed">
                    {ev.description}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
