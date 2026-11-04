"use client";

import { TESTNET_CITIES, type TestnetCityId } from "../data/testnet.ts";
import type { ChainCity } from "../lib/chain.ts";

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
    <div aria-live="polite" className="space-y-2 pt-2 border-t border-atlas-line/60">
      <div className="text-xs font-semibold text-atlas-ink flex items-center justify-between">
        <span>Four Cities Audit Summary:</span>
        <span className="text-[11px] text-atlas-ink-muted">
          {verifiedCount} of {results.length} VERIFIED
        </span>
      </div>
      <div
        tabIndex={0}
        role="region"
        aria-label="Four cities audit verification summary table"
        className="overflow-x-auto atlas-focus rounded-xs border border-atlas-line"
      >
        <table className="w-full text-left text-[11px] border-collapse min-w-[420px]">
          <caption className="sr-only">Sequential verification results for all 4 testnet cities</caption>
          <thead className="bg-atlas-surface-raised border-b border-atlas-line text-atlas-ink-muted">
            <tr>
              <th scope="col" className="p-2">City</th>
              <th scope="col" className="p-2">Arc</th>
              <th scope="col" className="p-2">Replayed Root (200 steps)</th>
              <th scope="col" className="p-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-atlas-line/40 bg-atlas-surface">
            {results.map((row) => (
              <tr key={row.cityId} className="hover:bg-atlas-surface-raised/40">
                <td className="p-2 font-semibold text-atlas-ink">{row.name}</td>
                <td className="p-2 text-atlas-ink-muted">{TESTNET_CITIES[row.cityId].arcId}</td>
                <td className="p-2 font-mono text-atlas-ink break-all">
                  {row.replayRoot ? `${row.replayRoot.slice(0, 10)}…${row.replayRoot.slice(-6)}` : "—"}
                </td>
                <td className="p-2 font-bold">
                  <span
                    className={`px-1.5 py-0.5 rounded-xs text-[10px] ${
                      row.ok
                        ? "bg-atlas-moss text-atlas-canvas"
                        : "bg-atlas-alert text-atlas-canvas"
                    }`}
                  >
                    {row.ok ? "VERIFIED" : "MISMATCH"}
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
