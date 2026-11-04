"use client";

import { useState, useCallback } from "react";
import { replayToStep } from "../lib/audit.ts";
import {
  TESTNET_CONTRACT_ID,
  TESTNET_CITY_IDS,
  TESTNET_CITIES,
  type TestnetCityId,
  buildExplorerTxUrl,
  buildExplorerAccountUrl,
} from "../data/testnet.ts";
import {
  fetchCityFromChain,
  compareToChain,
} from "../lib/chain.ts";
import {
  TestnetSummaryTable,
  type CityVerificationResult,
} from "./TestnetSummaryTable.tsx";

export type { CityVerificationResult };

export function TestnetAuditSection() {
  const [selectedCityId, setSelectedCityId] = useState<TestnetCityId>("city-goblin_warrens");
  const [isVerifyingSingle, setIsVerifyingSingle] = useState<boolean>(false);
  const [singleResult, setSingleResult] = useState<CityVerificationResult | null>(null);

  const [isVerifyingAll, setIsVerifyingAll] = useState<boolean>(false);
  const [allProgress, setAllProgress] = useState<{ current: number; total: number; cityName: string } | null>(null);
  const [allResults, setAllResults] = useState<CityVerificationResult[] | null>(null);

  const activeCity = TESTNET_CITIES[selectedCityId];

  // Verify a single city against NEAR testnet
  const runSingleVerification = useCallback(
    async (cityId: TestnetCityId): Promise<CityVerificationResult> => {
      const city = TESTNET_CITIES[cityId];
      try {
        const { stateRoot, step: replayedStep } = replayToStep(
          city.arcId,
          city.seed,
          city.steps,
          city.cityId
        );

        const fetchRes = await fetchCityFromChain(TESTNET_CONTRACT_ID, city.cityId);
        if (!fetchRes.ok) {
          return {
            cityId,
            name: city.name,
            ok: false,
            message: `FAILED: could not fetch city from chain: ${fetchRes.error}`,
            replayRoot: stateRoot,
            error: fetchRes.error,
          };
        }

        const cmp = compareToChain(stateRoot, replayedStep, fetchRes.city);
        return {
          cityId,
          name: city.name,
          ok: cmp.ok,
          message: cmp.reason,
          replayRoot: stateRoot,
          chainCity: fetchRes.city,
        };
      } catch (err: unknown) {
        return {
          cityId,
          name: city.name,
          ok: false,
          message: `FAILED: error verifying ${city.name}: ${err instanceof Error ? err.message : String(err)}`,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
    []
  );

  const handleVerifySelected = useCallback(async () => {
    if (isVerifyingSingle || isVerifyingAll) return;
    setIsVerifyingSingle(true);
    setSingleResult(null);

    // Yield to let browser update UI
    await new Promise((resolve) => setTimeout(resolve, 30));

    const res = await runSingleVerification(selectedCityId);
    setSingleResult(res);
    setIsVerifyingSingle(false);
  }, [isVerifyingSingle, isVerifyingAll, selectedCityId, runSingleVerification]);

  const handleVerifyAllFour = useCallback(async () => {
    if (isVerifyingSingle || isVerifyingAll) return;
    setIsVerifyingAll(true);
    setAllResults(null);

    const results: CityVerificationResult[] = [];
    const total = TESTNET_CITY_IDS.length;

    for (let i = 0; i < total; i++) {
      const cityId = TESTNET_CITY_IDS[i];
      const cityName = TESTNET_CITIES[cityId].name;
      setAllProgress({ current: i + 1, total, cityName });
      await new Promise((resolve) => setTimeout(resolve, 30));

      const res = await runSingleVerification(cityId);
      results.push(res);
      setAllResults([...results]);
    }

    setAllProgress(null);
    setIsVerifyingAll(false);
  }, [isVerifyingSingle, isVerifyingAll, runSingleVerification]);

  return (
    <div className="pt-4 border-t border-atlas-line space-y-4">
      {/* Section Header & Official Copy */}
      <div className="space-y-1.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
          <h3 className="text-sm font-display font-semibold text-atlas-ink flex items-center gap-2">
            <span aria-hidden="true" className="text-atlas-gold">🌐</span>
            Verify against NEAR testnet (4 Cities)
          </h3>
          <span className="font-mono text-xs text-atlas-ink-muted break-all">
            Contract:{" "}
            <a
              href={buildExplorerAccountUrl(TESTNET_CONTRACT_ID)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-atlas-gold hover:underline selection:bg-atlas-gold selection:text-atlas-canvas"
            >
              <code>{TESTNET_CONTRACT_ID}</code> ↗
            </a>
          </span>
        </div>

        <p className="text-xs text-atlas-ink-muted leading-relaxed">
          4 cities, 200 steps, 5 checkpoints each published on contract{" "}
          <code className="text-atlas-ink font-semibold">{TESTNET_CONTRACT_ID}</code>. Select any city to replay independently in your browser and compare the resulting state root against the on-chain smart contract.
        </p>
      </div>

      {/* 4-City Selector Tabs (Accessible & Keyboard Reachable, 360px safe) */}
      <div className="space-y-2">
        <label id="city-selector-label" className="text-xs font-mono text-atlas-ink-muted block">
          Select testnet city:
        </label>
        <div
          role="tablist"
          aria-labelledby="city-selector-label"
          className="flex flex-wrap gap-1.5 p-1 rounded-xs bg-atlas-surface-raised border border-atlas-line"
        >
          {TESTNET_CITY_IDS.map((cityId) => {
            const city = TESTNET_CITIES[cityId];
            const isSelected = selectedCityId === cityId;
            return (
              <button
                key={cityId}
                role="tab"
                type="button"
                id={`tab-${cityId}`}
                aria-selected={isSelected}
                aria-controls={`panel-${cityId}`}
                tabIndex={isSelected ? 0 : -1}
                onClick={() => {
                  setSelectedCityId(cityId);
                  setSingleResult(null);
                }}
                onKeyDown={(e) => {
                  const currentIndex = TESTNET_CITY_IDS.indexOf(cityId);
                  if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                    e.preventDefault();
                    const nextIdx = (currentIndex + 1) % TESTNET_CITY_IDS.length;
                    const nextId = TESTNET_CITY_IDS[nextIdx];
                    setSelectedCityId(nextId);
                    setSingleResult(null);
                    document.getElementById(`tab-${nextId}`)?.focus();
                  } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                    e.preventDefault();
                    const prevIdx = (currentIndex - 1 + TESTNET_CITY_IDS.length) % TESTNET_CITY_IDS.length;
                    const prevId = TESTNET_CITY_IDS[prevIdx];
                    setSelectedCityId(prevId);
                    setSingleResult(null);
                    document.getElementById(`tab-${prevId}`)?.focus();
                  }
                }}
                className={`atlas-focus px-3 py-2 rounded-xs font-mono text-xs transition-colors flex items-center gap-1.5 min-h-[44px] sm:min-h-fit cursor-pointer ${
                  isSelected
                    ? "bg-atlas-gold text-atlas-canvas font-bold border border-atlas-gold shadow-xs"
                    : "bg-atlas-surface text-atlas-ink hover:text-atlas-gold border border-atlas-line/60"
                }`}
              >
                <span>{city.name}</span>
                <span className="text-[10px] opacity-80">({city.arcId})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected City Metadata Panel */}
      <div
        id={`panel-${selectedCityId}`}
        role="tabpanel"
        aria-labelledby={`tab-${selectedCityId}`}
        className="p-3 rounded-xs bg-atlas-surface border border-atlas-line/80 font-mono text-xs space-y-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-atlas-line/50 pb-2">
          <div>
            <span className="text-atlas-ink font-semibold">{activeCity.name}</span>{" "}
            <span className="text-atlas-ink-muted">({activeCity.cityId})</span>
          </div>
          <div className="text-atlas-gold">
            Seed: <code>{activeCity.seed}</code> • Steps: <code>{activeCity.steps}</code>
          </div>
        </div>

        {/* Action Buttons: Verify Chosen City & Verify All Four */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleVerifySelected}
            disabled={isVerifyingSingle || isVerifyingAll}
            className={`atlas-focus px-3.5 py-2 rounded-xs font-mono font-semibold text-xs transition-colors flex items-center gap-2 min-h-[44px] ${
              isVerifyingSingle || isVerifyingAll
                ? "bg-atlas-ash/20 text-atlas-ash border border-atlas-line cursor-not-allowed"
                : "bg-atlas-gold text-atlas-canvas hover:bg-atlas-gold/90 border border-atlas-gold cursor-pointer"
            }`}
            aria-label={`Verify ${activeCity.name} against NEAR testnet`}
          >
            {isVerifyingSingle ? (
              <>
                <span className="inline-block animate-spin" aria-hidden="true">⏳</span>
                <span>Replaying 200 steps & verifying…</span>
              </>
            ) : (
              <>
                <span aria-hidden="true">⚡</span>
                <span>Verify {activeCity.name}</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleVerifyAllFour}
            disabled={isVerifyingSingle || isVerifyingAll}
            className={`atlas-focus px-3.5 py-2 rounded-xs font-mono font-semibold text-xs transition-colors flex items-center gap-2 min-h-[44px] ${
              isVerifyingSingle || isVerifyingAll
                ? "bg-atlas-ash/20 text-atlas-ash border border-atlas-line cursor-not-allowed"
                : "bg-atlas-surface-raised border border-atlas-gold text-atlas-gold hover:bg-atlas-gold/15 cursor-pointer"
            }`}
            aria-label="Verify all four testnet cities sequentially"
          >
            {isVerifyingAll ? (
              <>
                <span className="inline-block animate-spin" aria-hidden="true">⏳</span>
                <span>
                  Verifying all ({allProgress?.current}/{allProgress?.total}: {allProgress?.cityName})…
                </span>
              </>
            ) : (
              <>
                <span aria-hidden="true">🔍</span>
                <span>Verify all four</span>
              </>
            )}
          </button>
        </div>

        {/* Live Region for Single City Verification Result */}
        <div aria-live="polite" role="status" aria-atomic="true">
          {!singleResult && !isVerifyingSingle && (
            <div className="text-[11px] text-atlas-ash italic">
              No comparison performed for {activeCity.name} yet. Click &quot;Verify {activeCity.name}&quot; above.
            </div>
          )}
          {singleResult && (
            <div
              className={`p-3 rounded-xs border space-y-1.5 ${
                singleResult.ok
                  ? "border-atlas-moss bg-atlas-moss/20 text-atlas-moss"
                  : "border-atlas-alert bg-atlas-alert/20 text-atlas-alert"
              }`}
            >
              <div className="font-bold flex items-center gap-1.5">
                <span aria-hidden="true">{singleResult.ok ? "✓" : "✗"}</span>
                <span>{singleResult.message}</span>
              </div>
              {singleResult.replayRoot && (
                <div className="text-[11px] text-atlas-ink break-all">
                  Browser replay state_root: <code>{singleResult.replayRoot}</code> (step 200)
                </div>
              )}
              {singleResult.chainCity && (
                <div className="text-[11px] text-atlas-ink break-all">
                  NEAR testnet state_root: <code>{singleResult.chainCity.state_root}</code> (step {singleResult.chainCity.step})
                </div>
              )}
            </div>
          )}
        </div>

        {/* 4-Row Summary Table when "Verify all four" is run */}
        {allResults && <TestnetSummaryTable results={allResults} />}

        {/* Checkpoint Transactions Links for the Selected City */}
        <div className="space-y-1.5 pt-2 border-t border-atlas-line/50">
          <div className="text-[11px] font-mono text-atlas-ink-muted">
            {activeCity.name} on-chain checkpoint transactions (5 checkpoints):
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {activeCity.checkpoints.map((cp) => (
              <a
                key={cp.txId}
                href={buildExplorerTxUrl(cp.txId)}
                target="_blank"
                rel="noopener noreferrer"
                className="atlas-focus p-2 rounded-xs border border-atlas-line bg-atlas-surface-raised hover:border-atlas-gold hover:bg-atlas-gold/5 transition-colors font-mono text-xs flex flex-col justify-center gap-0.5 group min-h-[44px]"
                aria-label={`View ${activeCity.name} Checkpoint ${cp.index} (${cp.fromStep} to ${cp.toStep}) on NearBlocks`}
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
    </div>
  );
}
