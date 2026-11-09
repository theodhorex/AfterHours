"use client";

import { formatCoin } from "../../lib/format.ts";
import type { LeaderboardEntry } from "../../lib/agents.ts";
import { Icon } from "./Icons.tsx";

export type RowVerifyStatus = "idle" | "verifying" | "verified" | "mismatch";

export interface AgentLeaderboardTableProps {
  seed: string;
  leaderboard: LeaderboardEntry[];
  rowVerifyState: Record<string, RowVerifyStatus>;
  onReverifyRow: (entry: LeaderboardEntry) => void;
  onRemoveEntry: (entryId: string) => void;
}

export function AgentLeaderboardTable({
  seed,
  leaderboard,
  rowVerifyState,
  onReverifyRow,
  onRemoveEntry,
}: AgentLeaderboardTableProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-xs">
        <span className="font-silk text-xs uppercase tracking-wider text-ledger-ink font-bold">
          Verified Leaderboard (Seed: {seed})
        </span>
        <span className="text-ledger-ink-faded text-[11px]">Ranked by score, then trades</span>
      </div>

      <div
        tabIndex={0}
        role="region"
        aria-label="Autonomous agent verified leaderboard"
        className="overflow-x-auto border border-ledger-ink-faded/30 bg-ledger-paper-shade/20 focus-visible:outline-2 focus-visible:outline-ledger-brass"
      >
        <table className="w-full text-left font-mono text-xs border-collapse min-w-[500px]">
          <caption className="sr-only">
            Anyone can re-run this agent on the same seed and get the same score and state root (mock mode, no chain)
          </caption>
          <thead className="bg-ledger-paper-shade/40 border-b border-ledger-ink-faded/30 text-ledger-ink-faded font-silk text-[10px] uppercase tracking-wider">
            <tr>
              <th scope="col" className="py-2.5 px-3 text-center w-10">#</th>
              <th scope="col" className="py-2.5 px-3">Agent</th>
              <th scope="col" className="py-2.5 px-3 text-right">Score</th>
              <th scope="col" className="py-2.5 px-3 text-center">Trades</th>
              <th scope="col" className="py-2.5 px-3">Root (first 12)</th>
              <th scope="col" className="py-2.5 px-3 text-right">Verification</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ledger-ink/10">
            {leaderboard.length === 0 ? (
              <tr>
                <td colSpan={6} role="status" className="p-8 text-center text-ledger-ink-faded font-body text-xs">
                  No backtests recorded yet. Run a backtest on the left to rank your agent.
                </td>
              </tr>
            ) : (
              leaderboard.map((entry, index) => {
                const status = rowVerifyState[entry.id] ?? "idle";
                const isPositiveScore = entry.score > 0n;

                return (
                  <tr key={entry.id} className="hover:bg-ledger-paper-shade/50 transition-colors">
                    <td className="py-2.5 px-3 text-center font-bold text-ledger-ink-faded tabular-nums">
                      {index + 1}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-ledger-ink font-body text-sm leading-tight">{entry.name}</div>
                      <div className="text-[10px] text-ledger-ink-faded tabular-nums">
                        {entry.steps} steps • start {entry.startCoin.toString()}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-ledger-ink tabular-nums">
                      {isPositiveScore ? "+" : ""}
                      {formatCoin(entry.score)}
                    </td>
                    <td className="py-2.5 px-3 text-center text-ledger-ink-faded tabular-nums">
                      {entry.trades}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-ledger-ink tabular-nums">
                      {entry.stateRoot.slice(0, 12)}…
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {status === "verifying" && (
                          <span role="status" aria-live="polite" className="inline-flex items-center gap-1 text-[10px] text-ledger-ink-faded font-silk">
                            <Icon name="hourglass" size={12} aria-hidden="true" />
                            <span>Replaying...</span>
                          </span>
                        )}
                        {status === "verified" && (
                          <span role="status" aria-live="polite" className="inline-flex items-center gap-1 px-1.5 py-0.5 border border-ledger-verdigris/50 bg-ledger-verdigris/10 text-ledger-verdigris font-silk font-bold text-[10px]">
                            <Icon name="seal" size={12} aria-hidden="true" />
                            <span>VERIFIED</span>
                          </span>
                        )}
                        {status === "mismatch" && (
                          <span role="status" aria-live="polite" className="inline-flex items-center gap-1 px-1.5 py-0.5 border border-ledger-wax/50 bg-ledger-wax/10 text-ledger-wax font-silk font-bold text-[10px]">
                            <Icon name="alert" size={12} aria-hidden="true" />
                            <span>MISMATCH</span>
                          </span>
                        )}
                        {status === "idle" && (
                          <button
                            type="button"
                            onClick={() => onReverifyRow(entry)}
                            className="min-h-[44px] min-w-[44px] px-2.5 py-1 text-[11px] font-pixel border border-ledger-ink-faded/30 bg-ledger-paper hover:bg-ledger-paper-shade/60 text-ledger-ink transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-ledger-brass"
                            title="Re-run simulation to verify score and state root"
                            aria-label={`Re-verify simulation for ${entry.name}`}
                          >
                            Re-verify
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onRemoveEntry(entry.id)}
                          className="min-h-[44px] min-w-[44px] px-2 py-1 text-xs font-mono text-ledger-ink-faded hover:text-ledger-wax transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-ledger-brass inline-flex items-center justify-center border border-transparent hover:border-ledger-wax/30"
                          aria-label={`Remove ${entry.name} from leaderboard`}
                          title="Remove entry"
                        >
                          Del
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] font-body text-ledger-ink-faded leading-relaxed italic">
        Anyone can re-run this agent on the same seed and achieve the exact same score and state root deterministically.
      </p>
    </div>
  );
}

export default AgentLeaderboardTable;
