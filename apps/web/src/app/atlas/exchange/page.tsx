"use client";

import { useState, useEffect, useCallback } from "react";
import { LedgerPage } from "../../../components/ui/LedgerPage.tsx";
import { Icon } from "../../../components/ui/Icons.tsx";
import { SealStamp } from "../../../components/ui/SealStamp.tsx";
import { LedgerConfirmDialog } from "../../../components/ui/LedgerConfirmDialog.tsx";
import { useAccount } from "../../../lib/account/context.tsx";
import { TESTNET_CONTRACT_ID, TESTNET_CITIES, type TestnetCityId } from "../../../data/testnet.ts";
import {
  getKnownCityIds,
  fetchCity,
  fetchCityListing,
  formatNear,
  formatShortAccountId,
  formatShortRoot,
  verifyCityHistory,
  mapExchangeError,
  type Listing,
} from "../../../lib/exchange.ts";
import type { ChainCity } from "../../../lib/chain.ts";

interface CityRowData {
  id: string;
  name: string;
  world: string;
  chainCity: ChainCity | null;
  listing: Listing | null;
  isLoading: boolean;
  error?: string;
}

interface VerificationRecord {
  status: "unverified" | "verifying" | "verified" | "mismatch";
  cityRoot: string | null;
  detail: string;
}

function getCityDisplayName(cityId: string): { name: string; world: string } {
  const meta = TESTNET_CITIES[cityId as TestnetCityId];
  if (meta) {
    const worldFormatted = meta.arcId
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
    return { name: meta.name, world: worldFormatted };
  }
  const clean = cityId.replace(/^city-/, "");
  const title = clean
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  return { name: title, world: "Chartered" };
}

export default function ExchangePage() {
  const { status: accountStatus, accountId, profile, connect, callContract } = useAccount();
  const isSignedIn = accountStatus === "signed-in" && !!accountId;

  const [cities, setCities] = useState<CityRowData[]>([]);
  const [isLoadingAll, setIsLoadingAll] = useState<boolean>(true);
  const [verifications, setVerifications] = useState<Record<string, VerificationRecord>>({});
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Buy Dialog State
  const [buyTarget, setBuyTarget] = useState<CityRowData | null>(null);
  const [isBuying, setIsBuying] = useState<boolean>(false);
  const [buyTrigger, setBuyTrigger] = useState<HTMLElement | null>(null);

  // Load / Refresh on-chain data
  const loadData = useCallback(async () => {
    setIsLoadingAll(true);
    const knownIds = getKnownCityIds(profile?.cityIds);

    const initialRows: CityRowData[] = knownIds.map((id) => {
      const { name, world } = getCityDisplayName(id);
      return {
        id,
        name,
        world,
        chainCity: null,
        listing: null,
        isLoading: true,
      };
    });
    setCities(initialRows);

    try {
      const updatedRows = await Promise.all(
        knownIds.map(async (id): Promise<CityRowData> => {
          const { name, world } = getCityDisplayName(id);
          try {
            const [chainCity, listing] = await Promise.all([
              fetchCity(TESTNET_CONTRACT_ID, id),
              fetchCityListing(TESTNET_CONTRACT_ID, id),
            ]);
            return {
              id,
              name,
              world,
              chainCity,
              listing,
              isLoading: false,
            };
          } catch (err) {
            return {
              id,
              name,
              world,
              chainCity: null,
              listing: null,
              isLoading: false,
              error: err instanceof Error ? err.message : String(err),
            };
          }
        })
      );
      setCities(updatedRows);
    } finally {
      setIsLoadingAll(false);
    }
  }, [profile?.cityIds]);

  // Load data on mount and whenever account / wallet redirects back
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Run audit replay verification for a city
  const handleCheckHistory = async (row: CityRowData) => {
    setVerifications((prev) => ({
      ...prev,
      [row.id]: {
        status: "verifying",
        cityRoot: null,
        detail: "Replaying simulation state from genesis...",
      },
    }));

    try {
      // Fetch fresh chain city to ensure latest state root
      const freshCity = await fetchCity(TESTNET_CONTRACT_ID, row.id);
      const targetCity = freshCity ?? row.chainCity;
      const result = verifyCityHistory(row.id, targetCity);

      setVerifications((prev) => ({
        ...prev,
        [row.id]: {
          status: result.status,
          cityRoot: result.cityRoot,
          detail: result.detail,
        },
      }));
    } catch (err) {
      setVerifications((prev) => ({
        ...prev,
        [row.id]: {
          status: "mismatch",
          cityRoot: null,
          detail: `Verification error: ${err instanceof Error ? err.message : String(err)}`,
        },
      }));
    }
  };

  // Open Buy confirm dialog
  const handleOpenBuy = (row: CityRowData, triggerBtn: HTMLButtonElement) => {
    setBuyTrigger(triggerBtn);
    setStatusMessage(null);
    setBuyTarget(row);
  };

  // Execute buy_city transaction via wallet
  const handleConfirmBuy = async () => {
    if (!buyTarget || !buyTarget.listing) return;

    const verification = verifications[buyTarget.id];
    if (!verification || verification.status !== "verified" || !verification.cityRoot) {
      setStatusMessage({
        type: "error",
        text: "City history must be verified before purchasing.",
      });
      return;
    }

    setIsBuying(true);
    setStatusMessage(null);

    try {
      await callContract({
        method: "buy_city",
        args: {
          city_id: buyTarget.id,
          expected_city_root: verification.cityRoot,
        },
        deposit: buyTarget.listing.price_yocto,
      });

      setStatusMessage({
        type: "success",
        text: `Acquisition of ${buyTarget.name} confirmed on testnet. Ownership has been transferred.`,
      });
      setBuyTarget(null);
      await loadData();
    } catch (err) {
      setStatusMessage({
        type: "error",
        text: mapExchangeError(err),
      });
    } finally {
      setIsBuying(false);
    }
  };

  return (
    <main className="w-full mx-auto max-w-[1600px] p-4 sm:p-6 space-y-6">
      <LedgerPage
        title={
          <span className="flex items-center gap-2">
            <Icon name="scale" size={20} className="text-ledger-brass" />
            <span>City Exchange</span>
          </span>
        }
        headingLevel="h1"
        headerRight={
          <button
            type="button"
            onClick={() => loadData()}
            disabled={isLoadingAll}
            aria-label="Refresh exchange listings"
            className="min-h-[44px] px-3.5 py-2 border border-ledger-ink-faded/30 bg-ledger-paper hover:bg-ledger-paper-shade text-ledger-ink font-silk text-xs uppercase tracking-wider cursor-pointer focus-visible:outline-2 focus-visible:outline-ledger-brass flex items-center gap-2 disabled:opacity-50"
          >
            <Icon
              name="hourglass"
              size={15}
              className={isLoadingAll ? "animate-spin" : ""}
              aria-hidden="true"
            />
            <span>Refresh</span>
          </button>
        }
      >
        <div className="space-y-6 font-mono text-sm text-ledger-ink">
          {/* Honesty Copy Notice */}
          <div
            role="note"
            className="p-3.5 border-l-4 border-ledger-brass bg-ledger-paper-shade/30 text-xs text-ledger-ink space-y-1"
          >
            <p className="font-semibold">
              Testnet only. Prices are in test NEAR with no real value.
            </p>
            <p className="text-ledger-ink-faded font-body text-xs">
              Direct peer-to-peer settlement charter trading. Every settlement purchase requires independent client-side replay verification before execution.
            </p>
          </div>

          {/* Signed-out Notice */}
          {!isSignedIn && (
            <div
              role="region"
              aria-label="Wallet connection required"
              className="p-4 border border-ledger-ink-faded/30 bg-ledger-paper-shade/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
            >
              <div className="space-y-1">
                <div className="font-pixel text-sm font-bold text-ledger-ink">
                  Connect your wallet to trade
                </div>
                <div className="font-body text-xs text-ledger-ink-faded">
                  Anyone may independently audit settlement histories. To buy or list settlements, connect a NEAR testnet wallet.
                </div>
              </div>
              <button
                type="button"
                onClick={() => connect()}
                className="min-h-[44px] px-5 py-2.5 border-2 border-ledger-ink bg-ledger-ink text-ledger-paper hover:bg-ledger-ink/90 font-silk text-xs uppercase tracking-wider font-bold cursor-pointer focus-visible:outline-2 focus-visible:outline-ledger-brass shrink-0"
              >
                Connect Wallet
              </button>
            </div>
          )}

          {/* Transaction Status Message */}
          {statusMessage && (
            <div
              role="alert"
              className={`p-4 border-2 ${
                statusMessage.type === "success"
                  ? "border-ledger-verdigris bg-ledger-verdigris/10 text-ledger-ink"
                  : "border-ledger-wax bg-ledger-wax/10 text-ledger-ink"
              } text-xs flex items-start gap-3`}
            >
              <Icon
                name={statusMessage.type === "success" ? "seal" : "alert"}
                size={18}
                className={`shrink-0 mt-0.5 ${
                  statusMessage.type === "success" ? "text-ledger-verdigris" : "text-ledger-wax"
                }`}
                aria-hidden="true"
              />
              <div className="space-y-1 font-body text-xs leading-relaxed">
                <span className="font-bold font-silk uppercase tracking-wider">
                  {statusMessage.type === "success" ? "Transaction Confirmed" : "Notice"}
                </span>
                <p>{statusMessage.text}</p>
              </div>
            </div>
          )}

          {/* Settlements Table */}
          <div
            tabIndex={0}
            role="region"
            aria-label="Settlement exchange ledger"
            className="overflow-x-auto border border-ledger-ink-faded/30 bg-ledger-paper-shade/20 focus-visible:outline-2 focus-visible:outline-ledger-brass"
          >
            <table className="w-full text-left font-mono text-xs border-collapse min-w-[840px]">
              <caption className="sr-only">Published settlements on testnet exchange</caption>
              <thead className="bg-ledger-paper-shade/50 border-b border-ledger-ink-faded/30 text-ledger-ink-faded font-silk text-[10px] uppercase tracking-wider">
                <tr>
                  <th scope="col" className="py-3 px-4">Settlement</th>
                  <th scope="col" className="py-3 px-3">World</th>
                  <th scope="col" className="py-3 px-3">Sovereign</th>
                  <th scope="col" className="py-3 px-3">Era / Step</th>
                  <th scope="col" className="py-3 px-3">State Root</th>
                  <th scope="col" className="py-3 px-3">Asking Price</th>
                  <th scope="col" className="py-3 px-4 text-right">Actions & Audit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ledger-ink/10">
                {cities.map((city) => {
                  const step = city.chainCity?.step ?? 0;
                  const year = Math.floor(step / 40) + 1;
                  const owner = city.chainCity?.owner ?? "—";
                  const isOwner = isSignedIn && owner.toLowerCase() === accountId?.toLowerCase();
                  const isListed = !!city.listing;
                  const priceFormatted = city.listing ? `${formatNear(city.listing.price_yocto)} NEAR` : "Not for sale";
                  const stateRoot = city.chainCity?.state_root ?? "";
                  const verification = verifications[city.id];
                  const isVerified = verification?.status === "verified";
                  const isVerifying = verification?.status === "verifying";
                  const isMismatch = verification?.status === "mismatch";

                  let buyDisabledReason: string | null = null;
                  if (!isSignedIn) {
                    buyDisabledReason = "Connect wallet to trade";
                  } else if (isOwner) {
                    buyDisabledReason = "You own this settlement";
                  } else if (!isVerified) {
                    buyDisabledReason = isMismatch
                      ? "Replay verification failed"
                      : "Audit history required";
                  }

                  return (
                    <tr
                      key={city.id}
                      className="hover:bg-ledger-paper-shade/30 transition-colors"
                    >
                      {/* Name / ID */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-ledger-ink font-display text-sm">
                          {city.name}
                        </div>
                        <div className="font-mono text-[10px] text-ledger-ink-faded">
                          {city.id}
                        </div>
                      </td>

                      {/* World / Arc */}
                      <td className="py-3.5 px-3 font-body text-xs text-ledger-ink">
                        {city.world}
                      </td>

                      {/* Sovereign / Owner */}
                      <td className="py-3.5 px-3">
                        <span
                          title={owner}
                          className="font-mono text-xs text-ledger-ink"
                        >
                          {formatShortAccountId(owner)}
                        </span>
                        {isOwner && (
                          <span className="ml-1.5 px-1.5 py-0.5 border border-ledger-verdigris/40 bg-ledger-verdigris/10 text-ledger-verdigris font-silk text-[9px] uppercase">
                            You
                          </span>
                        )}
                      </td>

                      {/* Era / Step */}
                      <td className="py-3.5 px-3">
                        {city.chainCity ? (
                          <>
                            <div className="text-ledger-ink font-mono text-xs">
                              Step {step}
                            </div>
                            <div className="font-body text-[11px] text-ledger-ink-faded">
                              Year {year}
                            </div>
                          </>
                        ) : city.isLoading ? (
                          <span className="text-ledger-ink-faded italic">Reading...</span>
                        ) : (
                          <span className="text-ledger-ink-faded">—</span>
                        )}
                      </td>

                      {/* State Root */}
                      <td className="py-3.5 px-3 font-mono text-xs text-ledger-ink">
                        {stateRoot ? (
                          <span title={stateRoot} className="cursor-help">
                            {formatShortRoot(stateRoot)}
                          </span>
                        ) : (
                          <span className="text-ledger-ink-faded">—</span>
                        )}
                      </td>

                      {/* Asking Price */}
                      <td className="py-3.5 px-3">
                        {isListed ? (
                          <div className="font-silk font-bold text-xs text-ledger-ink">
                            {priceFormatted}
                          </div>
                        ) : (
                          <span className="font-body text-xs text-ledger-ink-faded italic">
                            Not for sale
                          </span>
                        )}
                      </td>

                      {/* Actions & Verification */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex flex-col sm:flex-row items-end sm:items-center justify-end gap-2.5">
                          {/* Seal Stamp display when verified or mismatch */}
                          {verification && verification.status !== "unverified" && verification.status !== "verifying" && (
                            <SealStamp
                              result={verification.status}
                              label="History"
                              id={city.id}
                              className="scale-90 origin-right"
                            />
                          )}

                          {/* Check History Button (only needed for listed cities or anytime) */}
                          <button
                            type="button"
                            onClick={() => handleCheckHistory(city)}
                            disabled={isVerifying || city.isLoading}
                            aria-label={`Check replay history for ${city.name}`}
                            className="min-h-[44px] px-3 py-2 border border-ledger-ink-faded/40 bg-ledger-paper hover:bg-ledger-paper-shade text-ledger-ink font-silk text-[11px] uppercase tracking-wider cursor-pointer focus-visible:outline-2 focus-visible:outline-ledger-brass disabled:opacity-50 flex items-center gap-1.5"
                          >
                            <Icon
                              name="hourglass"
                              size={14}
                              className={isVerifying ? "animate-spin" : ""}
                              aria-hidden="true"
                            />
                            <span>{isVerifying ? "Auditing..." : "Check history"}</span>
                          </button>

                          {/* Buy Button */}
                          {isListed && (
                            <div className="flex flex-col items-end gap-1">
                              <button
                                type="button"
                                onClick={(e) => handleOpenBuy(city, e.currentTarget)}
                                disabled={!!buyDisabledReason || isBuying}
                                aria-label={`Buy ${city.name} for ${priceFormatted}`}
                                title={buyDisabledReason ?? `Purchase for ${priceFormatted}`}
                                className="min-h-[44px] px-4 py-2 border-2 border-ledger-ink bg-ledger-ink text-ledger-paper hover:bg-ledger-ink/90 font-silk text-xs uppercase tracking-wider font-bold cursor-pointer focus-visible:outline-2 focus-visible:outline-ledger-brass disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                Buy
                              </button>
                              {buyDisabledReason && (
                                <span className="font-body text-[10px] text-ledger-wax leading-none">
                                  {buyDisabledReason}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </LedgerPage>

      {/* Buy Confirmation Dialog */}
      {buyTarget && buyTarget.listing && (
        <LedgerConfirmDialog
          isOpen={true}
          title={`Confirm Purchase: ${buyTarget.name}`}
          onClose={() => setBuyTarget(null)}
          onConfirm={handleConfirmBuy}
          confirmLabel={`Buy for ${formatNear(buyTarget.listing.price_yocto)} NEAR`}
          cancelLabel="Decline"
          isBusy={isBuying}
          triggerElement={buyTrigger}
        >
          <div className="space-y-4 font-mono text-xs text-ledger-ink">
            <div className="p-3 border border-ledger-ink-faded/20 bg-ledger-paper-shade/30 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-ledger-ink-faded font-body">Settlement:</span>
                <span className="font-bold text-ledger-ink font-display">{buyTarget.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-ledger-ink-faded font-body">Charter ID:</span>
                <span>{buyTarget.id}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-ledger-ink-faded font-body">Seller:</span>
                <span title={buyTarget.listing.seller}>
                  {formatShortAccountId(buyTarget.listing.seller)}
                </span>
              </div>
              <div className="flex justify-between items-center border-t border-ledger-ink-faded/20 pt-2">
                <span className="text-ledger-ink-faded font-body font-bold">Purchase Price:</span>
                <span className="font-silk font-bold text-sm text-ledger-ink">
                  {formatNear(buyTarget.listing.price_yocto)} NEAR
                </span>
              </div>
            </div>

            <div className="p-3 border-l-3 border-ledger-brass bg-ledger-paper-shade/20 font-body text-xs text-ledger-ink space-y-1">
              <p className="font-semibold">You sign this in your wallet.</p>
              <p className="text-ledger-ink-faded">
                A transaction popup will open to authorize the deposit of {formatNear(buyTarget.listing.price_yocto)} test NEAR into the market contract.
              </p>
            </div>
          </div>
        </LedgerConfirmDialog>
      )}
    </main>
  );
}
