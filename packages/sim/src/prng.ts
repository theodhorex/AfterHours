import { leaf } from "./hash.ts";
import { createHash } from "node:crypto";

const MULT = 6364136223846793005n;
const MASK64 = 0xffffffffffffffffn;

/**
 * PCG32 (XSH-RR) pseudo-random number generator with 64-bit state and increment.
 * Follows Melissa O'Neill (2014) standard specification.
 */
export class Pcg32 {
  private state: bigint;
  private inc: bigint;

  constructor(initstate: bigint, initseq: bigint) {
    this.inc = ((initseq << 1n) | 1n) & MASK64;
    this.state = 0n;
    this.step();
    this.state = (this.state + (initstate & MASK64)) & MASK64;
    this.step();
  }

  private step(): void {
    this.state = (this.state * MULT + this.inc) & MASK64;
  }

  /**
   * Generates next uniform 32-bit unsigned integer [0, 2^32 - 1].
   */
  nextU32(): number {
    const oldstate = this.state;
    this.step();
    const xorshifted = Number(((oldstate >> 18n) ^ oldstate) >> 27n) >>> 0;
    const rot = Number(oldstate >> 59n);
    return ((xorshifted >>> rot) | (xorshifted << ((32 - rot) & 31))) >>> 0;
  }

  /**
   * Generates next uniform integer in [0, n - 1] without bias using rejection method.
   * n must be an integer between 1 and 2^32 inclusive.
   */
  nextBelow(n: number): number {
    if (!Number.isInteger(n) && n !== 2 ** 32) {
      throw new RangeError(`n must be an integer, got ${n}`);
    }
    if (n < 1 || n > 2 ** 32) {
      throw new RangeError(`n must be between 1 and 2^32, got ${n}`);
    }
    if (n === 1) {
      return 0;
    }
    if (n === 2 ** 32) {
      return this.nextU32();
    }
    const threshold = (2 ** 32 - n) % n;
    while (true) {
      const r = this.nextU32();
      if (r >= threshold) {
        return r % n;
      }
    }
  }

  /**
   * In-place Fisher-Yates array shuffle.
   */
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.nextBelow(i + 1);
      const temp = arr[i];
      arr[i] = arr[j];
      arr[j] = temp;
    }
    return arr;
  }
}

/**
 * Creates a Pcg32 instance for a given simulation step using leaf({w, c, s}).
 * First 8 bytes little-endian as initstate, next 8 bytes as initseq.
 */
export function seedStep(worldSeed: string, cityId: string, step: number): Pcg32 {
  const bytes = leaf({ w: worldSeed, c: cityId, s: BigInt(step) });
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const initstate = view.getBigUint64(0, true);
  const initseq = view.getBigUint64(8, true);
  return new Pcg32(initstate, initseq);
}
