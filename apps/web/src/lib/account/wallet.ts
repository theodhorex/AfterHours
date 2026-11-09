import type { WalletSelector } from "@near-wallet-selector/core";
import type { WalletSelectorModal } from "@near-wallet-selector/modal-ui";
import { TESTNET_CONTRACT_ID } from "../../data/testnet.ts";

export const DEFAULT_CONTRACT_ID = TESTNET_CONTRACT_ID;
export const DEFAULT_NETWORK = "testnet";
export const DEFAULT_FUNCTION_CALL_GAS = "100000000000000"; // 100 Tgas

export interface WalletBundle {
  selector: WalletSelector;
  modal: WalletSelectorModal;
}

let bundlePromise: Promise<WalletBundle> | null = null;

/**
 * Initialises NEAR Wallet Selector and Modal on the client only.
 * Dynamically imports core, modal-ui, and my-near-wallet so SSR never touches window or browser storage.
 */
export async function initWalletBundle(
  contractId: string = DEFAULT_CONTRACT_ID
): Promise<WalletBundle> {
  if (typeof window === "undefined") {
    throw new Error("NEAR Wallet Selector can only be initialized on the client.");
  }

  if (!bundlePromise) {
    bundlePromise = (async () => {
      const [
        { setupWalletSelector },
        { setupModal },
        { setupMyNearWallet },
      ] = await Promise.all([
        import("@near-wallet-selector/core"),
        import("@near-wallet-selector/modal-ui"),
        import("@near-wallet-selector/my-near-wallet"),
      ]);

      const selector = await setupWalletSelector({
        network: DEFAULT_NETWORK,
        modules: [setupMyNearWallet()],
      });

      const modal = setupModal(selector, {
        contractId,
        theme: "dark",
        description: "Connect your NEAR wallet to manage your AfterHours fantasy realm.",
      });

      return { selector, modal };
    })();
  }

  return bundlePromise;
}

/**
 * Opens the wallet selector modal and waits for user action.
 * Throws a clean, plain Error if user closes the modal.
 */
export async function connectWallet(contractId: string = DEFAULT_CONTRACT_ID): Promise<void> {
  const { selector, modal } = await initWalletBundle(contractId);

  return new Promise<void>((resolve, reject) => {
    if (selector.isSignedIn()) {
      resolve();
      return;
    }

    let unsubModal: { remove: () => void } | null = null;
    let unsubStore: { unsubscribe: () => void } | null = null;

    const cleanup = () => {
      unsubModal?.remove();
      unsubStore?.unsubscribe();
    };

    unsubModal = modal.on("onHide", ({ hideReason }) => {
      cleanup();
      if (selector.isSignedIn()) {
        resolve();
      } else if (hideReason === "user-triggered") {
        reject(new Error("User closed the modal"));
      } else {
        resolve();
      }
    });

    unsubStore = selector.store.observable.subscribe((state) => {
      const active = state.accounts.find((a) => a.active) ?? state.accounts[0];
      if (active) {
        cleanup();
        modal.hide();
        resolve();
      }
    });

    try {
      modal.show();
    } catch (err) {
      cleanup();
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}

/**
 * Disconnects the active wallet.
 */
export async function disconnectWallet(contractId: string = DEFAULT_CONTRACT_ID): Promise<void> {
  const { selector } = await initWalletBundle(contractId);
  if (selector.isSignedIn()) {
    const wallet = await selector.wallet();
    await wallet.signOut();
  }
}

/**
 * Calls a contract method with a FunctionCall action.
 * Gas defaults to 100 Tgas, deposit defaults to "0".
 * Plain error strings on rejection.
 */
export async function callContractMethod(
  contractId: string,
  args: {
    method: string;
    args: Record<string, unknown>;
    deposit?: string;
    gas?: string;
  }
): Promise<unknown> {
  const { selector } = await initWalletBundle(contractId);
  if (!selector.isSignedIn()) {
    throw new Error("Connect a wallet first");
  }

  const wallet = await selector.wallet();

  try {
    const outcome = await wallet.signAndSendTransaction({
      receiverId: contractId,
      actions: [
        {
          type: "FunctionCall",
          params: {
            methodName: args.method,
            args: args.args,
            gas: args.gas ?? DEFAULT_FUNCTION_CALL_GAS,
            deposit: args.deposit ?? "0",
          },
        },
      ],
    });
    return outcome;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/reject|cancel|user closed|denied/i.test(msg)) {
      throw new Error("Wallet rejected");
    }
    throw new Error(`Transaction failed: ${msg}`);
  }
}
