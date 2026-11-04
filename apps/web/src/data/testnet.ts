/**
 * Testnet v3 deployment constants and explorer URL helpers for AfterHours audit.
 * Contract: afterhours-11042120-theo.testnet
 * Sourced from demo/testnet.json (4 published cities, 200 steps, 5 checkpoints each).
 */

export const TESTNET_NETWORK = "testnet";
export const TESTNET_CONTRACT_ID = "afterhours-11042120-theo.testnet";

export interface CheckpointTx {
  index: number;
  fromStep: number;
  toStep: number;
  txId: string;
  name: string;
}

export interface CityTxs {
  register_arc: string;
  create_city: string;
  checkpoint_0_40: string;
  checkpoint_40_80: string;
  checkpoint_80_120: string;
  checkpoint_120_160: string;
  checkpoint_160_200: string;
}

export interface CityTestnetDeployment {
  cityId: string;
  arcId: string;
  name: string;
  seed: string;
  steps: number;
  finalStateRoot: string;
  txs: CityTxs;
  checkpoints: readonly CheckpointTx[];
}

export const TESTNET_CITY_IDS = [
  "city-goblin_warrens",
  "city-cave_hold",
  "city-dino_vale",
  "city-elf_grove",
] as const;

export type TestnetCityId = (typeof TESTNET_CITY_IDS)[number];

function buildCityCheckpoints(txs: CityTxs): readonly CheckpointTx[] {
  return [
    { index: 1, fromStep: 0, toStep: 40, txId: txs.checkpoint_0_40, name: "checkpoint_0_40" },
    { index: 2, fromStep: 40, toStep: 80, txId: txs.checkpoint_40_80, name: "checkpoint_40_80" },
    { index: 3, fromStep: 80, toStep: 120, txId: txs.checkpoint_80_120, name: "checkpoint_80_120" },
    { index: 4, fromStep: 120, toStep: 160, txId: txs.checkpoint_120_160, name: "checkpoint_120_160" },
    { index: 5, fromStep: 160, toStep: 200, txId: txs.checkpoint_160_200, name: "checkpoint_160_200" },
  ] as const;
}

const GOBLIN_TXS: CityTxs = {
  register_arc: "DEYJE8v2v4PomNyzUdfMBkyBV9S81YNym36XEFp1Trx3",
  create_city: "G8taL327LnhEYyRvPEHVJJsZrKanxh4uMWSV2ggvbk3E",
  checkpoint_0_40: "2gzqBXu6Lwz2uARq5qE6ANto72hJ2ibtmCB7nwBFFgAk",
  checkpoint_40_80: "92yFRduawFqiCnNE9iViHt2RkCvYT8tJr6AZJKUWygD2",
  checkpoint_80_120: "3NXVn5qrvgXL7KAyZgCrN4ADsKG6frqjrDJcqaeAQosb",
  checkpoint_120_160: "6ZeqtG5GKY2sobnekrtYQyaP1Dc4ieG4vTWeis9KLgzq",
  checkpoint_160_200: "AoQGP9vF18aagGrdszxpZSgJcpeQ7GF37nqNASHvUYM",
};

const CAVE_TXS: CityTxs = {
  register_arc: "2XSt3gDt28CWHvG6qVsXhVT9hTwpNxBMQ3du8UsAeazc",
  create_city: "HkVSzGVt2KvNcD518ETKwAmR6sjnQFku3JAAJyq5Fo93",
  checkpoint_0_40: "BheNsrmztwW7AzTQ7Uci7qeTS6pZ1277zpsPC19xtCtk",
  checkpoint_40_80: "4wajMN7CywjeLZe1QoZj3CHQCwpwW6psVj5mB82iZEGY",
  checkpoint_80_120: "GhYr8zC1GVqKwFNPFQEXqjro1RWrNR4Wu6L5XYxMQPsb",
  checkpoint_120_160: "DNkMgdVJn7MtGwggJg5Y6DmtQK3bhViQn2EhASSaXvwz",
  checkpoint_160_200: "87jf1GjiQ9jJScAt3bc6pZaquUrp4QvFPrbKFrHuYudc",
};

const DINO_TXS: CityTxs = {
  register_arc: "Deabt1CuYf2VNVkrfKE6ncNZNXnmt2jJrdEG1EKirb3P",
  create_city: "GjWQhbpijy2zWH5P8s6WW2iKNQNuLuutGUNvQjJxjyXX",
  checkpoint_0_40: "J28xXzokwWDUiY2bnZtrmpfW5ybrvXpkiXAvqFbQeo9h",
  checkpoint_40_80: "72ytUY32psX1u6sav6PVHRTz2daBgJdjCw1bUNP29Szy",
  checkpoint_80_120: "8kU1YD9HEiJm5YajrD2bxxZCvo5m33Fcxf2E2RNwR5rc",
  checkpoint_120_160: "3ffGWGcJpGrrDMMX4tmzNNLxsvThJpqfZLvX2TW2UcEB",
  checkpoint_160_200: "HsZzrRNLGWhFv916YneCyLypkaf8kNyp3bDMCYzbn9wD",
};

const ELF_TXS: CityTxs = {
  register_arc: "EWHYRWyrSXpSn6aE4DRKJXg1X16ywMvQvBnBVSJXdWuz",
  create_city: "AqWxqN9pKyguSjZTA23ghinnexUF24BsRmKyCyvBCjyz",
  checkpoint_0_40: "9ZBZDwwyJ3yugijaNZdSt2B2EBbCUMj5eGtBmHHusvyd",
  checkpoint_40_80: "HTPCdKKZDmsJJcBowkyRnwLrXswCQTwwwGzeDkhq4uwZ",
  checkpoint_80_120: "B7mUvYNq2ZYWqxYo3a1eMDbozVvNCGJp9aM2Arj7Tcxz",
  checkpoint_120_160: "41Z9Dg9K9z7ro9hLNqxRs8oa5HwrM3pP2nB7cecwk8u1",
  checkpoint_160_200: "Hs1uP8dzx8KBp9kVSYYzSdDVJbfZh94fcm47RUhHjumJ",
};

export const TESTNET_CITIES: Record<TestnetCityId, CityTestnetDeployment> = {
  "city-goblin_warrens": {
    cityId: "city-goblin_warrens",
    arcId: "goblin_warrens",
    name: "Goblin Warrens",
    seed: "demo",
    steps: 200,
    finalStateRoot: "22adb8808d9e0b7b3f4dfc1e1cac49a09c52ff1c975cc6c643045cac7c92bd6b",
    txs: GOBLIN_TXS,
    checkpoints: buildCityCheckpoints(GOBLIN_TXS),
  },
  "city-cave_hold": {
    cityId: "city-cave_hold",
    arcId: "cave_hold",
    name: "Cave Hold",
    seed: "demo",
    steps: 200,
    finalStateRoot: "e734d48cc95e0d9a1abc6fc718915523840daf47d3c85c051e5f1d5f096a9e01",
    txs: CAVE_TXS,
    checkpoints: buildCityCheckpoints(CAVE_TXS),
  },
  "city-dino_vale": {
    cityId: "city-dino_vale",
    arcId: "dino_vale",
    name: "Dino Vale",
    seed: "demo",
    steps: 200,
    finalStateRoot: "f5923ad9516c8815d5b6f9f60d0cc1b3bdbaf720f58863b8de0a1b5345b68bb4",
    txs: DINO_TXS,
    checkpoints: buildCityCheckpoints(DINO_TXS),
  },
  "city-elf_grove": {
    cityId: "city-elf_grove",
    arcId: "elf_grove",
    name: "Elf Grove",
    seed: "demo",
    steps: 200,
    finalStateRoot: "4f7ab4ab4eb5f87b52481f6ab37aeeb1d6b6af3689d313ceadb205c67d680e08",
    txs: ELF_TXS,
    checkpoints: buildCityCheckpoints(ELF_TXS),
  },
};

// Default / single-city convenience exports matching the goblin_warrens entry
export const TESTNET_CITY_ID: TestnetCityId = "city-goblin_warrens";
export const TESTNET_ARC_ID = TESTNET_CITIES[TESTNET_CITY_ID].arcId;
export const TESTNET_SEED = TESTNET_CITIES[TESTNET_CITY_ID].seed;
export const TESTNET_STEPS = TESTNET_CITIES[TESTNET_CITY_ID].steps;
export const TESTNET_EXPECTED_STATE_ROOT = TESTNET_CITIES[TESTNET_CITY_ID].finalStateRoot;
export const TESTNET_CHECKPOINTS = TESTNET_CITIES[TESTNET_CITY_ID].checkpoints;
export const TESTNET_CHECKPOINT_TX_IDS = TESTNET_CHECKPOINTS.map((cp) => cp.txId);
export const TESTNET_TXS = TESTNET_CITIES[TESTNET_CITY_ID].txs;

/**
 * Builds NearBlocks explorer transaction link.
 */
export function buildExplorerTxUrl(txId: string): string {
  return `https://testnet.nearblocks.io/txns/${txId}`;
}

/**
 * Builds NearBlocks explorer account/contract link.
 */
export function buildExplorerAccountUrl(accountId: string): string {
  return `https://testnet.nearblocks.io/address/${accountId}`;
}
