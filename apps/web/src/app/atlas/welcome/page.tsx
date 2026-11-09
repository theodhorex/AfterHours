"use client";

import { useState, useId, useTransition, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "../../../lib/account/context.tsx";
import {
  validateUsername,
  suggestUsername,
  HONEST_PROFILE_STORAGE_LABEL,
  MAX_CITIES_PER_ACCOUNT,
} from "../../../lib/account/profile-store.ts";
import { LedgerPage } from "../../../components/ui/LedgerPage.tsx";

interface WorldCardData {
  cityId: string;
  worldName: string;
  descriptionLine1: string;
  descriptionLine2: string;
  richIn: string;
  sectors: readonly string[];
  uniqueItems: readonly string[];
}

const WORLDS: readonly WorldCardData[] = [
  {
    cityId: "city-goblin_warrens",
    worldName: "Goblin Warrens",
    descriptionLine1: "Subterranean industrial burrows beneath volcanic crust.",
    descriptionLine2: "Driven by frantic scrap harvesting and alchemical ferment.",
    richIn: "Rich in scrap and gadget production across Scrap Forges and Mushroom Farms.",
    sectors: ["Mushroom Farms", "Deep Mines", "Scrap Forges", "Bubbling Vats", "Sump Docks", "Shaman Towers"],
    uniqueItems: ["scrap", "gadget"],
  },
  {
    cityId: "city-cave_hold",
    worldName: "Cave Hold",
    descriptionLine1: "Ancient carved stone bastions warmed by communal fire pits.",
    descriptionLine2: "Governed by ritual quarrying and ancestral memory.",
    richIn: "Rich in hide and totem crafting across Flint Quarries and Elder Caves.",
    sectors: ["Gathering Grounds", "Flint Quarries", "Fire Pits", "Herb Dens", "River Landing", "Elder Caves"],
    uniqueItems: ["hide", "totem"],
  },
  {
    cityId: "city-dino_vale",
    worldName: "Dino Vale",
    descriptionLine1: "Sun-drenched river basins teeming with primeval fauna.",
    descriptionLine2: "Sustained by fossil extraction and raptor husbandry.",
    richIn: "Rich in amber and fossil excavation across Fossil Quarries and Raptor Roosts.",
    sectors: ["Egg Pastures", "Fossil Quarries", "Bone Smithies", "Tar Pits", "River Crossing", "Raptor Roosts"],
    uniqueItems: ["amber", "fossil"],
  },
  {
    cityId: "city-elf_grove",
    worldName: "Elf Grove",
    descriptionLine1: "Canopied arboreal sanctuaries anchored to deep roots.",
    descriptionLine2: "Harnessed through wood shaping and celestial observation.",
    richIn: "Rich in silverleaf and stave resonance across Moonwell Basin and Star Towers.",
    sectors: ["Sylvan Canopy", "Deep Roots", "Living-Wood Shapers", "Moonwell Basin", "Lotus Marina", "Star Towers"],
    uniqueItems: ["silverleaf", "stave"],
  },
] as const;

export default function AtlasWelcomePage() {
  const { status, accountId, profile, connect, disconnect, saveProfile } = useAccount();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [customUsername, setCustomUsername] = useState<string | null>(null);
  const [customCities, setCustomCities] = useState<string[] | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const usernameInputId = useId();
  const usernameFeedbackId = useId();

  // Derived state following React 19 "You Might Not Need an Effect" best practices
  const username = useMemo(
    () => customUsername ?? profile?.username ?? (accountId ? suggestUsername(accountId) : ""),
    [customUsername, profile?.username, accountId]
  );
  const selectedCities = useMemo(
    () => customCities ?? profile?.cityIds ?? [],
    [customCities, profile?.cityIds]
  );

  const usernameValidation = validateUsername(username);
  const isStep1Done = status === "signed-in" && !!accountId;
  const isStep2Done = isStep1Done && usernameValidation.valid;
  const isStep3Done =
    isStep1Done &&
    selectedCities.length > 0 &&
    selectedCities.length <= MAX_CITIES_PER_ACCOUNT;
  const canStart =
    isStep1Done &&
    usernameValidation.valid &&
    selectedCities.length > 0 &&
    selectedCities.length <= MAX_CITIES_PER_ACCOUNT;

  const handleConnect = useCallback(async () => {
    setWalletError(null);
    setIsConnecting(true);
    try {
      await connect();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setWalletError(msg);
    } finally {
      setIsConnecting(false);
    }
  }, [connect]);

  const handleDisconnect = useCallback(async () => {
    setWalletError(null);
    try {
      await disconnect();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setWalletError(msg);
    }
  }, [disconnect]);

  const handlePickUsername = useCallback(() => {
    if (accountId) {
      setCustomUsername(suggestUsername(accountId));
    }
  }, [accountId]);

  const toggleCity = useCallback((cityId: string) => {
    setCustomCities((current) => {
      const base = current ?? profile?.cityIds ?? [];
      if (base.includes(cityId)) {
        return base.filter((id) => id !== cityId);
      }
      if (base.length >= MAX_CITIES_PER_ACCOUNT) {
        return base;
      }
      return [...base, cityId];
    });
  }, [profile]);

  const handleStartPlaying = useCallback(() => {
    if (!canStart || !accountId) return;
    saveProfile({
      accountId,
      username: username.trim(),
      cityIds: selectedCities,
    });
    startTransition(() => {
      router.push("/atlas");
    });
  }, [canStart, accountId, username, selectedCities, saveProfile, router]);

  return (
    <main className="max-w-4xl mx-auto p-4 sm:p-6 md:p-8">
      <LedgerPage
        title="Ledger Onboarding & Realm Induction"
        headingLevel="h1"
        className="border border-ledger-ink-faded/30"
      >
        <p className="text-sm text-ledger-ink mb-8 leading-relaxed max-w-2xl">
          Register your identity in the AfterHours fantasy ledger. Complete each step in order
          to bind your wallet and reserve your initial territory.
        </p>

        <ol className="space-y-8 list-none p-0 m-0">
          {/* STEP 1 */}
          <li className="border border-ledger-ink-faded/30 bg-ledger-paper-shade/20 p-5 sm:p-6">
            <header className="flex items-center justify-between pb-3 border-b border-ledger-ink-faded/20 mb-4">
              <h2 className="font-pixel text-base sm:text-lg text-ledger-ink font-bold flex items-center gap-3">
                <span className="font-mono text-sm px-2 py-0.5 border border-ledger-ink-faded/40 bg-ledger-paper-shade/40">
                  01
                </span>
                <span>Connect NEAR Wallet</span>
              </h2>
              <span
                className={`font-mono text-xs font-bold px-2 py-1 border ${
                  isStep1Done
                    ? "border-ledger-verdigris text-ledger-verdigris bg-ledger-verdigris/10"
                    : "border-ledger-ink-faded/40 text-ledger-ink-faded"
                }`}
              >
                {isStep1Done ? "[ Checked: Connected ]" : "[ Pending ]"}
              </span>
            </header>

            {isStep1Done ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="text-xs text-ledger-ink-faded">Active Account ID:</p>
                  <p className="font-mono text-sm font-bold text-ledger-ink">{accountId}</p>
                </div>
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="min-h-[44px] min-w-[44px] px-4 py-2 border border-ledger-ink-faded/40 bg-ledger-paper text-ledger-ink font-pixel text-xs font-bold hover:bg-ledger-paper-shade/60 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-ledger-brass"
                >
                  Disconnect Wallet
                </button>
              </div>
            ) : (
              <div>
                <button
                  type="button"
                  onClick={handleConnect}
                  disabled={isConnecting}
                  className="min-h-[44px] px-6 py-2.5 bg-ledger-ink text-ledger-paper font-pixel text-sm font-bold border border-ledger-ink hover:bg-ledger-ink-faded transition-colors cursor-pointer disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-ledger-brass"
                >
                  {isConnecting ? "Opening wallet selector..." : "Connect NEAR Testnet Wallet"}
                </button>
                <p className="mt-3 text-xs text-ledger-ink-faded leading-relaxed">
                  No wallet yet? You can create a free testnet account directly in the wallet popup.
                  We never create accounts, and our code never handles keys or passwords.
                </p>
                {walletError && (
                  <p
                    role="alert"
                    className="mt-3 text-xs font-bold text-ledger-wax p-2 border border-ledger-wax/40 bg-ledger-wax/10"
                  >
                    {walletError}
                  </p>
                )}
              </div>
            )}
          </li>

          {/* STEP 2 */}
          <li
            className={`border border-ledger-ink-faded/30 p-5 sm:p-6 transition-opacity ${
              isStep1Done ? "bg-ledger-paper-shade/20 opacity-100" : "bg-ledger-paper-shade/10 opacity-60"
            }`}
          >
            <header className="flex items-center justify-between pb-3 border-b border-ledger-ink-faded/20 mb-4">
              <h2 className="font-pixel text-base sm:text-lg text-ledger-ink font-bold flex items-center gap-3">
                <span className="font-mono text-sm px-2 py-0.5 border border-ledger-ink-faded/40 bg-ledger-paper-shade/40">
                  02
                </span>
                <span>Choose Profile Username</span>
              </h2>
              <span
                className={`font-mono text-xs font-bold px-2 py-1 border ${
                  isStep2Done
                    ? "border-ledger-verdigris text-ledger-verdigris bg-ledger-verdigris/10"
                    : "border-ledger-ink-faded/40 text-ledger-ink-faded"
                }`}
              >
                {isStep2Done ? "[ Checked: Valid ]" : "[ Pending ]"}
              </span>
            </header>

            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                <div className="flex-1">
                  <label
                    htmlFor={usernameInputId}
                    className="block font-pixel text-xs font-bold text-ledger-ink mb-1"
                  >
                    Username (3-20 characters: letters, digits, underscore, hyphen)
                  </label>
                  <input
                    id={usernameInputId}
                    type="text"
                    value={username}
                    onChange={(e) => setCustomUsername(e.target.value)}
                    disabled={!isStep1Done}
                    aria-describedby={usernameFeedbackId}
                    aria-invalid={!usernameValidation.valid}
                    placeholder="e.g. Brassy-Goblin-42"
                    className="w-full min-h-[44px] px-3 py-2 bg-ledger-paper border border-ledger-ink-faded/50 text-ledger-ink font-mono text-sm focus-visible:outline-2 focus-visible:outline-ledger-brass disabled:opacity-50"
                  />
                </div>
                <button
                  type="button"
                  onClick={handlePickUsername}
                  disabled={!isStep1Done}
                  className="min-h-[44px] px-4 py-2 border border-ledger-ink-faded/40 bg-ledger-paper text-ledger-ink font-pixel text-xs font-bold hover:bg-ledger-paper-shade/60 transition-colors cursor-pointer disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-ledger-brass"
                >
                  Pick one for me
                </button>
              </div>

              <div id={usernameFeedbackId} aria-live="polite" className="text-xs">
                {!isStep1Done ? (
                  <span className="text-ledger-ink-faded">Connect your wallet in Step 1 first.</span>
                ) : usernameValidation.valid ? (
                  <span className="text-ledger-verdigris font-bold">Username format is valid.</span>
                ) : (
                  <span className="text-ledger-wax font-bold">{usernameValidation.error}</span>
                )}
              </div>
            </div>
          </li>

          {/* STEP 3 */}
          <li
            className={`border border-ledger-ink-faded/30 p-5 sm:p-6 transition-opacity ${
              isStep2Done ? "bg-ledger-paper-shade/20 opacity-100" : "bg-ledger-paper-shade/10 opacity-60"
            }`}
          >
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-ledger-ink-faded/20 mb-4">
              <div>
                <h2 className="font-pixel text-base sm:text-lg text-ledger-ink font-bold flex items-center gap-3">
                  <span className="font-mono text-sm px-2 py-0.5 border border-ledger-ink-faded/40 bg-ledger-paper-shade/40">
                    03
                  </span>
                  <span>Select Starting Cities</span>
                </h2>
                <p className="text-xs text-ledger-ink-faded mt-1">
                  Select up to {MAX_CITIES_PER_ACCOUNT} world territories to add to your ledger portfolio.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold px-2 py-1 border border-ledger-ink-faded/30 bg-ledger-paper-shade/30 text-ledger-ink">
                  Selected: {selectedCities.length} / {MAX_CITIES_PER_ACCOUNT}
                </span>
                <span
                  className={`font-mono text-xs font-bold px-2 py-1 border ${
                    isStep3Done
                      ? "border-ledger-verdigris text-ledger-verdigris bg-ledger-verdigris/10"
                      : "border-ledger-ink-faded/40 text-ledger-ink-faded"
                  }`}
                >
                  {isStep3Done ? "[ Checked: Selected ]" : "[ Pending ]"}
                </span>
              </div>
            </header>

            <div
              role="group"
              aria-label="Starting city options"
              className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4"
            >
              {WORLDS.map((world) => {
                const isSelected = selectedCities.includes(world.cityId);
                const isAtCap = selectedCities.length >= MAX_CITIES_PER_ACCOUNT;
                const isDisabled = !isStep1Done || (!isSelected && isAtCap);

                let stateLabel = "[ Available for selection ]";
                if (!isStep1Done) {
                  stateLabel = "[ Disabled: Connect wallet first ]";
                } else if (isSelected) {
                  stateLabel = "[ Selected: Click to remove ]";
                } else if (isAtCap) {
                  stateLabel = "[ Disabled: Maximum 2 cities reached ]";
                }

                return (
                  <button
                    key={world.cityId}
                    type="button"
                    role="checkbox"
                    aria-checked={isSelected}
                    aria-disabled={isDisabled}
                    disabled={isDisabled}
                    onClick={() => toggleCity(world.cityId)}
                    className={`text-left p-4 border transition-colors min-h-[44px] cursor-pointer focus-visible:outline-2 focus-visible:outline-ledger-brass flex flex-col justify-between ${
                      isSelected
                        ? "border-ledger-brass bg-ledger-paper-shade/80 ring-2 ring-ledger-brass"
                        : isDisabled
                        ? "border-ledger-ink-faded/20 bg-ledger-paper-shade/10 opacity-60 cursor-not-allowed"
                        : "border-ledger-ink-faded/40 bg-ledger-paper hover:bg-ledger-paper-shade/50"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between pb-2 border-b border-ledger-ink-faded/20 mb-2">
                        <span className="font-pixel text-sm sm:text-base font-bold text-ledger-ink">
                          {world.worldName}
                        </span>
                        <span
                          className={`font-mono text-[11px] font-bold ${
                            isSelected
                              ? "text-ledger-brass"
                              : isDisabled && isAtCap
                              ? "text-ledger-wax"
                              : "text-ledger-ink-faded"
                          }`}
                        >
                          {stateLabel}
                        </span>
                      </div>
                      <p className="text-xs text-ledger-ink leading-relaxed">
                        {world.descriptionLine1}
                        <br />
                        {world.descriptionLine2}
                      </p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-ledger-ink-faded/10">
                      <p className="text-xs font-bold text-ledger-ink-faded">{world.richIn}</p>
                      <p className="text-[11px] font-mono text-ledger-ink-faded/80 mt-1">
                        Sectors: {world.sectors.join(", ")}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </li>

          {/* STEP 4 */}
          <li
            className={`border border-ledger-ink-faded/30 p-5 sm:p-6 transition-opacity ${
              canStart ? "bg-ledger-paper-shade/30 opacity-100" : "bg-ledger-paper-shade/10 opacity-60"
            }`}
          >
            <header className="flex items-center justify-between pb-3 border-b border-ledger-ink-faded/20 mb-4">
              <h2 className="font-pixel text-base sm:text-lg text-ledger-ink font-bold flex items-center gap-3">
                <span className="font-mono text-sm px-2 py-0.5 border border-ledger-ink-faded/40 bg-ledger-paper-shade/40">
                  04
                </span>
                <span>Confirm Induction & Start Playing</span>
              </h2>
              <span className="font-mono text-xs font-bold px-2 py-1 border border-ledger-ink-faded/40 text-ledger-ink-faded">
                {canStart ? "[ Ready ]" : "[ Incomplete ]"}
              </span>
            </header>

            <div className="space-y-4">
              <div className="p-4 border border-ledger-ink-faded/30 bg-ledger-paper space-y-2 text-xs leading-relaxed text-ledger-ink">
                <p className="font-bold text-sm">Territory Reservation Notice</p>
                <p>
                  Your city is created on NEAR when it is claimed. This induction reserves your
                  chosen territories locally in your ledger profile.
                </p>
                <p className="text-ledger-ink-faded italic">
                  {HONEST_PROFILE_STORAGE_LABEL}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-4 pt-2">
                <button
                  type="button"
                  onClick={handleStartPlaying}
                  disabled={!canStart || isPending}
                  className="min-h-[44px] px-8 py-3 bg-ledger-brass text-ledger-paper font-pixel text-sm sm:text-base font-bold border border-ledger-ink hover:bg-ledger-ink transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-ledger-brass"
                >
                  {isPending ? "Directing to Atlas..." : "Start playing"}
                </button>

                {!canStart && (
                  <p className="text-xs text-ledger-wax font-medium">
                    {!isStep1Done
                      ? "Action required: Connect your NEAR wallet in Step 1."
                      : !usernameValidation.valid
                      ? "Action required: Provide a valid username in Step 2."
                      : "Action required: Select 1 or 2 cities in Step 3."}
                  </p>
                )}
              </div>
            </div>
          </li>
        </ol>
      </LedgerPage>
    </main>
  );
}
