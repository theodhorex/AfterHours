export type V3 = [number, number, number];

export type WorldLook = {
  deep: V3; shallow: V3; low: V3; mid: V3; high: V3; peak: V3;
  veinCol: V3; glow: V3; atmo: V3;
  sea: number; mtn: number; strata: number; vein: number; cloud: number;
  seed: V3;
};

/** One planet per stage. Each is its own biome, not a tint: lava rivers, gold canyons, a blue-sky garden world, glowing ley-lines, crystal. */
export const LOOKS: WorldLook[] = [
  { // Goblin Warrens: black basalt, rust seas, rivers of lava
    deep: [0.025, 0.02, 0.035], shallow: [0.2, 0.075, 0.05], low: [0.1, 0.075, 0.07], mid: [0.22, 0.13, 0.1], high: [0.4, 0.28, 0.22], peak: [0.8, 0.74, 0.7],
    veinCol: [1, 0.4, 0.1], glow: [1, 0.6, 0.25], atmo: [0.95, 0.4, 0.2],
    sea: 0.02, mtn: 1.0, strata: 0, vein: 0.95, cloud: 0.35, seed: [1.3, 4.1, 2.2],
  },
  { // Cave Hold: sapphire seas, banded gold canyons
    deep: [0.03, 0.05, 0.15], shallow: [0.14, 0.3, 0.45], low: [0.56, 0.4, 0.22], mid: [0.74, 0.52, 0.26], high: [0.42, 0.29, 0.22], peak: [0.96, 0.9, 0.78],
    veinCol: [1, 0.8, 0.4], glow: [1, 0.78, 0.42], atmo: [0.95, 0.72, 0.4],
    sea: -0.08, mtn: 1.15, strata: 0.5, vein: 0.3, cloud: 0.4, seed: [7.7, 0.4, 5.9],
  },
  { // Dino Vale: garden world, blue sky
    deep: [0.01, 0.09, 0.18], shallow: [0.03, 0.46, 0.52], low: [0.12, 0.38, 0.13], mid: [0.3, 0.55, 0.17], high: [0.42, 0.37, 0.28], peak: [0.96, 0.98, 1],
    veinCol: [0.6, 1, 0.7], glow: [1, 0.92, 0.65], atmo: [0.35, 0.62, 1],
    sea: 0.1, mtn: 0.75, strata: 0, vein: 0, cloud: 0.85, seed: [3.2, 8.8, 1.1],
  },
  { // Elf Grove: violet forests, glowing ley-lines
    deep: [0.03, 0.02, 0.14], shallow: [0.14, 0.1, 0.42], low: [0.17, 0.1, 0.34], mid: [0.3, 0.18, 0.52], high: [0.5, 0.4, 0.74], peak: [0.95, 0.92, 1],
    veinCol: [0.72, 0.5, 1], glow: [0.82, 0.66, 1], atmo: [0.6, 0.45, 1],
    sea: 0.0, mtn: 0.85, strata: 0, vein: 0.85, cloud: 0.55, seed: [9.4, 2.7, 6.6],
  },
  { // The ledger: verdigris crystal
    deep: [0.01, 0.07, 0.1], shallow: [0.05, 0.34, 0.4], low: [0.1, 0.28, 0.28], mid: [0.24, 0.5, 0.5], high: [0.55, 0.8, 0.8], peak: [0.95, 1, 1],
    veinCol: [0.4, 1, 0.9], glow: [0.55, 1, 0.92], atmo: [0.4, 0.9, 0.85],
    sea: 0.03, mtn: 0.9, strata: 0.2, vein: 0.6, cloud: 0.45, seed: [5.1, 5.5, 9.3],
  },
];
