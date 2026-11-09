"use client";

import { createContext, useContext } from "react";
import type { AccountState } from "./types.ts";

/** Signed-out default so every page renders before the real provider (W1) is wired in. */
export const SIGNED_OUT: AccountState = {
  status: "signed-out",
  accountId: null,
  profile: null,
  connect: async () => {},
  disconnect: async () => {},
  saveProfile: () => {},
  callContract: async () => {
    throw new Error("Connect a wallet first");
  },
};

export const AccountContext = createContext<AccountState>(SIGNED_OUT);

export function useAccount(): AccountState {
  return useContext(AccountContext);
}
