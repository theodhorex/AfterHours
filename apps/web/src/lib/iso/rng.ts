/**
 * Deterministic integer PRNG based on FNV-1a hash and Mulberry32.
 * Pure integer arithmetic, zero Math.random or Date dependencies.
 */

export interface PRNG {
  nextU32(): number;
  nextInt(min: number, max: number): number;
  chance(probPercent: number): boolean;
}

/**
 * 32-bit FNV-1a hash algorithm for strings.
 */
export function fnv1a(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/**
 * Creates a deterministic Mulberry32 PRNG instance.
 */
export function createRng(seed: string | number): PRNG {
  let state = typeof seed === "number" ? (seed >>> 0) : fnv1a(seed);
  if (state === 0) {
    state = 0x6d2b79f5;
  }

  function nextU32(): number {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  }

  function nextInt(min: number, max: number): number {
    if (max <= min) return min;
    const range = (max - min + 1) >>> 0;
    return min + (nextU32() % range);
  }

  function chance(probPercent: number): boolean {
    return nextInt(0, 99) < probPercent;
  }

  return { nextU32, nextInt, chance };
}
