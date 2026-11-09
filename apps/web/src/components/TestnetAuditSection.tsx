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
import { BookTabs } from "./ui/BookTabs.tsx";
import { Icon } from "./ui/Icons.tsx";
import { SealStamp } from "./ui/SealStamp.tsx";

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

  const tabItems = TESTNET_CITY_IDS.map((cityId) => ({
    value: cityId,
    label: TESTNET_CITIES[cityId].name,
    badge: TESTNET_CITIES[cityId].arcId,
  }));

  return (
    <div className="pt-6 border-t border-ledger-ink-faded/20 space-y-5">
      {/* Section Header */}
      <div className="space-y-1.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h3 className="text-base sm:text-lg font-pixel font-bold text-ledger-ink flex items-center gap-2">
            <Icon name="seal" size={18} className="text-ledger-ink-faded" aria-hidden="true" />
            <span>Verify Against NEAR Testnet (4 Cities)</span>
          </h3>
          <span className="font-mono text-xs text-ledger-ink-faded break-all">
            Contract:{" "}
            <a
              href={buildExplorerAccountUrl(TESTNET_CONTRACT_ID)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-ledger-ink font-semibold underline hover:text-ledger-brass transition-colors focus-visible:outline-2 focus-visible:outline-ledger-brass"
            >
              <code>{TESTNET_CONTRACT_ID}</code> ↗
            </a>
          </span>
        </div>

        <p className="font-body text-xs sm:text-sm text-ledger-ink-faded leading-relaxed">
          4 cities, 200 steps, 5 checkpoints each published on contract{" "}
          <code className="text-ledger-ink font-semibold font-mono">{TESTNET_CONTRACT_ID}</code>. Select any city to replay independently in your browser and compare the resulting state root against the on-chain smart contract.
        </p>
      </div>

      {/* 4-City Selector Tabs: BookTabs style segmented control */}
      <div className="space-y-2">
        <label id="city-selector-label" className="text-xs font-silk text-ledger-ink-faded uppercase tracking-wider block">
          Select testnet city:
        </label>
        <BookTabs
          value={selectedCityId}
          onChange={(newVal) => {
            setSelectedCityId(newVal as TestnetCityId);
            setSingleResult(null);
          }}
          tabs={tabItems}
          ariaLabel="Testnet cities selector"
          className="border border-ledger-ink-faded/30"
        />
      </div>

      {/* Selected City Metadata Panel */}
      <div
        id={`book-panel-${selectedCityId}`}
        role="tabpanel"
        aria-labelledby={`book-tab-${selectedCityId}`}
        className="p-4 sm:p-5 border border-ledger-ink-faded/30 bg-ledger-paper-shade/20 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ledger-ink-faded/20 pb-3 font-mono text-xs">
          <div>
            <span className="font-body font-bold text-base text-ledger-ink">{activeCity.name}</span>{" "}
            <span className="text-ledger-ink-faded">({activeCity.cityId})</span>
          </div>
          <div className="text-ledger-ink-faded tabular-nums">
            Seed: <code className="text-ledger-ink font-semibold">{activeCity.seed}</code> • Steps:{" "}
            <code className="text-ledger-ink font-semibold">{activeCity.steps}</code>
          </div>
        </div>

        {/* Action Buttons: Verify Chosen City & Verify All Four */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleVerifySelected}
            disabled={isVerifyingSingle || isVerifyingAll}
            className={`min-h-[44px] px-4 py-2.5 font-pixel text-xs cursor-pointer border transition-colors flex items-center gap-2 focus-visible:outline-2 focus-visible:outline-ledger-brass ${
              isVerifyingSingle || isVerifyingAll
                ? "bg-ledger-paper-shade/40 text-ledger-ink-faded/60 border-ledger-ink-faded/20 cursor-not-allowed"
                : "bg-ledger-paper text-ledger-ink font-bold border-ledger-ink shadow-[2px_2px_0_0_var(--ledger-ink)] hover:bg-ledger-paper-shade/60 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
            }`}
            aria-label={`Verify ${activeCity.name} against NEAR testnet`}
          >
            <Icon name="seal" size={16} aria-hidden="true" />
            <span>Verify {activeCity.name}</span>
          </button>

          <button
            type="button"
            onClick={handleVerifyAllFour}
            disabled={isVerifyingSingle || isVerifyingAll}
            className={`min-h-[44px] px-4 py-2.5 font-pixel text-xs cursor-pointer border transition-colors flex items-center gap-2 focus-visible:outline-2 focus-visible:outline-ledger-brass ${
              isVerifyingSingle || isVerifyingAll
                ? "bg-ledger-paper-shade/40 text-ledger-ink-faded/60 border-ledger-ink-faded/20 cursor-not-allowed"
                : "bg-ledger-paper-shade/40 text-ledger-ink border-ledger-ink-faded/40 hover:bg-ledger-paper-shade/70 active:translate-x-[1px] active:translate-y-[1px]"
            }`}
            aria-label="Verify all four testnet cities sequentially"
          >
            <Icon name="scale" size={16} aria-hidden="true" />
            <span>Verify all four</span>
          </button>
        </div>

        {/* Determinate progress for Verify All or Single verification */}
        {isVerifyingSingle && (
          <div className="space-y-1.5" role="status" aria-live="polite">
            <div className="flex items-center justify-between text-xs font-mono text-ledger-ink-faded">
              <span>Replaying 200 steps & verifying {activeCity.name}…</span>
            </div>
            <div
              role="progressbar"
              aria-label={`Verifying ${activeCity.name}`}
              className="w-full bg-ledger-paper-shade/60 border border-ledger-ink-faded/30 h-2 overflow-hidden"
            >
              <div className="bg-ledger-brass h-full w-2/3 transition-all duration-300 animate-pulse" />
            </div>
          </div>
        )}

        {isVerifyingAll && allProgress && (
          <div className="space-y-1.5" role="status" aria-live="polite">
            <div className="flex items-center justify-between text-xs font-mono text-ledger-ink-faded">
              <span>
                Verifying city {allProgress.current} of {allProgress.total}: {allProgress.cityName}…
              </span>
              <span>{Math.round((allProgress.current / allProgress.total) * 100)}%</span>
            </div>
            <div
              role="progressbar"
              aria-valuenow={allProgress.current}
              aria-valuemin={1}
              aria-valuemax={allProgress.total}
              aria-label="All testnet cities verification progress"
              className="w-full bg-ledger-paper-shade/60 border border-ledger-ink-faded/30 h-2.5 overflow-hidden"
            >
              <div
                className="bg-ledger-brass h-full transition-all duration-150"
                style={{ width: `${Math.round((allProgress.current / allProgress.total) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Live Region for Single City Verification Result with SealStamp */}
        <div aria-live="polite" role="status" aria-atomic="true" className="pt-2">
          {!singleResult && !isVerifyingSingle && (
            <div className="font-body text-xs text-ledger-ink-faded italic">
              No comparison performed for {activeCity.name} yet. Click &quot;Verify {activeCity.name}&quot; above.
            </div>
          )}
          {singleResult && (
            <div className="p-4 border border-ledger-ink-faded/30 bg-ledger-paper flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1.5 font-mono text-xs">
                <div className="font-body font-bold text-sm text-ledger-ink">
                  {singleResult.name}: {singleResult.message}
                </div>
                {singleResult.replayRoot && (
                  <div className="text-[11px] text-ledger-ink-faded break-all">
                    Browser replay root: <code className="text-ledger-ink font-semibold">{singleResult.replayRoot}</code> (step 200)
                  </div>
                )}
                {singleResult.chainCity && (
                  <div className="text-[11px] text-ledger-ink-faded break-all">
                    NEAR testnet root: <code className="text-ledger-ink font-semibold">{singleResult.chainCity.state_root}</code> (step {singleResult.chainCity.step})
                  </div>
                )}
              </div>
              <div className="shrink-0">
                <SealStamp
                  key={`testnet-${singleResult.cityId}-${singleResult.ok ? "verified" : "mismatch"}`}
                  result={singleResult.ok ? "verified" : "mismatch"}
                  label={singleResult.ok ? "TESTNET MATCH" : "ON-CHAIN DIVERGENCE"}
                />
              </div>
            </div>
          )}
        </div>

        {/* 4-Row Summary Table when "Verify all four" is run */}
        {allResults && <TestnetSummaryTable results={allResults} />}

        {/* Checkpoint Transactions Links for the Selected City */}
        <div className="space-y-2 pt-3 border-t border-ledger-ink-faded/20">
          <div className="font-silk text-[11px] uppercase tracking-wider text-ledger-ink-faded">
            {activeCity.name} on-chain checkpoint transactions (5 checkpoints):
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {activeCity.checkpoints.map((cp) => (
              <a
                key={cp.txId}
                href={buildExplorerTxUrl(cp.txId)}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[44px] p-2.5 border border-ledger-ink-faded/20 bg-ledger-paper-shade/30 hover:bg-ledger-paper-shade/70 transition-colors font-mono text-xs flex flex-col justify-center gap-0.5 group focus-visible:outline-2 focus-visible:outline-ledger-brass"
                aria-label={`View ${activeCity.name} Checkpoint ${cp.index} (${cp.fromStep} to ${cp.toStep}) on NearBlocks`}
              >
                <div className="flex items-center justify-between text-[11px] text-ledger-ink-faded">
                  <span className="font-semibold text-ledger-ink">Checkpoint {cp.index}</span>
                  <span className="tabular-nums">Steps {cp.fromStep}..{cp.toStep}</span>
                </div>
                <div className="text-[11px] text-ledger-ink-faded font-mono truncate group-hover:text-ledger-ink">
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

export default TestnetAuditSection;
