"use client";

import type { Checkpoint } from "../../../../../packages/sim/src/checkpoint.ts";
import type { TamperKind } from "../../lib/audit.ts";
import { Icon } from "./Icons.tsx";

export interface AuditCheckpointTableProps {
  checkpoints: Checkpoint[];
  tamperedIdx: number | null;
  tamperState: {
    index: number;
    checkpoint: Checkpoint;
    kind: TamperKind;
  } | null;
  copiedRootIdx: number | null;
  onCopyRoot: (root: string, idx: number) => void;
}

export function AuditCheckpointTable({
  checkpoints,
  tamperedIdx,
  tamperState,
  copiedRootIdx,
  onCopyRoot,
}: AuditCheckpointTableProps) {
  if (checkpoints.length === 0) {
    return (
      <div
        role="status"
        className="p-6 text-center border border-dashed border-ledger-ink-faded/30 font-body text-xs text-ledger-ink-faded"
      >
        No checkpoints generated yet. Use the simulation controls above to advance at least 40 steps.
      </div>
    );
  }

  return (
    <div
      tabIndex={0}
      role="region"
      aria-label="State root checkpoints ruled ledger"
      className="overflow-x-auto border border-ledger-ink-faded/30 bg-ledger-paper-shade/20 focus-visible:outline-2 focus-visible:outline-ledger-brass"
    >
      <table className="w-full text-left font-mono text-xs border-collapse min-w-[540px]">
        <caption className="sr-only">State root checkpoints chain ledger</caption>
        <thead className="bg-ledger-paper-shade/40 border-b border-ledger-ink-faded/30 text-ledger-ink-faded font-silk text-[10px] uppercase tracking-wider">
          <tr>
            <th scope="col" className="py-2 px-3">Window (Steps)</th>
            <th scope="col" className="py-2 px-3">Stage</th>
            <th scope="col" className="py-2 px-3">State Root</th>
            <th scope="col" className="py-2 px-3">Status</th>
            <th scope="col" className="py-2 px-3 text-right">Affordance</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ledger-ink/10">
          {checkpoints.map((cp, idx) => {
            const isTampered = tamperedIdx === idx;
            const shortRoot = `${cp.new_state_root.slice(0, 10)}…${cp.new_state_root.slice(-6)}`;
            return (
              <tr
                key={`${cp.from_step}-${cp.to_step}-${idx}`}
                className={`transition-colors ${
                  isTampered
                    ? "bg-ledger-wax/10"
                    : "hover:bg-ledger-paper-shade/50"
                }`}
              >
                <td className="py-2.5 px-3 font-semibold text-ledger-ink tabular-nums">
                  {cp.from_step}..{cp.to_step}
                </td>
                <td className="py-2.5 px-3 text-ledger-ink-faded">
                  Stage {cp.stage}
                </td>
                <td className="py-2.5 px-3 font-mono text-[11px] text-ledger-ink break-all tabular-nums">
                  {shortRoot}
                </td>
                <td className="py-2.5 px-3">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 border text-[10px] font-silk font-bold uppercase tracking-wider ${
                      isTampered
                        ? "border-ledger-wax/50 bg-ledger-wax/10 text-ledger-wax"
                        : "border-ledger-verdigris/50 bg-ledger-verdigris/10 text-ledger-verdigris"
                    }`}
                  >
                    <Icon
                      name={isTampered ? "alert" : "seal"}
                      size={12}
                      aria-hidden="true"
                    />
                    <span>{isTampered ? `TAMPERED (${tamperState?.kind})` : "HONEST"}</span>
                  </span>
                </td>
                <td className="py-2.5 px-3 text-right">
                  <button
                    type="button"
                    onClick={() => onCopyRoot(cp.new_state_root, idx)}
                    aria-label={`Copy full state root for steps ${cp.from_step} to ${cp.to_step}`}
                    className="min-h-[44px] min-w-[44px] px-2.5 py-1 text-xs font-pixel border border-ledger-ink-faded/30 bg-ledger-paper hover:bg-ledger-paper-shade/60 text-ledger-ink transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-ledger-brass"
                  >
                    {copiedRootIdx === idx ? "Copied" : "Copy"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default AuditCheckpointTable;
