"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
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
import { LedgerPage } from "./ui/LedgerPage.tsx";
import { Icon } from "./ui/Icons.tsx";
import { AgentLeaderboardTable, type RowVerifyStatus } from "./ui/AgentLeaderboardTable.tsx";

interface AgentsPanelProps {
  arcId: string;
  seed: string;
  initialPresetKey?: string;
  onBacktestComplete?: (result: { entry: LeaderboardEntry; summary: string }) => void;
}

export function AgentsPanel({
  arcId,
  seed,
  initialPresetKey,
  onBacktestComplete,
}: AgentsPanelProps) {
  const [selectedPresetKey, setSelectedPresetKey] = useState<string>("flour-trader");
  const [agentJson, setAgentJson] = useState<string>(PRESET_AGENTS["flour-trader"]);
  const [steps, setSteps] = useState<number>(200);
  const [startCoinStr, setStartCoinStr] = useState<string>("2000");

  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isBacktesting, setIsBacktesting] = useState<boolean>(false);
  const [backtestProgressText, setBacktestProgressText] = useState<string>("");
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [lastBacktestResult, setLastBacktestResult] = useState<LeaderboardEntry | null>(null);

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(() => loadLeaderboard());
  const [rowVerifyState, setRowVerifyState] = useState<Record<string, RowVerifyStatus>>({});

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Parse rule count from current JSON
  const ruleCount = useMemo(() => {
    try {
      const parsed = JSON.parse(agentJson);
      return Array.isArray(parsed?.rules) ? parsed.rules.length : 0;
    } catch {
      return 0;
    }
  }, [agentJson]);

  // Field level validation for plain-words errors beside fields
  const coinError = useMemo(() => {
    if (!startCoinStr.trim()) return "Starting coin is required";
    if (!/^\d+$/.test(startCoinStr.trim())) return "Price must be a whole number";
    return null;
  }, [startCoinStr]);

  const stepsError = useMemo(() => {
    if (isNaN(steps) || steps < 1 || steps > 400) return "Steps must be between 1 and 400";
    return null;
  }, [steps]);

  // Validate agent JSON with debounce
  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    debounceTimerRef.current = setTimeout(() => {
      if (!agentJson.trim()) {
        setValidationErrors(["Please provide an agent JSON specification"]);
        return;
      }
      try {
        const parsed = JSON.parse(agentJson);
        const arc = getArc(arcId);
        parseAgent(parsed, arc);
        if (Array.isArray(parsed?.rules) && parsed.rules.length > 8) {
          setValidationErrors([`Rule limit exceeded: ${parsed.rules.length} rules defined (maximum 8 allowed)`]);
          return;
        }
        setValidationErrors([]);
      } catch (err) {
        setValidationErrors([err instanceof Error ? err.message : String(err)]);
      }
    }, 200);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [agentJson, arcId]);

  const handleSelectPreset = useCallback((presetKey: string) => {
    setSelectedPresetKey(presetKey);
    const content = PRESET_AGENTS[presetKey];
    if (content) {
      setAgentJson(content);
      setExecutionError(null);
    }
  }, []);

  const [appliedPresetKey, setAppliedPresetKey] = useState<string | undefined>(undefined);
  if (initialPresetKey !== appliedPresetKey) {
    setAppliedPresetKey(initialPresetKey);
    if (initialPresetKey && PRESET_AGENTS[initialPresetKey]) {
      setSelectedPresetKey(initialPresetKey);
      setAgentJson(PRESET_AGENTS[initialPresetKey]);
      setExecutionError(null);
    }
  }

  const handleRunBacktest = useCallback(async () => {
    if (isBacktesting || validationErrors.length > 0 || coinError || stepsError) return;

    setIsBacktesting(true);
    setExecutionError(null);
    setBacktestProgressText("Initializing world genesis...");
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

      setLastBacktestResult(res.entry);
      const earnedCoin = res.entry.score - parsedCoin;
      const coinSign = earnedCoin >= 0n ? `+${earnedCoin}` : `${earnedCoin}`;
      const backtestSummary = `${res.entry.name} earned ${coinSign} coin over ${steps} steps, verified`;
      onBacktestComplete?.({ entry: res.entry, summary: backtestSummary });

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
  }, [isBacktesting, validationErrors, coinError, stepsError, startCoinStr, steps, seed, arcId, agentJson]);

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

  const handleRemoveEntry = useCallback((entryId: string) => {
    setLeaderboard((prev) => {
      const next = prev.filter((e) => e.id !== entryId);
      saveLeaderboard(next);
      return next;
    });
  }, []);

  const hasFormErrors = validationErrors.length > 0 || coinError !== null || stepsError !== null;

  return (
    <LedgerPage
      title="Autonomous Agents & Verified Leaderboard"
      headingLevel="h2"
      headerRight={
        <span className="font-mono text-xs text-ledger-ink-faded">
          {leaderboard.length} / {MAX_LEADERBOARD_ENTRIES} entries ranked
        </span>
      }
    >
      <div className="space-y-6">
        <p className="font-body text-xs sm:text-sm text-ledger-ink-faded leading-relaxed">
          Ruled rulebook ledger for autonomous trading agents. Formulate trading heuristics on paper, backtest them against historical seed market dynamics, and record zero-trust reproducible outcomes.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Rule Editor as a Form on Paper */}
          <div className="lg:col-span-5 space-y-4 border border-ledger-ink-faded/30 bg-ledger-paper-shade/20 p-4 sm:p-5">
            <div className="border-b border-ledger-ink-faded/20 pb-2">
              <h3 className="font-pixel text-sm text-ledger-ink font-bold uppercase tracking-wider">
                Rulebook Specification Form
              </h3>
            </div>

            <div className="space-y-1">
              <label htmlFor="agent-preset-select" className="block text-xs font-silk text-ledger-ink uppercase tracking-wider">
                Agent Archetype Preset
              </label>
              <select
                id="agent-preset-select"
                value={selectedPresetKey}
                onChange={(e) => handleSelectPreset(e.target.value)}
                disabled={isBacktesting}
                className="w-full bg-ledger-paper border border-ledger-ink-faded/40 text-ledger-ink px-3 py-2 font-mono text-xs min-h-[44px] focus-visible:outline-2 focus-visible:outline-ledger-brass"
              >
                <option value="flour-trader">Flour Trader (buy flour low, sell high)</option>
                <option value="grain-hoarder">Grain Hoarder (stockpile agricultural surplus)</option>
                <option value="crystal-flipper">Crystal Flipper (speculate on arcane minerals)</option>
                <option value="idle">Idle Agent (passive, zero orders)</option>
              </select>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label htmlFor="agent-json-editor" className="text-xs font-silk text-ledger-ink uppercase tracking-wider">
                  Agent JSON Rules
                </label>
                <span className={`font-mono text-xs font-bold tabular-nums px-2 py-0.5 border ${
                  ruleCount > 8 ? "border-ledger-wax/60 bg-ledger-wax/10 text-ledger-wax" : "border-ledger-ink-faded/30 bg-ledger-paper text-ledger-ink"
                }`}>
                  {ruleCount} of 8 rules
                </span>
              </div>
              <textarea
                id="agent-json-editor"
                value={agentJson}
                onChange={(e) => {
                  setAgentJson(e.target.value);
                  setExecutionError(null);
                }}
                spellCheck={false}
                rows={10}
                className="w-full font-mono text-xs p-3 bg-ledger-paper border border-ledger-ink-faded/40 text-ledger-ink focus-visible:outline-2 focus-visible:outline-ledger-brass resize-y leading-relaxed"
                aria-describedby="agent-validation-status"
              />
              <div id="agent-validation-status" role="status" aria-live="polite" className="text-xs font-mono">
                {validationErrors.length > 0 ? (
                  <div className="p-2 border border-ledger-wax/50 bg-ledger-wax/10 text-ledger-wax flex items-start gap-1.5">
                    <Icon name="alert" size={14} className="shrink-0 mt-0.5" aria-hidden="true" />
                    <span className="break-all">{validationErrors[0]}</span>
                  </div>
                ) : (
                  <div className="p-1.5 border border-ledger-verdigris/40 bg-ledger-verdigris/10 text-ledger-verdigris flex items-center gap-1.5 text-[11px]">
                    <Icon name="seal" size={12} aria-hidden="true" />
                    <span>Valid rule syntax and commodity schema for this arc</span>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="space-y-1">
                <label htmlFor="agent-steps-input" className="block text-xs font-silk text-ledger-ink uppercase tracking-wider">
                  Steps (max 400)
                </label>
                <input
                  id="agent-steps-input"
                  type="number"
                  min={1}
                  max={400}
                  value={steps}
                  onChange={(e) => setSteps(parseInt(e.target.value, 10) || 0)}
                  disabled={isBacktesting}
                  className={`w-full bg-ledger-paper border text-ledger-ink px-3 py-2 font-mono text-xs min-h-[44px] tabular-nums focus-visible:outline-2 focus-visible:outline-ledger-brass ${
                    stepsError ? "border-ledger-wax" : "border-ledger-ink-faded/40"
                  }`}
                />
                {stepsError && <span className="text-[11px] font-mono text-ledger-wax block">{stepsError}</span>}
              </div>

              <div className="space-y-1">
                <label htmlFor="agent-start-coin-input" className="block text-xs font-silk text-ledger-ink uppercase tracking-wider">
                  Starting Coin
                </label>
                <input
                  id="agent-start-coin-input"
                  type="text"
                  value={startCoinStr}
                  onChange={(e) => setStartCoinStr(e.target.value)}
                  disabled={isBacktesting}
                  className={`w-full bg-ledger-paper border text-ledger-ink px-3 py-2 font-mono text-xs min-h-[44px] tabular-nums focus-visible:outline-2 focus-visible:outline-ledger-brass ${
                    coinError ? "border-ledger-wax" : "border-ledger-ink-faded/40"
                  }`}
                />
                {coinError && <span className="text-[11px] font-mono text-ledger-wax block">{coinError}</span>}
              </div>
            </div>

            {executionError && (
              <div role="alert" className="p-2.5 border border-ledger-wax/60 bg-ledger-wax/10 text-ledger-wax font-mono text-xs flex items-start gap-1.5">
                <Icon name="alert" size={14} className="shrink-0 mt-0.5" aria-hidden="true" />
                <span>{executionError}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleRunBacktest}
              disabled={isBacktesting || hasFormErrors}
              className={`min-h-[44px] w-full px-4 py-2.5 font-pixel text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer border focus-visible:outline-2 focus-visible:outline-ledger-brass ${
                isBacktesting || hasFormErrors
                  ? "bg-ledger-paper-shade/40 text-ledger-ink-faded/60 border-ledger-ink-faded/20 cursor-not-allowed"
                  : "bg-ledger-paper text-ledger-ink font-bold border-ledger-ink shadow-[2px_2px_0_0_var(--ledger-ink)] hover:bg-ledger-paper-shade/60 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
              }`}
            >
              <Icon name="quill" size={16} aria-hidden="true" />
              <span>{isBacktesting ? (backtestProgressText || "Simulating agent backtest...") : `Run backtest (${steps} steps)`}</span>
            </button>

            <p className="font-body text-[11px] text-ledger-ink-faded italic text-center">
              Backtests run on a copy of this world and never change your city.
            </p>

            {lastBacktestResult && (
              <div className="pt-2 border-t border-ledger-ink-faded/20 space-y-1.5 font-mono text-xs">
                <div className="font-silk text-[10px] uppercase text-ledger-ink-faded">Latest Backtest Outcome:</div>
                <div className="p-2.5 border border-ledger-ink-faded/30 bg-ledger-paper flex items-center justify-between">
                  <span className="font-semibold text-ledger-ink">{lastBacktestResult.name}</span>
                  <span className="tabular-nums font-bold text-ledger-ink">
                    Score: {lastBacktestResult.score > 0n ? "+" : ""}{formatCoin(lastBacktestResult.score)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Verified Leaderboard */}
          <div className="lg:col-span-7">
            <AgentLeaderboardTable
              seed={seed}
              leaderboard={leaderboard}
              rowVerifyState={rowVerifyState}
              onReverifyRow={handleReverifyRow}
              onRemoveEntry={handleRemoveEntry}
            />
          </div>
        </div>
      </div>
    </LedgerPage>
  );
}

export default AgentsPanel;
