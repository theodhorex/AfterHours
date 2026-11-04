"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { parseAgent } from "../../../../packages/rules/src/schema.ts";
import { getArc } from "../lib/sim-adapter.ts";
import { formatCoin } from "../lib/format.ts";
import {
  PRESET_AGENTS,
  runAgentBacktest,
  verifyEntry,
  rankEntries,
  loadLeaderboard,
  saveLeaderboard,
  MAX_LEADERBOARD_ENTRIES,
  type LeaderboardEntry,
} from "../lib/agents.ts";

interface AgentsPanelProps {
  arcId: string;
  seed: string;
}

type RowVerifyStatus = "idle" | "verifying" | "verified" | "mismatch";

export function AgentsPanel({ arcId, seed }: AgentsPanelProps) {
  const [selectedPresetKey, setSelectedPresetKey] = useState<string>("flour-trader");
  const [agentJson, setAgentJson] = useState<string>(PRESET_AGENTS["flour-trader"]);
  const [steps, setSteps] = useState<number>(200);
  const [startCoinStr, setStartCoinStr] = useState<string>("2000");

  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isBacktesting, setIsBacktesting] = useState<boolean>(false);
  const [backtestProgressText, setBacktestProgressText] = useState<string>("");
  const [executionError, setExecutionError] = useState<string | null>(null);

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(() => loadLeaderboard());
  const [rowVerifyState, setRowVerifyState] = useState<Record<string, RowVerifyStatus>>({});

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Validate agent JSON with debounce whenever agentJson or arcId changes
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      if (!agentJson.trim()) {
        setValidationErrors(["Please provide an agent JSON specification"]);
        return;
      }

      try {
        const parsed = JSON.parse(agentJson);
        const arc = getArc(arcId);
        parseAgent(parsed, arc);
        setValidationErrors([]);
      } catch (err) {
        setValidationErrors([err instanceof Error ? err.message : String(err)]);
      }
    }, 200);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [agentJson, arcId]);

  // Handle Preset Selection
  const handleSelectPreset = useCallback((presetKey: string) => {
    setSelectedPresetKey(presetKey);
    const content = PRESET_AGENTS[presetKey];
    if (content) {
      setAgentJson(content);
      setExecutionError(null);
    }
  }, []);

  // Run Backtest with async yield to keep UI responsive
  const handleRunBacktest = useCallback(async () => {
    if (isBacktesting || validationErrors.length > 0) return;

    setIsBacktesting(true);
    setExecutionError(null);
    setBacktestProgressText("Initializing world genesis...");

    // Yield to the event loop so the browser displays the loading state
    await new Promise((resolve) => setTimeout(resolve, 40));

    try {
      const parsedCoin = BigInt(startCoinStr.trim() || "0");
      setBacktestProgressText(`Simulating ${steps} steps on seed "${seed}"...`);
      await new Promise((resolve) => setTimeout(resolve, 60));

      const res = await runAgentBacktest({
        arcId,
        seed,
        agentJson,
        steps,
        startCoin: parsedCoin,
      });

      if (!res.ok) {
        setExecutionError(res.errors.join("; "));
        setIsBacktesting(false);
        setBacktestProgressText("");
        return;
      }

      setLeaderboard((prev) => {
        const remaining = prev.filter((item) => item.id !== res.entry.id);
        const updated = rankEntries([res.entry, ...remaining]).slice(0, MAX_LEADERBOARD_ENTRIES);
        saveLeaderboard(updated);
        return updated;
      });

      setBacktestProgressText("");
    } catch (err) {
      setExecutionError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsBacktesting(false);
    }
  }, [isBacktesting, validationErrors, startCoinStr, steps, seed, arcId, agentJson]);

  // Re-verify an individual leaderboard entry
  const handleReverifyRow = useCallback(async (entry: LeaderboardEntry) => {
    setRowVerifyState((prev) => ({ ...prev, [entry.id]: "verifying" }));
    await new Promise((resolve) => setTimeout(resolve, 50));

    const jsonToVerify = entry.agentJson ?? agentJson;
    const res = await verifyEntry(entry, jsonToVerify);

    setRowVerifyState((prev) => ({
      ...prev,
      [entry.id]: res.verified ? "verified" : "mismatch",
    }));
  }, [agentJson]);

  // Remove entry from leaderboard
  const handleRemoveEntry = useCallback((entryId: string) => {
    setLeaderboard((prev) => {
      const next = prev.filter((e) => e.id !== entryId);
      saveLeaderboard(next);
      return next;
    });
  }, []);

  return (
    <section
      aria-labelledby="agents-panel-heading"
      className="atlas-panel rounded-sm p-4 sm:p-5 border border-atlas-line space-y-5"
    >
      {/* Header and Honest Copy */}
      <div className="border-b border-atlas-line pb-3 space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2
            id="agents-panel-heading"
            className="text-base sm:text-lg font-display font-semibold text-atlas-ink flex items-center gap-2"
          >
            <span aria-hidden="true" className="text-atlas-gold">🤖</span>
            Autonomous Agent Backtester & Verified Leaderboard
          </h2>
          <span className="font-mono text-xs px-2 py-0.5 rounded-xs bg-atlas-surface-raised border border-atlas-line text-atlas-ink-muted">
            {leaderboard.length} / {MAX_LEADERBOARD_ENTRIES} ranked
          </span>
        </div>
        <p className="text-xs text-atlas-ink-muted leading-relaxed">
          Configure rule-based trading agents to evaluate their economic yield across historical market conditions.
          Agents trade autonomously only while the player is offline in a deployed version (mock mode, no chain).
        </p>
      </div>

      {/* Main Two-Column Layout (responsive 360px floor, single-column stack on small screens) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Editor & Backtest Parameters */}
        <div className="lg:col-span-5 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="agent-preset-select" className="block text-xs font-mono text-atlas-ink-muted">
              Choose an archetype preset:
            </label>
            <select
              id="agent-preset-select"
              value={selectedPresetKey}
              onChange={(e) => handleSelectPreset(e.target.value)}
              disabled={isBacktesting}
              className="atlas-focus w-full bg-atlas-surface border border-atlas-line text-atlas-ink px-3 py-1.5 rounded-xs font-mono text-xs"
            >
              <option value="flour-trader">Flour Trader (buy flour low, sell high)</option>
              <option value="grain-hoarder">Grain Hoarder (stockpile agricultural surplus)</option>
              <option value="crystal-flipper">Crystal Flipper (speculate on arcane minerals)</option>
              <option value="idle">Idle Agent (passive, zero orders)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="agent-json-editor" className="text-xs font-mono text-atlas-ink-muted">
                Agent JSON Rules:
              </label>
              <span className="text-[11px] font-mono text-atlas-ash">version 1</span>
            </div>
            <textarea
              id="agent-json-editor"
              value={agentJson}
              onChange={(e) => {
                setAgentJson(e.target.value);
                setExecutionError(null);
              }}
              spellCheck={false}
              rows={12}
              className="atlas-focus w-full font-mono text-xs p-3 bg-atlas-surface border border-atlas-line text-atlas-ink rounded-xs resize-y leading-relaxed"
              aria-describedby="agent-validation-status"
            />
          </div>

          {/* Live Validation Feedback */}
          <div
            id="agent-validation-status"
            role="status"
            aria-live="polite"
            className="text-xs font-mono"
          >
            {validationErrors.length > 0 ? (
              <div className="p-2.5 rounded-xs border border-atlas-alert/50 bg-atlas-alert/15 text-atlas-alert flex items-start gap-2">
                <span aria-hidden="true" className="shrink-0">⚠️</span>
                <span className="break-all">{validationErrors[0]}</span>
              </div>
            ) : (
              <div className="p-2 rounded-xs border border-atlas-moss/40 bg-atlas-moss/10 text-atlas-moss flex items-center gap-2">
                <span aria-hidden="true">✓</span>
                <span>Agent JSON passes schema and item checks for this arc</span>
              </div>
            )}
          </div>

          {/* Backtest Parameters: Steps & Starting Coin */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="space-y-1">
              <label htmlFor="agent-steps-input" className="block text-xs font-mono text-atlas-ink-muted">
                Steps (max 400):
              </label>
              <input
                id="agent-steps-input"
                type="number"
                min={1}
                max={400}
                value={steps}
                onChange={(e) => setSteps(Math.min(400, Math.max(1, parseInt(e.target.value, 10) || 1)))}
                disabled={isBacktesting}
                className="atlas-focus w-full bg-atlas-surface border border-atlas-line text-atlas-ink px-2.5 py-1.5 rounded-xs font-mono text-xs"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="agent-start-coin-input" className="block text-xs font-mono text-atlas-ink-muted">
                Start coin:
              </label>
              <input
                id="agent-start-coin-input"
                type="number"
                min={0}
                value={startCoinStr}
                onChange={(e) => setStartCoinStr(e.target.value)}
                disabled={isBacktesting}
                className="atlas-focus w-full bg-atlas-surface border border-atlas-line text-atlas-ink px-2.5 py-1.5 rounded-xs font-mono text-xs"
              />
            </div>
          </div>

          {/* Execution error message if any */}
          {executionError && (
            <div role="alert" className="p-2.5 rounded-xs border border-atlas-alert bg-atlas-alert/20 text-atlas-alert text-xs font-mono">
              {executionError}
            </div>
          )}

          {/* Run Backtest Trigger */}
          <button
            type="button"
            onClick={handleRunBacktest}
            disabled={isBacktesting || validationErrors.length > 0}
            className="atlas-focus w-full px-4 py-2.5 rounded-xs font-mono font-semibold text-xs transition-colors flex items-center justify-center gap-2 bg-atlas-gold text-atlas-canvas hover:bg-atlas-gold/90 border border-atlas-gold disabled:bg-atlas-ash/20 disabled:text-atlas-ash disabled:border-atlas-line disabled:cursor-not-allowed cursor-pointer"
          >
            {isBacktesting ? (
              <>
                <span className="inline-block animate-spin" aria-hidden="true">⏳</span>
                <span>{backtestProgressText || "Simulating agent backtest..."}</span>
              </>
            ) : (
              <>
                <span aria-hidden="true">⚡</span>
                <span>Run backtest ({steps} steps)</span>
              </>
            )}
          </button>

          {/* How Agents Work Summary */}
          <div className="p-3 rounded-xs bg-atlas-surface-raised/60 border border-atlas-line/60 text-[11px] font-mono text-atlas-ink-muted space-y-1.5 leading-relaxed">
            <div className="font-semibold text-atlas-ink text-xs flex items-center gap-1.5">
              <span aria-hidden="true">ℹ️</span>
              <span>How Agents Work</span>
            </div>
            <ul className="list-disc list-inside space-y-0.5 text-atlas-ash">
              <li>Max 8 rules per agent, evaluated in listed order</li>
              <li>Max 3 conditions per rule (`price`, `stock`, `holding`, `coin`, `season_in`)</li>
              <li>Max 4 orders executed per simulation step</li>
              <li>2 coin fee charged to treasury for each fired rule</li>
            </ul>
          </div>
        </div>

        {/* Right Column: Verified Leaderboard */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
            <span className="text-atlas-ink font-semibold">Leaderboard (Seed: {seed})</span>
            <span className="text-atlas-ink-muted text-[11px]">Ranked by score, then trades</span>
          </div>

          <div className="overflow-x-auto border border-atlas-line rounded-xs bg-atlas-surface">
            <table className="w-full text-left font-mono text-xs min-w-[500px]">
              <caption className="sr-only">
                Anyone can re-run this agent on the same seed and get the same score and state root (mock mode, no chain)
              </caption>
              <thead className="bg-atlas-surface-raised text-atlas-ink-muted border-b border-atlas-line text-[11px] uppercase tracking-wider">
                <tr>
                  <th scope="col" className="p-2.5 text-center w-10">#</th>
                  <th scope="col" className="p-2.5">Agent</th>
                  <th scope="col" className="p-2.5 text-right">Score</th>
                  <th scope="col" className="p-2.5 text-center">Trades</th>
                  <th scope="col" className="p-2.5">Root (first 12)</th>
                  <th scope="col" className="p-2.5 text-right">Verification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-atlas-line/60">
                {leaderboard.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-atlas-ash font-mono text-xs">
                      No backtests recorded yet. Run a backtest on the left to rank your agent.
                    </td>
                  </tr>
                ) : (
                  leaderboard.map((entry, index) => {
                    const status = rowVerifyState[entry.id] ?? "idle";
                    const isPositiveScore = entry.score > 0n;
                    const isNegativeScore = entry.score < 0n;

                    return (
                      <tr key={entry.id} className="hover:bg-atlas-surface-raised/40 transition-colors">
                        <td className="p-2.5 text-center font-bold text-atlas-ink-muted">
                          {index + 1}
                        </td>
                        <td className="p-2.5">
                          <div className="font-semibold text-atlas-ink">{entry.name}</div>
                          <div className="text-[10px] text-atlas-ash">
                            {entry.steps} steps • start {entry.startCoin.toString()}
                          </div>
                        </td>
                        <td className={`p-2.5 text-right font-semibold ${
                          isPositiveScore
                            ? "text-atlas-moss"
                            : isNegativeScore
                            ? "text-atlas-alert"
                            : "text-atlas-ink"
                        }`}>
                          {isPositiveScore ? "+" : ""}
                          {formatCoin(entry.score)}
                        </td>
                        <td className="p-2.5 text-center text-atlas-ink-muted">
                          {entry.trades}
                        </td>
                        <td className="p-2.5 font-mono text-[11px] text-atlas-gold">
                          {entry.stateRoot.slice(0, 12)}…
                        </td>
                        <td className="p-2.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {status === "verifying" && (
                              <span className="text-[10px] text-atlas-gold animate-pulse">⏳ Replaying...</span>
                            )}
                            {status === "verified" && (
                              <span className="px-1.5 py-0.5 rounded-xs bg-atlas-moss/20 border border-atlas-moss text-atlas-moss font-bold text-[10px]">
                                VERIFIED
                              </span>
                            )}
                            {status === "mismatch" && (
                              <span className="px-1.5 py-0.5 rounded-xs bg-atlas-alert/20 border border-atlas-alert text-atlas-alert font-bold text-[10px]">
                                MISMATCH
                              </span>
                            )}
                            {status === "idle" && (
                              <button
                                type="button"
                                onClick={() => handleReverifyRow(entry)}
                                className="atlas-focus px-2 py-0.5 rounded-xs bg-atlas-surface-raised border border-atlas-line text-atlas-ink-muted hover:text-atlas-ink text-[10px] transition-colors cursor-pointer"
                                title="Re-run simulation to verify score and state root"
                              >
                                Re-verify
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleRemoveEntry(entry.id)}
                              className="atlas-focus p-1 rounded-xs text-atlas-ash hover:text-atlas-alert hover:bg-atlas-alert/10 transition-colors cursor-pointer"
                              aria-label={`Remove ${entry.name} from leaderboard`}
                              title="Remove entry"
                            >
                              ✕
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

          <p className="text-[11px] font-mono text-atlas-ash leading-relaxed italic">
            Caption: Anyone can re-run this agent on the same seed and get the same score and state root (mock mode, no chain).
          </p>
        </div>
      </div>
    </section>
  );
}
