"use client";

import type { MockCity } from "../data/mock-city.ts";
import { formatCoin, formatStep } from "../lib/format.ts";
import { Icon } from "./ui/Icons.tsx";
import { TickNumber } from "./ui/TickNumber.tsx";

interface HeaderProps {
  city: MockCity & { stateRoot?: string };
}

/** Slim HUD bar: the world is the hero, so the chrome stays one line tall on desktop. */
export function Header({ city }: HeaderProps) {
  const satisfactionPct = Math.round(city.citizens.satisfaction_bps / 100);
  const root = city.stateRoot ? `${city.stateRoot.slice(0, 8)}…${city.stateRoot.slice(-4)}` : "genesis";

  return (
    <header className="ledger-chrome sticky top-0 z-30 border-b-2 border-ledger-brass/60">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2 sm:px-6">
        <div className="flex min-w-0 items-baseline gap-3">
          <h1 className="font-pixel text-xl leading-none text-ledger-paper sm:text-2xl">AfterEarth</h1>
          <p className="truncate text-sm text-ledger-paper/75">
            <span className="text-ledger-paper">{city.name}</span>
            <span className="ml-2 font-silk text-[11px] text-ledger-brass">{city.stage_name}</span>
          </p>
        </div>

        <dl className="ml-auto flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-xs text-ledger-paper">
          <div className="flex items-center gap-1.5" role="timer" aria-live="off">
            <Icon name="hourglass" size={16} className="text-ledger-brass" />
            <dt className="sr-only">World clock</dt>
            <dd>
              <span className="font-bold">{formatStep(city.step)}</span>
              <span className="ml-1 text-ledger-paper/60">step {city.step}</span>
            </dd>
          </div>
          <div className="flex items-center gap-1.5">
            <dt className="text-ledger-paper/60">Citizens</dt>
            <dd className="font-bold">
              <TickNumber value={Number(city.citizens.population)} className="tabular-nums" />
              <span className={`ml-1 font-normal ${satisfactionPct >= 60 ? "text-ledger-paper/80" : "text-ledger-wax"}`}>
                {satisfactionPct}% content
              </span>
            </dd>
          </div>
          <div className="flex items-center gap-1.5">
            <Icon name="coin" size={16} className="text-ledger-brass" />
            <dt className="sr-only">City treasury</dt>
            <dd className="font-bold tabular-nums">{formatCoin(city.treasury)}</dd>
          </div>
          <div className="hidden items-center gap-1.5 md:flex">
            <Icon name="seal" size={16} className="text-ledger-brass" />
            <dt className="text-ledger-paper/60">Root</dt>
            <dd className="font-bold" title={city.stateRoot ?? "genesis"}>
              {root}
            </dd>
          </div>
        </dl>
      </div>
    </header>
  );
}
