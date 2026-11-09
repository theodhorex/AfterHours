"use client";

import { TESTNET_CITIES, type TestnetCityId } from "../data/testnet.ts";
import type { ChainCity } from "../lib/chain.ts";
import { Icon } from "./ui/Icons.tsx";

export interface CityVerificationResult {
  cityId: TestnetCityId;
  name: string;
  ok: boolean;
  message: string;
  replayRoot?: string;
  chainCity?: ChainCity | null;
  error?: string;
}

interface TestnetSummaryTableProps {
  results: CityVerificationResult[];
}

export function TestnetSummaryTable({ results }: TestnetSummaryTableProps) {
  const verifiedCount = results.filter((r) => r.ok).length;

  return (
    <div aria-live="polite" className="space-y-3 pt-3 border-t border-ledger-ink-faded/20">
      <div className="text-xs font-mono text-ledger-ink flex items-center justify-between">
        <span className="font-bold">Four Cities Audit Summary:</span>
        <span className="text-[11px] text-ledger-ink-faded">
          {verifiedCount} of {results.length} VERIFIED
        </span>
      </div>

      <div
        tabIndex={0}
        role="region"
        aria-label="Four cities audit verification summary table"
        className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-ledger-brass border border-ledger-ink-faded/30 bg-ledger-paper-shade/20"
      >
        <table className="w-full text-left font-mono text-xs border-collapse min-w-[460px]">
          <caption className="sr-only">Sequential verification results for all 4 testnet cities</caption>
          <thead className="bg-ledger-paper-shade/40 border-b border-ledger-ink-faded/30 text-ledger-ink-faded font-silk text-[10px] uppercase tracking-wider">
            <tr>
              <th scope="col" className="py-2.5 px-3">City</th>
              <th scope="col" className="py-2.5 px-3">Arc</th>
              <th scope="col" className="py-2.5 px-3">Replayed Root (200 steps)</th>
              <th scope="col" className="py-2.5 px-3 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ledger-ink/10">
            {results.map((row) => (
              <tr key={row.cityId} className="hover:bg-ledger-paper-shade/50 transition-colors">
                <td className="py-2 px-3 font-semibold text-ledger-ink font-body text-sm">
                  {row.name}
                </td>
                <td className="py-2 px-3 text-ledger-ink-faded text-xs">
                  {TESTNET_CITIES[row.cityId].arcId}
                </td>
                <td className="py-2 px-3 font-mono text-[11px] text-ledger-ink break-all tabular-nums">
                  {row.replayRoot ? `${row.replayRoot.slice(0, 10)}…${row.replayRoot.slice(-6)}` : "—"}
                </td>
                <td className="py-2 px-3 text-right">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 border text-[10px] font-silk font-bold uppercase tracking-wider ${
                      row.ok
                        ? "border-ledger-verdigris/50 bg-ledger-verdigris/10 text-ledger-verdigris"
                        : "border-ledger-wax/50 bg-ledger-wax/10 text-ledger-wax"
                    }`}
                  >
                    <Icon
                      name={row.ok ? "seal" : "alert"}
                      size={12}
                      aria-hidden="true"
                    />
                    <span>{row.ok ? "VERIFIED" : "MISMATCH"}</span>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default TestnetSummaryTable;
