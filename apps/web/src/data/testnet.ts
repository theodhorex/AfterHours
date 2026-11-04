/**
 * Testnet deployment constants and explorer URL helpers for AfterHours audit.
 * Sourced from demo/testnet.json.
 */

export const TESTNET_NETWORK = "testnet";
export const TESTNET_CONTRACT_ID = "afterhours-11041910-theo.testnet";
export const TESTNET_CITY_ID = "city-goblin_warrens";
export const TESTNET_ARC_ID = "goblin_warrens";
export const TESTNET_SEED = "demo";
export const TESTNET_STEPS = 200;
export const TESTNET_EXPECTED_STATE_ROOT = "bc4fe79adc950876fc4cfd873fae3234124bf0d26dc5f059f5029e8798d754ac";

export interface CheckpointTx {
  index: number;
  fromStep: number;
  toStep: number;
  txId: string;
  name: string;
}

export const TESTNET_CHECKPOINT_TX_IDS = [
  "6aPz2kdH2yR12KM3qrUuSNgEyqKnKwkuuYGQtkQWbkuZ",
  "2MNM6QHo9tYcrvmqaQZzTPeSHo966TiW1A7xy8VWBie3",
  "5pQBBhJcuxPzEAEcWSWZprG3hwKoJtcXeJHq8rRn8Ryd",
  "5HMkLBUnGYuzNWNBtTXfJSJB4ndmf8xiU95nMRyAQ7tP",
  "Dt5AEsz7J52iZ58XSyy8jNeg7H4VmuThgjWpyqgU2FcG",
] as const;

export const TESTNET_CHECKPOINTS: readonly CheckpointTx[] = [
  { index: 1, fromStep: 0, toStep: 40, txId: "6aPz2kdH2yR12KM3qrUuSNgEyqKnKwkuuYGQtkQWbkuZ", name: "checkpoint_1" },
  { index: 2, fromStep: 40, toStep: 80, txId: "2MNM6QHo9tYcrvmqaQZzTPeSHo966TiW1A7xy8VWBie3", name: "checkpoint_2" },
  { index: 3, fromStep: 80, toStep: 120, txId: "5pQBBhJcuxPzEAEcWSWZprG3hwKoJtcXeJHq8rRn8Ryd", name: "checkpoint_3" },
  { index: 4, fromStep: 120, toStep: 160, txId: "5HMkLBUnGYuzNWNBtTXfJSJB4ndmf8xiU95nMRyAQ7tP", name: "checkpoint_4" },
  { index: 5, fromStep: 160, toStep: 200, txId: "Dt5AEsz7J52iZ58XSyy8jNeg7H4VmuThgjWpyqgU2FcG", name: "checkpoint_5" },
] as const;

export const TESTNET_TXS = {
  register_arc: "HhamH2JAWy2Xzr33gtWJb4SRg2hMhCCgsSSFTbeLpR73",
  create_city: "8Tc1wjwZPKREUDXfw1oiPFs8wKiYuEjrzxYWs8sUHKH",
  checkpoint_1: "6aPz2kdH2yR12KM3qrUuSNgEyqKnKwkuuYGQtkQWbkuZ",
  checkpoint_2: "2MNM6QHo9tYcrvmqaQZzTPeSHo966TiW1A7xy8VWBie3",
  checkpoint_3: "5pQBBhJcuxPzEAEcWSWZprG3hwKoJtcXeJHq8rRn8Ryd",
  checkpoint_4: "5HMkLBUnGYuzNWNBtTXfJSJB4ndmf8xiU95nMRyAQ7tP",
  checkpoint_5: "Dt5AEsz7J52iZ58XSyy8jNeg7H4VmuThgjWpyqgU2FcG",
} as const;

/**
 * Builds NearBlocks explorer transaction link.
 */
export function buildExplorerTxUrl(txId: string): string {
  return `https://testnet.nearblocks.io/txns/${txId}`;
}
