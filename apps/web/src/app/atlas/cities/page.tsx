"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { LedgerPage } from "../../../components/ui/LedgerPage.tsx";
import { Icon } from "../../../components/ui/Icons.tsx";
import { LedgerConfirmDialog } from "../../../components/ui/LedgerConfirmDialog.tsx";
import { useAccount } from "../../../lib/account/context.tsx";
import { TESTNET_CONTRACT_ID, TESTNET_CITIES, type TestnetCityId } from "../../../data/testnet.ts";
import {
  getKnownCityIds,
  fetchCity,
  fetchCityListing,
  fetchClaimable,
  formatNear,
  formatShortRoot,
  nearToYocto,
  mapExchangeError,
  type Listing,
} from "../../../lib/exchange.ts";
import type { ChainCity } from "../../../lib/chain.ts";

interface OwnedCity {
  id: string;
  name: string;
  world: string;
  chainCity: ChainCity;
  listing: Listing | null;
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

export default function CitiesPage() {
  const { status: accountStatus, accountId, profile, connect, callContract } = useAccount();
  const isSignedIn = accountStatus === "signed-in" && !!accountId;

  const [ownedCities, setOwnedCities] = useState<OwnedCity[]>([]);
  const [claimableYocto, setClaimableYocto] = useState<string>("0");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // List Dialog State
  const [listingTarget, setListingTarget] = useState<OwnedCity | null>(null);
  const [priceInput, setPriceInput] = useState<string>("");
  const [priceError, setPriceError] = useState<string | null>(null);
  const [isListingSubmitting, setIsListingSubmitting] = useState<boolean>(false);
  const [listTrigger, setListTrigger] = useState<HTMLElement | null>(null);

  // Cancel Dialog State
  const [cancelTarget, setCancelTarget] = useState<OwnedCity | null>(null);
  const [isCancellingSubmitting, setIsCancellingSubmitting] = useState<boolean>(false);
  const [cancelTrigger, setCancelTrigger] = useState<HTMLElement | null>(null);

  // Withdraw Dialog State
  const [isWithdrawOpen, setIsWithdrawOpen] = useState<boolean>(false);
  const [isWithdrawing, setIsWithdrawing] = useState<boolean>(false);
  const [withdrawTrigger, setWithdrawTrigger] = useState<HTMLElement | null>(null);

  // Fetch owned cities and claimable balance
  useEffect(() => {
    let active = true;

    async function fetchData() {
      if (!accountId) {
        if (active) {
          setOwnedCities([]);
          setClaimableYocto("0");
          setIsLoading(false);
        }
        return;
      }

      const knownIds = getKnownCityIds(profile?.cityIds);
      try {
        const [claimableRes, ...cityResults] = await Promise.all([
          fetchClaimable(TESTNET_CONTRACT_ID, accountId),
          ...knownIds.map(async (id) => {
            try {
              const [chainCity, listing] = await Promise.all([
                fetchCity(TESTNET_CONTRACT_ID, id),
                fetchCityListing(TESTNET_CONTRACT_ID, id),
              ]);
              return { id, chainCity, listing };
            } catch {
              return { id, chainCity: null, listing: null };
            }
          }),
        ]);

        if (!active) return;
        setClaimableYocto(claimableRes);

        const owned: OwnedCity[] = [];
        for (const res of cityResults) {
          if (
            res.chainCity &&
            res.chainCity.owner &&
            res.chainCity.owner.toLowerCase() === accountId.toLowerCase()
          ) {
            const { name, world } = getCityDisplayName(res.id);
            owned.push({
              id: res.id,
              name,
              world,
              chainCity: res.chainCity,
              listing: res.listing,
            });
          }
        }

        setOwnedCities(owned);
      } catch (err) {
        if (active) {
          setStatusMessage({
            type: "error",
            text: `Failed to load settlement data: ${err instanceof Error ? err.message : String(err)}`,
          });
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void fetchData();

    return () => {
      active = false;
    };
  }, [accountId, profile?.cityIds, refreshKey]);

  const refreshData = useCallback(() => {
    setIsLoading(true);
    setRefreshKey((k) => k + 1);
  }, []);

  // Open List dialog
  const handleOpenList = (city: OwnedCity, btn: HTMLButtonElement) => {
    setListTrigger(btn);
    setListingTarget(city);
    setPriceInput("");
    setPriceError(null);
    setStatusMessage(null);
  };

  // Price validation
  const handlePriceChange = (val: string) => {
    setPriceInput(val);
    if (!val.trim()) {
      setPriceError("Price is required");
      return;
    }
    try {
      const yocto = nearToYocto(val);
      if (BigInt(yocto) <= 0n) {
        setPriceError("Price must be greater than zero");
        return;
      }
      setPriceError(null);
    } catch (err) {
      setPriceError(err instanceof Error ? err.message : "Invalid price format");
    }
  };

  // Submit list_city
  const handleConfirmList = async () => {
    if (!listingTarget || priceError || !priceInput.trim()) return;

    let yocto: string;
    try {
      yocto = nearToYocto(priceInput);
      if (BigInt(yocto) <= 0n) throw new Error("Price must be greater than zero");
    } catch (err) {
      setPriceError(err instanceof Error ? err.message : "Invalid price");
      return;
    }

    setIsListingSubmitting(true);
    setStatusMessage(null);

    try {
      await callContract({
        method: "list_city",
        args: {
          city_id: listingTarget.id,
          price_yocto: yocto,
        },
      });

      setStatusMessage({
        type: "success",
        text: `${listingTarget.name} has been listed for sale at ${priceInput.trim()} NEAR.`,
      });
      setListingTarget(null);
      refreshData();
    } catch (err) {
      setStatusMessage({
        type: "error",
        text: mapExchangeError(err),
      });
    } finally {
      setIsListingSubmitting(false);
    }
  };

  // Open Cancel dialog
  const handleOpenCancel = (city: OwnedCity, btn: HTMLButtonElement) => {
    setCancelTrigger(btn);
    setCancelTarget(city);
    setStatusMessage(null);
  };

  // Submit cancel_listing
  const handleConfirmCancel = async () => {
    if (!cancelTarget) return;

    setIsCancellingSubmitting(true);
    setStatusMessage(null);

    try {
      await callContract({
        method: "cancel_listing",
        args: {
          city_id: cancelTarget.id,
        },
      });

      setStatusMessage({
        type: "success",
        text: `Listing for ${cancelTarget.name} has been cancelled.`,
      });
      setCancelTarget(null);
      refreshData();
    } catch (err) {
      setStatusMessage({
        type: "error",
        text: mapExchangeError(err),
      });
    } finally {
      setIsCancellingSubmitting(false);
    }
  };

  // Open Withdraw dialog
  const handleOpenWithdraw = (btn: HTMLButtonElement) => {
    setWithdrawTrigger(btn);
    setIsWithdrawOpen(true);
    setStatusMessage(null);
  };

  // Submit withdraw_claimable
  const handleConfirmWithdraw = async () => {
    setIsWithdrawing(true);
    setStatusMessage(null);

    try {
      await callContract({
        method: "withdraw_claimable",
        args: {},
      });

      setStatusMessage({
        type: "success",
        text: `Withdrew ${formatNear(claimableYocto)} NEAR in proceeds to your wallet.`,
      });
      setIsWithdrawOpen(false);
      refreshData();
    } catch (err) {
      setStatusMessage({
        type: "error",
        text: mapExchangeError(err),
      });
    } finally {
      setIsWithdrawing(false);
    }
  };

  const hasClaimable = BigInt(claimableYocto || "0") > 0n;

  return (
    <main className="w-full mx-auto max-w-[1600px] p-4 sm:p-6 space-y-6">
      <LedgerPage
        title={
          <span className="flex items-center gap-2">
            <Icon name="scroll" size={20} className="text-ledger-brass" />
            <span>My Cities</span>
          </span>
        }
        headingLevel="h1"
        headerRight={
          <button
            type="button"
            onClick={() => refreshData()}
            disabled={isLoading}
            aria-label="Refresh settlement inventory"
            className="min-h-[44px] px-3.5 py-2 border border-ledger-ink-faded/30 bg-ledger-paper hover:bg-ledger-paper-shade text-ledger-ink font-silk text-xs uppercase tracking-wider cursor-pointer focus-visible:outline-2 focus-visible:outline-ledger-brass flex items-center gap-2 disabled:opacity-50"
          >
            <Icon
              name="hourglass"
              size={15}
              className={isLoading ? "animate-spin" : ""}
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
              Manage your chartered settlements. Accounts may govern a maximum of two settlements concurrently on NEAR testnet.
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
                  Connect your wallet to manage your settlements
                </div>
                <div className="font-body text-xs text-ledger-ink-faded">
                  Sign in with a NEAR testnet wallet to inspect owned settlements, list them on the exchange, or withdraw proceeds.
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

          {isSignedIn && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Proceeds Card */}
              <div
                role="region"
                aria-label="Treasury proceeds escrow card"
                className="lg:col-span-1 p-5 border-2 border-ledger-brass bg-ledger-paper-shade/30 space-y-4"
              >
                <div className="flex items-center justify-between border-b border-ledger-ink-faded/20 pb-3">
                  <span className="font-pixel text-sm font-bold text-ledger-ink flex items-center gap-2">
                    <Icon name="coin" size={16} className="text-ledger-brass" aria-hidden="true" />
                    <span>Proceeds Escrow</span>
                  </span>
                  <span className="font-mono text-[11px] text-ledger-ink-faded">
                    get_claimable
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="text-[11px] text-ledger-ink-faded font-body">
                    Accumulated claimable proceeds from settlement sales and purchase refunds:
                  </div>
                  <div className="font-silk text-2xl font-bold text-ledger-ink pt-1">
                    {formatNear(claimableYocto)} NEAR
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={(e) => handleOpenWithdraw(e.currentTarget)}
                    disabled={!hasClaimable || isWithdrawing}
                    aria-label={`Withdraw ${formatNear(claimableYocto)} NEAR`}
                    className="w-full min-h-[44px] px-4 py-2 border-2 border-ledger-ink bg-ledger-ink text-ledger-paper hover:bg-ledger-ink/90 font-silk text-xs uppercase tracking-wider font-bold cursor-pointer focus-visible:outline-2 focus-visible:outline-ledger-brass disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <span>Withdraw Proceeds</span>
                  </button>
                  {!hasClaimable && (
                    <p className="font-body text-[11px] text-ledger-ink-faded text-center mt-2">
                      No claimable balance currently available.
                    </p>
                  )}
                </div>
              </div>

              {/* Chartered Settlements List */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-pixel text-sm font-bold text-ledger-ink">
                    Governed Settlements ({ownedCities.length} / 2)
                  </h2>
                  <span className="font-body text-xs text-ledger-ink-faded">
                    Maximum 2 concurrent settlements per account
                  </span>
                </div>

                {isLoading ? (
                  <div className="p-8 text-center border border-dashed border-ledger-ink-faded/30 text-ledger-ink-faded font-body text-xs">
                    Reading settlement records from NEAR testnet...
                  </div>
                ) : ownedCities.length === 0 ? (
                  <div
                    role="region"
                    aria-label="No governed settlements"
                    className="p-8 text-center border border-dashed border-ledger-ink-faded/30 bg-ledger-paper-shade/20 space-y-3"
                  >
                    <div className="font-pixel text-sm font-bold text-ledger-ink">
                      No settlements chartered under this account
                    </div>
                    <p className="font-body text-xs text-ledger-ink-faded max-w-md mx-auto leading-relaxed">
                      You do not currently own any settlements on testnet. You can acquire a chartered settlement on the City Exchange.
                    </p>
                    <div className="pt-2">
                      <Link
                        href="/atlas/exchange"
                        className="inline-flex items-center min-h-[44px] px-5 py-2 border-2 border-ledger-ink bg-ledger-ink text-ledger-paper hover:bg-ledger-ink/90 font-silk text-xs uppercase tracking-wider font-bold focus-visible:outline-2 focus-visible:outline-ledger-brass"
                      >
                        Explore City Exchange
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {ownedCities.map((city) => {
                      const isListed = !!city.listing;
                      const step = city.chainCity.step;
                      const year = Math.floor(step / 40) + 1;

                      return (
                        <div
                          key={city.id}
                          className="p-5 border border-ledger-ink-faded/30 bg-ledger-paper-shade/20 space-y-4"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-ledger-ink-faded/20 pb-3">
                            <div>
                              <h3 className="font-display font-bold text-base text-ledger-ink">
                                {city.name}
                              </h3>
                              <div className="font-mono text-xs text-ledger-ink-faded">
                                {city.id} &bull; {city.world}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {isListed ? (
                                <span className="px-2.5 py-1 border border-ledger-brass bg-ledger-brass/10 text-ledger-brass font-silk text-xs uppercase font-bold">
                                  Listed: {formatNear(city.listing?.price_yocto ?? "0")} NEAR
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 border border-ledger-ink-faded/30 bg-ledger-paper-shade/40 text-ledger-ink-faded font-silk text-xs uppercase">
                                  Not Listed
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs text-ledger-ink">
                            <div>
                              <span className="text-ledger-ink-faded font-body block text-[11px]">
                                Current Step
                              </span>
                              <span>Step {step}</span>
                            </div>
                            <div>
                              <span className="text-ledger-ink-faded font-body block text-[11px]">
                                Settlement Era
                              </span>
                              <span>Year {year}</span>
                            </div>
                            <div className="col-span-2">
                              <span className="text-ledger-ink-faded font-body block text-[11px]">
                                State Root
                              </span>
                              <span title={city.chainCity.state_root} className="cursor-help">
                                {formatShortRoot(city.chainCity.state_root)}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-end gap-3 pt-2 border-t border-ledger-ink-faded/15">
                            {isListed ? (
                              <button
                                type="button"
                                onClick={(e) => handleOpenCancel(city, e.currentTarget)}
                                className="min-h-[44px] px-4 py-2 border border-ledger-wax/60 bg-ledger-wax/10 text-ledger-wax hover:bg-ledger-wax/20 font-silk text-xs uppercase tracking-wider font-bold cursor-pointer focus-visible:outline-2 focus-visible:outline-ledger-brass"
                              >
                                Cancel Listing
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => handleOpenList(city, e.currentTarget)}
                                className="min-h-[44px] px-5 py-2 border-2 border-ledger-ink bg-ledger-ink text-ledger-paper hover:bg-ledger-ink/90 font-silk text-xs uppercase tracking-wider font-bold cursor-pointer focus-visible:outline-2 focus-visible:outline-ledger-brass"
                              >
                                List for Sale
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </LedgerPage>

      {/* List City Dialog */}
      {listingTarget && (
        <LedgerConfirmDialog
          isOpen={true}
          title={`List Settlement for Sale: ${listingTarget.name}`}
          onClose={() => setListingTarget(null)}
          onConfirm={handleConfirmList}
          confirmLabel="Authorize Listing"
          cancelLabel="Cancel"
          isConfirmDisabled={!!priceError || !priceInput.trim()}
          isBusy={isListingSubmitting}
          triggerElement={listTrigger}
        >
          <div className="space-y-4 font-mono text-xs text-ledger-ink">
            <div className="space-y-2">
              <label htmlFor="price-input" className="block font-silk text-xs uppercase tracking-wider text-ledger-ink font-bold">
                Asking Price (in test NEAR)
              </label>
              <div className="relative">
                <input
                  id="price-input"
                  type="text"
                  inputMode="decimal"
                  placeholder="e.g. 5.5"
                  value={priceInput}
                  onChange={(e) => handlePriceChange(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 border-2 border-ledger-ink-faded/40 bg-ledger-paper focus-visible:border-ledger-brass focus-visible:outline-2 focus-visible:outline-ledger-brass font-mono text-sm text-ledger-ink"
                  aria-describedby="price-helper price-error"
                />
              </div>
              <div id="price-helper" className="font-body text-[11px] text-ledger-ink-faded">
                Enter an amount in test NEAR. No real value. Up to 24 decimals.
              </div>
              {priceError && (
                <div id="price-error" role="alert" className="font-body text-xs text-ledger-wax font-semibold">
                  {priceError}
                </div>
              )}
            </div>

            <div className="p-3 border-l-3 border-ledger-brass bg-ledger-paper-shade/20 font-body text-xs text-ledger-ink space-y-1">
              <p className="font-semibold">You sign this in your wallet.</p>
              <p className="text-ledger-ink-faded">
                A wallet transaction will open to publish the listing for {listingTarget.name} at your specified price.
              </p>
            </div>
          </div>
        </LedgerConfirmDialog>
      )}

      {/* Cancel Listing Dialog */}
      {cancelTarget && (
        <LedgerConfirmDialog
          isOpen={true}
          title={`Cancel Listing: ${cancelTarget.name}`}
          onClose={() => setCancelTarget(null)}
          onConfirm={handleConfirmCancel}
          confirmLabel="Confirm Cancellation"
          cancelLabel="Keep Listed"
          isBusy={isCancellingSubmitting}
          triggerElement={cancelTrigger}
        >
          <div className="space-y-3 font-body text-xs text-ledger-ink">
            <p>
              Are you sure you want to cancel the marketplace listing for{" "}
              <strong className="font-bold">{cancelTarget.name}</strong>?
            </p>
            <p className="text-ledger-ink-faded">
              This will withdraw the charter from the public exchange. Other players will no longer be able to acquire it.
            </p>
            <div className="p-3 border-l-3 border-ledger-brass bg-ledger-paper-shade/20 font-body text-xs text-ledger-ink">
              <span className="font-semibold">You sign this in your wallet.</span>
            </div>
          </div>
        </LedgerConfirmDialog>
      )}

      {/* Withdraw Proceeds Dialog */}
      {isWithdrawOpen && (
        <LedgerConfirmDialog
          isOpen={true}
          title="Withdraw Treasury Proceeds"
          onClose={() => setIsWithdrawOpen(false)}
          onConfirm={handleConfirmWithdraw}
          confirmLabel={`Withdraw ${formatNear(claimableYocto)} NEAR`}
          cancelLabel="Close"
          isBusy={isWithdrawing}
          triggerElement={withdrawTrigger}
        >
          <div className="space-y-3 font-body text-xs text-ledger-ink">
            <p>
              Transfer accumulated marketplace proceeds of{" "}
              <strong className="font-silk font-bold text-sm text-ledger-ink">
                {formatNear(claimableYocto)} NEAR
              </strong>{" "}
              from the market escrow contract directly to your wallet account.
            </p>
            <div className="p-3 border-l-3 border-ledger-brass bg-ledger-paper-shade/20 font-body text-xs text-ledger-ink">
              <span className="font-semibold">You sign this in your wallet.</span>
            </div>
          </div>
        </LedgerConfirmDialog>
      )}
    </main>
  );
}
