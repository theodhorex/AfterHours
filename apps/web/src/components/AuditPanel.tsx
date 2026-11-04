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
  replayToStep,
} from "../lib/audit.ts";
import {
  TESTNET_CONTRACT_ID,
  TESTNET_CITY_ID,
  TESTNET_ARC_ID,
  TESTNET_SEED,
  TESTNET_STEPS,
  TESTNET_CHECKPOINTS,
  buildExplorerTxUrl,
} from "../data/testnet.ts";
import {
  fetchCityFromChain,
  compareToChain,
  type ChainCity,
} from "../lib/chain.ts";

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
  const [rulesHash, setRulesHash] = useState<string>("");

  // Testnet verification state
  const [isComparingChain, setIsComparingChain] = useState<boolean>(false);
  const [chainResult, setChainResult] = useState<{
    ok: boolean;
    message: string;
    replayRoot?: string;
    chainCity?: ChainCity | null;
  } | null>(null);

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

  // Cancel audit if unmounting
  useEffect(() => {
    return () => {
      cancelRef.current = true;
    };
  }, []);

  // Reset any tamper and restore honest checkpoints
  const handleResetCheckpoints = useCallback(() => {
    setTamperState(null);
    setAuditLines([]);
    setSummary("");
  }, []);

  // Tamper with checkpoint 2 (or index 1, fallback to 0 if only 1 exists)
  const handleTamper = useCallback(() => {
    if (incomingCheckpoints.length === 0) return;
    const targetIdx = incomingCheckpoints.length >= 2 ? 1 : 0;
    const originalCp = incomingCheckpoints[targetIdx];
    const tampered = tamperCheckpoint(originalCp, selectedTamperKind);

    setTamperState({
      index: targetIdx,
      checkpoint: tampered,
      kind: selectedTamperKind,
    });
    setAuditLines([]);
    setSummary("");
  }, [incomingCheckpoints, selectedTamperKind]);

  // Run audit chunk-by-chunk using setTimeout so browser UI does not freeze
  const handleRunAudit = useCallback(async () => {
    if (workingList.length === 0 || isAuditing) return;

    setIsAuditing(true);
    setAuditLines([]);
    setSummary("");
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
        setIsAuditing(false);
        setProgress(null);
        return;
      }
      verifiedCount++;
    }

    setSummary(`VERIFIED: ${verifiedCount} checkpoints match the replay`);
    setIsAuditing(false);
    setProgress(null);
  }, [workingList, isAuditing, cityId, arcId, seed]);

  // Replay goblin_warrens seed demo for 200 steps and verify against NEAR testnet
  const handleVerifyTestnet = useCallback(async () => {
    if (isComparingChain) return;
    setIsComparingChain(true);
    setChainResult(null);

    try {
      // Yield to let browser render the loading state
      await new Promise((resolve) => setTimeout(resolve, 30));

      const { stateRoot, step: replayedStep } = replayToStep(
        TESTNET_ARC_ID,
        TESTNET_SEED,
        TESTNET_STEPS,
        TESTNET_CITY_ID
      );

      const fetchRes = await fetchCityFromChain(TESTNET_CONTRACT_ID, TESTNET_CITY_ID);
      if (!fetchRes.ok) {
        setChainResult({
          ok: false,
          message: `FAILED: could not fetch city from chain: ${fetchRes.error}`,
          replayRoot: stateRoot,
        });
        setIsComparingChain(false);
        return;
      }

      const cmp = compareToChain(stateRoot, replayedStep, fetchRes.city);
      setChainResult({
        ok: cmp.ok,
        message: cmp.reason,
        replayRoot: stateRoot,
        chainCity: fetchRes.city,
      });
    } catch (err: unknown) {
      setChainResult({
        ok: false,
        message: `FAILED: unexpected error during replay verification: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setIsComparingChain(false);
    }
  }, [isComparingChain]);

  const hasCheckpoints = workingList.length > 0;
  const tamperTargetLabel = workingList.length >= 2 ? "checkpoint 2 (step 40..80)" : "checkpoint 1 (step 0..40)";

  return (
    <section aria-labelledby="audit-panel-heading" className="atlas-panel rounded-sm p-4 sm:p-5 border border-atlas-line space-y-4">
      {/* Header & Honest copy */}
      <div className="border-b border-atlas-line pb-3 space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="audit-panel-heading" className="text-base sm:text-lg font-display font-semibold text-atlas-ink flex items-center gap-2">
            <span aria-hidden="true" className="text-atlas-gold">⚖️</span>
            Audit This City (Browser Replay Verification)
          </h2>
          <span className="font-mono text-xs px-2 py-0.5 rounded-xs bg-atlas-surface-raised border border-atlas-line text-atlas-ink-muted">
            {workingList.length} {workingList.length === 1 ? "checkpoint" : "checkpoints"}
          </span>
        </div>
        <p className="text-xs text-atlas-ink-muted leading-relaxed">
          Checkpoints here are built in your browser (mock mode, no chain). On a deployment the operator publishes them to NEAR and anyone can run this same check.
        </p>
      </div>

      {/* Rules Hash */}
      <div className="p-2.5 rounded-xs bg-atlas-surface-raised/60 border border-atlas-line/60 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs font-mono">
        <span className="text-atlas-ink-muted">rules hash (compare with the on-chain value in a real deployment):</span>
        <code className="text-atlas-gold break-all selection:bg-atlas-gold selection:text-atlas-canvas">
          {rulesHash || "computing sha256..."}
        </code>
      </div>

      {/* State Root Chain Overview */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-atlas-ink-muted font-mono">
          <span>State Root Chain (every 40 steps)</span>
          {!hasCheckpoints && <span className="text-atlas-ember">advance at least 40 steps to build checkpoint</span>}
        </div>

        {hasCheckpoints ? (
          <div className="overflow-x-auto">
            <div className="flex gap-2 pb-1 min-w-full">
              {workingList.map((cp, idx) => {
                const isTampered = tamperedIdx === idx;
                return (
                  <div
                    key={`${cp.from_step}-${cp.to_step}-${idx}`}
                    className={`shrink-0 p-2.5 rounded-xs border font-mono text-xs space-y-1 ${
                      isTampered
                        ? "border-atlas-alert bg-atlas-alert/15 text-atlas-alert"
                        : "border-atlas-line bg-atlas-surface-raised text-atlas-ink"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 text-[11px] text-atlas-ink-muted">
                      <span>Window {cp.from_step}..{cp.to_step}</span>
                      <span className="text-atlas-gold">Stage {cp.stage}</span>
                    </div>
                    <div className="text-xs font-semibold">
                      Root: <span className="text-atlas-ink">{cp.new_state_root.slice(0, 12)}…</span>
                    </div>
                    {isTampered && (
                      <div className="text-[10px] text-atlas-alert font-bold uppercase tracking-wider">
                        Tampered ({tamperState?.kind})
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="p-3 text-center rounded-xs bg-atlas-canvas/50 border border-dashed border-atlas-line text-xs font-mono text-atlas-ash">
            No checkpoints generated yet. Use the simulation controls above to advance at least 40 steps.
          </div>
        )}
      </div>

      {/* Controls & Tamper */}
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button
          type="button"
          onClick={handleRunAudit}
          disabled={!hasCheckpoints || isAuditing}
          className={`atlas-focus px-4 py-2 rounded-xs font-mono font-semibold text-xs transition-colors flex items-center gap-2 ${
            !hasCheckpoints || isAuditing
              ? "bg-atlas-ash/20 text-atlas-ash border border-atlas-line cursor-not-allowed"
              : "bg-atlas-gold text-atlas-canvas hover:bg-atlas-gold/90 border border-atlas-gold cursor-pointer"
          }`}
          aria-label={
            !hasCheckpoints
              ? "Audit this city (disabled: advance at least 40 steps)"
              : "Audit this city and replay simulation from genesis"
          }
        >
          {isAuditing ? (
            <>
              <span className="inline-block animate-spin" aria-hidden="true">⏳</span>
              <span>Replaying Simulation ({progress?.current}/{progress?.total})…</span>
            </>
          ) : (
            <>
              <span aria-hidden="true">🔍</span>
              <span>Audit this city</span>
            </>
          )}
        </button>

        <div className="flex items-center gap-2 font-mono text-xs">
          <label htmlFor="tamper-kind-select" className="text-atlas-ink-muted">Demo tamper:</label>
          <select
            id="tamper-kind-select"
            value={selectedTamperKind}
            onChange={(e) => setSelectedTamperKind(e.target.value as TamperKind)}
            disabled={isAuditing || !hasCheckpoints}
            className="atlas-focus bg-atlas-surface border border-atlas-line text-atlas-ink px-2 py-1.5 rounded-xs"
          >
            <option value="state_root">Corrupt state_root</option>
            <option value="produced+1">produced+1 flow</option>
            <option value="stage">Stage mismatch</option>
          </select>
          <button
            type="button"
            onClick={handleTamper}
            disabled={isAuditing || !hasCheckpoints}
            className="atlas-focus px-3 py-1.5 rounded-xs bg-atlas-surface-raised border border-atlas-ember text-atlas-ember hover:bg-atlas-ember/15 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            title={`Tamper with ${tamperTargetLabel} to test mismatch detection`}
          >
            Tamper with checkpoint {workingList.length >= 2 ? "2" : "1"}
          </button>
          {tamperedIdx !== null && (
            <button
              type="button"
              onClick={handleResetCheckpoints}
              disabled={isAuditing}
              className="atlas-focus px-2.5 py-1.5 rounded-xs text-atlas-ink-muted hover:text-atlas-ink underline text-[11px]"
            >
              Restore honest
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      {isAuditing && progress && (
        <div
          role="progressbar"
          aria-valuenow={progress.current}
          aria-valuemin={1}
          aria-valuemax={progress.total}
          aria-label="Replay verification progress"
          className="w-full bg-atlas-surface-raised rounded-xs h-2 overflow-hidden border border-atlas-line"
        >
          <div
            className="bg-atlas-gold h-full transition-all duration-150"
            style={{ width: `${Math.round((progress.current / progress.total) * 100)}%` }}
          />
        </div>
      )}

      {/* Results Announcement */}
      <div aria-live="polite" role="status" aria-atomic="true" className="space-y-2 pt-2 border-t border-atlas-line/60">
        {auditLines.length > 0 && (
          <ul className="space-y-1.5 font-mono text-xs">
            {auditLines.map((line, idx) => (
              <li
                key={`${line.window}-${idx}`}
                className={`p-2 rounded-xs border flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                  line.status === "OK"
                    ? "border-atlas-moss/40 bg-atlas-moss/10 text-atlas-ink"
                    : "border-atlas-alert/50 bg-atlas-alert/15 text-atlas-alert"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`px-1.5 py-0.5 rounded-xs font-bold text-[10px] ${
                      line.status === "OK" ? "bg-atlas-moss text-atlas-canvas" : "bg-atlas-alert text-atlas-canvas"
                    }`}
                  >
                    {line.status}
                  </span>
                  <span className="font-semibold">{line.window}</span>
                </div>
                {line.detail && (
                  <span className="text-[11px] text-atlas-ink-muted break-all sm:text-right">{line.detail}</span>
                )}
              </li>
            ))}
          </ul>
        )}

        {summary && (
          <div
            className={`p-3 rounded-xs font-mono text-xs font-bold border ${
              summary.startsWith("VERIFIED")
                ? "border-atlas-moss bg-atlas-moss/20 text-atlas-moss"
                : "border-atlas-alert bg-atlas-alert/20 text-atlas-alert"
            }`}
          >
            {summary}
          </div>
        )}
      </div>

      {/* Verify against NEAR testnet Section */}
      <div className="pt-4 border-t border-atlas-line space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
          <h3 className="text-sm font-display font-semibold text-atlas-ink flex items-center gap-2">
            <span aria-hidden="true" className="text-atlas-gold">🌐</span>
            Verify against NEAR testnet
          </h3>
          <span className="font-mono text-xs text-atlas-ink-muted break-all">
            Contract: <code className="text-atlas-gold selection:bg-atlas-gold selection:text-atlas-canvas">{TESTNET_CONTRACT_ID}</code>
          </span>
        </div>

        <p className="text-xs text-atlas-ink-muted leading-relaxed">
          On-chain city <code className="text-atlas-ink">{TESTNET_CITY_ID}</code> (arc: {TESTNET_ARC_ID}, seed: {TESTNET_SEED}) has 200 steps committed on NEAR testnet across 5 checkpoints. Replay independently in your browser and compare the resulting state root against the smart contract.
        </p>

        {/* Action Button */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleVerifyTestnet}
            disabled={isComparingChain}
            className={`atlas-focus px-3.5 py-2 rounded-xs font-mono font-semibold text-xs transition-colors flex items-center gap-2 ${
              isComparingChain
                ? "bg-atlas-ash/20 text-atlas-ash border border-atlas-line cursor-not-allowed"
                : "bg-atlas-surface-raised border border-atlas-gold text-atlas-gold hover:bg-atlas-gold/15 cursor-pointer"
            }`}
            aria-label="Replay seed demo and compare with chain"
          >
            {isComparingChain ? (
              <>
                <span className="inline-block animate-spin" aria-hidden="true">⏳</span>
                <span>Replaying 200 steps & querying chain…</span>
              </>
            ) : (
              <>
                <span aria-hidden="true">⚡</span>
                <span>Replay seed <code>demo</code> and compare with chain</span>
              </>
            )}
          </button>
        </div>

        {/* Live Region for Results */}
        <div aria-live="polite" role="status" aria-atomic="true">
          {chainResult && (
            <div
              className={`p-3 rounded-xs font-mono text-xs border space-y-1.5 ${
                chainResult.ok
                  ? "border-atlas-moss bg-atlas-moss/20 text-atlas-moss"
                  : "border-atlas-alert bg-atlas-alert/20 text-atlas-alert"
              }`}
            >
              <div className="font-bold">{chainResult.message}</div>
              {chainResult.replayRoot && (
                <div className="text-[11px] text-atlas-ink break-all">
                  Browser replay state_root: <code>{chainResult.replayRoot}</code> (step 200)
                </div>
              )}
              {chainResult.chainCity && (
                <div className="text-[11px] text-atlas-ink break-all">
                  NEAR testnet state_root: <code>{chainResult.chainCity.state_root}</code> (step {chainResult.chainCity.step})
                </div>
              )}
            </div>
          )}
        </div>

        {/* Checkpoint Transactions (Links to NearBlocks explorer) */}
        <div className="space-y-1.5 pt-1">
          <div className="text-[11px] font-mono text-atlas-ink-muted">
            On-chain checkpoint transactions (NearBlocks explorer):
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {TESTNET_CHECKPOINTS.map((cp) => (
              <a
                key={cp.txId}
                href={buildExplorerTxUrl(cp.txId)}
                target="_blank"
                rel="noopener noreferrer"
                className="atlas-focus p-2 rounded-xs border border-atlas-line bg-atlas-surface-raised hover:border-atlas-gold hover:bg-atlas-gold/5 transition-colors font-mono text-xs flex flex-col gap-0.5 group"
                aria-label={`View Checkpoint ${cp.index} (steps ${cp.fromStep} to ${cp.toStep}) on NearBlocks`}
              >
                <div className="flex items-center justify-between text-[11px] text-atlas-ink-muted">
                  <span className="font-semibold text-atlas-gold">Checkpoint {cp.index}</span>
                  <span>Steps {cp.fromStep}..{cp.toStep}</span>
                </div>
                <div className="text-[11px] text-atlas-ink font-mono truncate group-hover:text-atlas-gold">
                  Tx: {cp.txId.slice(0, 10)}…{cp.txId.slice(-6)} ↗
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
