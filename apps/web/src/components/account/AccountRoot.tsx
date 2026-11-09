"use client";

import { useEffect, useState, useCallback, useMemo, type ReactNode } from "react";
import "@near-wallet-selector/modal-ui/styles.css";
import { AccountContext, SIGNED_OUT } from "../../lib/account/context.tsx";
import type { AccountProfile, AccountState, AccountStatus } from "../../lib/account/types.ts";
import {
  connectWallet,
  disconnectWallet,
  callContractMethod,
  initWalletBundle,
  DEFAULT_CONTRACT_ID,
} from "../../lib/account/wallet.ts";
import { loadProfile, saveProfile as persistProfile } from "../../lib/account/profile-store.ts";

/**
 * AccountRoot provider for NEAR testnet wallet connection and profile state.
 * Renders the signed-out state during SSR with zero window access.
 * Initialises wallet selector dynamically on the client and syncs on store observables.
 */
export function AccountRoot({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AccountStatus>(SIGNED_OUT.status);
  const [accountId, setAccountId] = useState<string | null>(SIGNED_OUT.accountId);
  const [profile, setProfile] = useState<AccountProfile | null>(SIGNED_OUT.profile);

  // Sync on selector observable on the client
  useEffect(() => {
    let mounted = true;
    let subscription: { unsubscribe: () => void } | null = null;

    async function setup() {
      try {
        const { selector } = await initWalletBundle(DEFAULT_CONTRACT_ID);
        if (!mounted) return;

        subscription = selector.store.observable.subscribe((state) => {
          if (!mounted) return;
          const active = state.accounts.find((a) => a.active) ?? state.accounts[0];
          const currentId = active?.accountId ?? null;

          if (currentId) {
            const loaded = loadProfile(currentId);
            setAccountId(currentId);
            setStatus("signed-in");
            setProfile(loaded);
          } else {
            setAccountId(null);
            setStatus("signed-out");
            setProfile(null);
          }
        });
      } catch {
        // Swallow error and remain signed out gracefully
        if (mounted) {
          setAccountId(null);
          setStatus("signed-out");
          setProfile(null);
        }
      }
    }

    setup();

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  const connect = useCallback(async () => {
    await connectWallet(DEFAULT_CONTRACT_ID);
  }, []);

  const disconnect = useCallback(async () => {
    await disconnectWallet(DEFAULT_CONTRACT_ID);
    setAccountId(null);
    setStatus("signed-out");
    setProfile(null);
  }, []);

  const saveProfile = useCallback((newProfile: AccountProfile) => {
    persistProfile(newProfile);
    setProfile(newProfile);
  }, []);

  const callContract = useCallback(
    async (args: {
      method: string;
      args: Record<string, unknown>;
      deposit?: string;
      gas?: string;
    }) => {
      return callContractMethod(DEFAULT_CONTRACT_ID, args);
    },
    []
  );

  const value: AccountState = useMemo(
    () => ({
      status,
      accountId,
      profile,
      connect,
      disconnect,
      saveProfile,
      callContract,
    }),
    [status, accountId, profile, connect, disconnect, saveProfile, callContract]
  );

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export default AccountRoot;
