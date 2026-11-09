"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { Checkpoint } from "../../../../packages/sim/src/checkpoint.ts";
import {
  type TamperKind,
  type AuditLine,
  tamperCheckpoint,
  computeBrowserRulesHash,
  createReplayState,
  auditOneCheckpoint,
} from "../lib/audit.ts";
import { TestnetAuditSection } from "./TestnetAuditSection.tsx";
import { LedgerPage } from "./ui/LedgerPage.tsx";
import { SealStamp } from "./ui/SealStamp.tsx";
import { Icon } from "./ui/Icons.tsx";
import { AuditCheckpointTable } from "./ui/AuditCheckpointTable.tsx";

interface AuditPanelProps {
  arcId: string;
  seed: string;
  cityId?: string;
  checkpoints: Checkpoint[];
}

export function AuditPanel({
  arcId,
  seed,
  cityId,
  checkpoints: incomingCheckpoints,
}: AuditPanelProps) {
  // Working checkpoints list (can be tampered for audience demo)
  const [tamperState, setTamperState] = useState<{
    index: number;
    checkpoint: Checkpoint;
    kind: TamperKind;
  } | null>(null);
  const [selectedTamperKind, setSelectedTamperKind] = useState<TamperKind>("state_root");

  // Replay verification state
  const [isAuditing, setIsAuditing] = useState<boolean>(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [auditLines, setAuditLines] = useState<AuditLine[]>([]);
  const [summary, setSummary] = useState<string>("");
  const [mismatchStep, setMismatchStep] = useState<number | string | null>(null);
  const [rulesHash, setRulesHash] = useState<string>("");
  const [copiedRootIdx, setCopiedRootIdx] = useState<number | null>(null);

  const cancelRef = useRef<boolean>(false);

  // Derive working list directly during render - no setState in effect needed
  const workingList =
    tamperState !== null && tamperState.index < incomingCheckpoints.length
      ? incomingCheckpoints.map((cp, idx) =>
          idx === tamperState.index ? tamperState.checkpoint : cp
        )
      : incomingCheckpoints;

  const tamperedIdx = tamperState?.index ?? null;

  // Compute rules hash whenever arc changes
  useEffect(() => {
    let active = true;
    computeBrowserRulesHash(arcId)
      .then((h) => {
        if (active) setRulesHash(h);
      })
      .catch(() => {
        if (active) setRulesHash("unavailable in current context");
      });
    return () => {
      active = false;
    };
  }, [arcId]);

  useEffect(() => {
    return () => { cancelRef.current = true; };
  }, []);

  const handleResetCheckpoints = useCallback(() => {
    setTamperState(null);
    setAuditLines([]);
    setSummary("");
    setMismatchStep(null);
  }, []);

  const handleTamper = useCallback(() => {
    if (incomingCheckpoints.length === 0) return;
    const targetIdx = incomingCheckpoints.length >= 2 ? 1 : 0;
    const originalCp = incomingCheckpoints[targetIdx];
    const tampered = tamperCheckpoint(originalCp, selectedTamperKind);
    setTamperState({ index: targetIdx, checkpoint: tampered, kind: selectedTamperKind });
    setAuditLines([]);
    setSummary("");
    setMismatchStep(null);
  }, [incomingCheckpoints, selectedTamperKind]);

  // Run audit chunk-by-chunk using setTimeout so browser UI does not freeze
  const handleRunAudit = useCallback(async () => {
    if (workingList.length === 0 || isAuditing) return;

    setIsAuditing(true);
    setAuditLines([]);
    setSummary("");
    setMismatchStep(null);
    cancelRef.current = false;

    const actualCityId = cityId ?? (workingList[0]?.city_id || `${arcId}_alpha`);
    const replay = createReplayState(arcId, seed, actualCityId);
    let verifiedCount = 0;
    const accumulatedLines: AuditLine[] = [];
    const total = workingList.length;

    for (let i = 0; i < total; i++) {
      if (cancelRef.current) break;
      setProgress({ current: i + 1, total });
      await new Promise((resolve) => setTimeout(resolve, 60));

      const res = auditOneCheckpoint(replay, workingList[i], arcId, i);
      accumulatedLines.push(res.line);
      setAuditLines([...accumulatedLines]);

      if (!res.ok) {
        setSummary(res.error || "Mismatch encountered during replay");
        setMismatchStep(workingList[i]?.from_step ?? i * 40);
        setIsAuditing(false);
        setProgress(null);
        return;
      }
      verifiedCount++;
    }

    setSummary(`VERIFIED: ${verifiedCount} checkpoints match the replay`);
    setMismatchStep(null);
    setIsAuditing(false);
    setProgress(null);
  }, [workingList, isAuditing, cityId, arcId, seed]);

  const handleCopyRoot = (root: string, idx: number) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(root).catch(() => {});
    }
    setCopiedRootIdx(idx);
    setTimeout(() => {
      setCopiedRootIdx((curr) => (curr === idx ? null : curr));
    }, 2000);
  };

  const hasCheckpoints = workingList.length > 0;
  const tamperTargetLabel = workingList.length >= 2 ? "checkpoint 2 (step 40..80)" : "checkpoint 1 (step 0..40)";

  return (
    <LedgerPage
      title="Audit City & Replay Verification"
      headingLevel="h2"
      headerRight={
        <span className="font-mono text-xs text-ledger-ink-faded">
          {workingList.length} {workingList.length === 1 ? "checkpoint" : "checkpoints"}
        </span>
      }
    >
      <div className="space-y-6">
        <p className="font-body text-xs sm:text-sm text-ledger-ink-faded leading-relaxed">
          Ruled notary verification ledger. Checkpoints are recorded every 40 steps from deterministic state hashes. On live networks, operators publish these to NEAR for zero-trust independent browser audits.
        </p>

        {/* Rules Hash */}
        <div className="p-3 border border-ledger-ink-faded/20 bg-ledger-paper-shade/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono">
          <span className="text-ledger-ink-faded">Rulebook SHA-256 Digest:</span>
          <code className="text-ledger-ink font-semibold break-all">
            {rulesHash || "computing sha256..."}
          </code>
        </div>

        {/* Checkpoint Rows as a Ruled Ledger Table */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-mono text-ledger-ink-faded">
            <span className="font-silk uppercase tracking-wider text-[11px]">Checkpoint State Root Ledger</span>
            {!hasCheckpoints && (
              <span className="text-ledger-wax font-semibold">Advance at least 40 steps to build checkpoint</span>
            )}
          </div>

          <AuditCheckpointTable
            checkpoints={workingList}
            tamperedIdx={tamperedIdx}
            tamperState={tamperState}
            copiedRootIdx={copiedRootIdx}
            onCopyRoot={handleCopyRoot}
          />
        </div>

        {/* Controls & Tamper Demo Bar */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleRunAudit}
            disabled={!hasCheckpoints || isAuditing}
            className={`min-h-[44px] px-5 py-2.5 font-pixel text-xs transition-colors flex items-center gap-2 cursor-pointer border focus-visible:outline-2 focus-visible:outline-ledger-brass ${
              !hasCheckpoints || isAuditing
                ? "bg-ledger-paper-shade/40 text-ledger-ink-faded/60 border-ledger-ink-faded/20 cursor-not-allowed"
                : "bg-ledger-paper text-ledger-ink font-bold border-ledger-ink shadow-[2px_2px_0_0_var(--ledger-ink)] hover:bg-ledger-paper-shade/60 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
            }`}
            aria-label={
              !hasCheckpoints
                ? "Audit this city (disabled: advance at least 40 steps)"
                : "Audit this city and replay simulation from genesis"
            }
          >
            <Icon name="scale" size={16} aria-hidden="true" />
            <span>{isAuditing ? "Replaying simulation…" : "Audit this city"}</span>
          </button>

          <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
            <label htmlFor="tamper-kind-select" className="text-ledger-ink-faded">
              Demo tamper:
            </label>
            <select
              id="tamper-kind-select"
              value={selectedTamperKind}
              onChange={(e) => setSelectedTamperKind(e.target.value as TamperKind)}
              disabled={isAuditing || !hasCheckpoints}
              className="bg-ledger-paper border border-ledger-ink-faded/40 text-ledger-ink px-2.5 py-1.5 min-h-[44px] focus-visible:outline-2 focus-visible:outline-ledger-brass"
            >
              <option value="state_root">Corrupt state_root</option>
              <option value="produced+1">produced+1 flow</option>
              <option value="stage">Stage mismatch</option>
            </select>
            <button
              type="button"
              onClick={handleTamper}
              disabled={isAuditing || !hasCheckpoints}
              className="min-h-[44px] px-3.5 py-1.5 font-pixel text-xs bg-ledger-paper-shade/40 border border-ledger-wax/60 text-ledger-wax hover:bg-ledger-wax/10 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1 focus-visible:outline-2 focus-visible:outline-ledger-brass"
              title={`[Demo] Tamper with ${tamperTargetLabel} to test mismatch detection`}
            >
              <Icon name="alert" size={14} aria-hidden="true" />
              <span>[Demo] Tamper with checkpoint {workingList.length >= 2 ? "2" : "1"}</span>
            </button>
            {tamperedIdx !== null && (
              <button
                type="button"
                onClick={handleResetCheckpoints}
                disabled={isAuditing}
                className="min-h-[44px] px-3 py-1.5 font-pixel text-xs text-ledger-ink-faded hover:text-ledger-ink underline inline-flex items-center cursor-pointer focus-visible:outline-2 focus-visible:outline-ledger-brass"
              >
                Restore honest
              </button>
            )}
          </div>
        </div>

        {/* Determinate Progress Bar (Text + Determinate bar, No spinner) */}
        {isAuditing && progress && (
          <div className="space-y-1.5" role="status" aria-live="polite">
            <div className="flex items-center justify-between text-xs font-mono text-ledger-ink-faded">
              <span>
                Replaying simulation: checkpoint {progress.current} of {progress.total}
              </span>
              <span>{Math.round((progress.current / progress.total) * 100)}%</span>
            </div>
            <div
              role="progressbar"
              aria-valuenow={progress.current}
              aria-valuemin={1}
              aria-valuemax={progress.total}
              aria-label="Replay verification progress"
              className="w-full bg-ledger-paper-shade/60 border border-ledger-ink-faded/30 h-2.5 overflow-hidden"
            >
              <div
                className="bg-ledger-brass h-full transition-all duration-150"
                style={{ width: `${Math.round((progress.current / progress.total) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Verdict: The Single Dramatic Moment with SealStamp */}
        <div aria-live="polite" role="status" aria-atomic="true">
          {summary && (
            <div className="my-5 p-5 border-2 border-dashed border-ledger-ink-faded/30 bg-ledger-paper-shade/30 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="space-y-1 text-center sm:text-left">
                <div className="font-pixel text-base sm:text-lg text-ledger-ink font-bold">
                  {summary.startsWith("VERIFIED")
                    ? "Audit Replay Verification Succeeded"
                    : "Audit Replay Divergence Detected"}
                </div>
                <div className="font-mono text-xs text-ledger-ink-faded break-all">
                  {summary}
                </div>
              </div>
              <div className="shrink-0">
                <SealStamp
                  key={`${summary.startsWith("VERIFIED") ? "verified" : "mismatch"}-${mismatchStep ?? "ok"}`}
                  result={summary.startsWith("VERIFIED") ? "verified" : "mismatch"}
                  label={
                    summary.startsWith("VERIFIED")
                      ? `${workingList.length} CHECKPOINTS HONEST`
                      : `FIRST DIFFERING STEP: ${mismatchStep !== null ? mismatchStep : "UNKNOWN"}`
                  }
                />
              </div>
            </div>
          )}

          {auditLines.length > 0 && (
            <ul className="space-y-1.5 font-mono text-xs pt-2">
              {auditLines.map((line, idx) => (
                <li
                  key={`${line.window}-${idx}`}
                  className="p-2 border border-ledger-ink-faded/20 bg-ledger-paper-shade/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 border text-[10px] font-silk font-bold ${
                        line.status === "OK"
                          ? "border-ledger-verdigris/40 bg-ledger-verdigris/10 text-ledger-verdigris"
                          : "border-ledger-wax/50 bg-ledger-wax/10 text-ledger-wax"
                      }`}
                    >
                      <Icon
                        name={line.status === "OK" ? "seal" : "alert"}
                        size={12}
                        aria-hidden="true"
                      />
                      <span>{line.status}</span>
                    </span>
                    <span className="font-semibold text-ledger-ink">{line.window}</span>
                  </div>
                  {line.detail && (
                    <span className="text-[11px] text-ledger-ink-faded break-all sm:text-right">
                      {line.detail}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Verify against NEAR testnet (4 Cities) */}
        <TestnetAuditSection />
      </div>
    </LedgerPage>
  );
}

export default AuditPanel;
