/** Shared account contract. The wallet worker (W1) owns the implementation; every other screen only imports these types and `useAccount`. */

export const MAX_CITIES_PER_ACCOUNT = 2;

export interface AccountProfile {
  accountId: string;
  username: string;
  /** On-chain city ids this account chose or owns (max MAX_CITIES_PER_ACCOUNT). */
  cityIds: string[];
}

export type AccountStatus = "signed-out" | "loading" | "signed-in";

export interface AccountState {
  status: AccountStatus;
  accountId: string | null;
  profile: AccountProfile | null;
  /** Opens the wallet selector (testnet). Never handles keys or passwords itself. */
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  saveProfile: (profile: AccountProfile) => void;
  /** Sends one function-call transaction through the wallet; the wallet asks the user to sign. */
  callContract: (args: {
    method: string;
    args: Record<string, unknown>;
    deposit?: string; // yoctoNEAR
    gas?: string;
  }) => Promise<unknown>;
}
