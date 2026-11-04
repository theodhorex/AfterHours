import test from "node:test";
import assert from "node:assert/strict";
import { Pcg32, seedStep } from "../src/prng.ts";

test("PCG32 reference check seeded (42, 54)", () => {
  const rng = new Pcg32(42n, 54n);
  const expected = [
    0xa15c02b7,
    0x7b47f409,
    0xba1d3330,
    0x83d2f293,
    0xbfa4784b,
    0xcbed606e,
  ];

  for (let i = 0; i < expected.length; i++) {
    const val = rng.nextU32();
    assert.equal(
      val,
      expected[i],
      `Mismatch at output index ${i}: expected 0x${expected[i].toString(16)}, got 0x${val.toString(16)}`
    );
  }
});

test("PCG32 determinism", () => {
  const rng1 = new Pcg32(12345n, 67890n);
  const rng2 = new Pcg32(12345n, 67890n);
  const rng3 = new Pcg32(12345n, 67891n);

  const seq1 = Array.from({ length: 20 }, () => rng1.nextU32());
  const seq2 = Array.from({ length: 20 }, () => rng2.nextU32());
  const seq3 = Array.from({ length: 20 }, () => rng3.nextU32());

  assert.deepEqual(seq1, seq2);
  assert.notDeepEqual(seq1, seq3);
});

test("PCG32 nextBelow range and coverage over 10000 draws", () => {
  const rng = new Pcg32(999n, 888n);
  const n = 6;
  const counts = new Map<number, number>();

  for (let i = 0; i < 10000; i++) {
    const val = rng.nextBelow(n);
    assert.ok(val >= 0 && val < n, `Value ${val} out of bounds for n=${n}`);
    counts.set(val, (counts.get(val) ?? 0) + 1);
  }

  // All values 0..5 must be covered
  for (let i = 0; i < n; i++) {
    const c = counts.get(i) ?? 0;
    assert.ok(c > 1400 && c < 1950, `Value ${i} count ${c} seems biased`);
  }

  // Edge cases
  assert.equal(rng.nextBelow(1), 0);
  assert.throws(() => rng.nextBelow(0), /range/i);
  assert.throws(() => rng.nextBelow(-5), /range/i);
  assert.throws(() => rng.nextBelow(2 ** 32 + 1), /range/i);
  assert.throws(() => rng.nextBelow(1.5), /integer/i);
});

test("PCG32 shuffle is an in-place deterministic permutation", () => {
  const rng1 = new Pcg32(111n, 222n);
  const rng2 = new Pcg32(111n, 222n);

  const arr1 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const original = [...arr1];
  const ref1 = rng1.shuffle(arr1);
  assert.equal(ref1, arr1, "shuffle must be in place");

  const arr2 = [...original];
  const ref2 = rng2.shuffle(arr2);

  // Determinism
  assert.deepEqual(arr1, arr2);
  // Permutation properties
  assert.equal(arr1.length, original.length);
  assert.deepEqual([...arr1].sort((a, b) => a - b), original);

  // Empty and single-element arrays
  assert.deepEqual(rng1.shuffle([]), []);
  assert.deepEqual(rng1.shuffle([42]), [42]);
});

test("seedStep produces deterministic PRNG from worldSeed, cityId, step", () => {
  const stepRng1 = seedStep("seed-alpha", "city-1", 5);
  const stepRng2 = seedStep("seed-alpha", "city-1", 5);
  const stepRngDiffStep = seedStep("seed-alpha", "city-1", 6);
  const stepRngDiffCity = seedStep("seed-alpha", "city-2", 5);
  const stepRngDiffWorld = seedStep("seed-beta", "city-1", 5);

  const draw1 = Array.from({ length: 10 }, () => stepRng1.nextU32());
  const draw2 = Array.from({ length: 10 }, () => stepRng2.nextU32());
  const drawDiffStep = Array.from({ length: 10 }, () => stepRngDiffStep.nextU32());
  const drawDiffCity = Array.from({ length: 10 }, () => stepRngDiffCity.nextU32());
  const drawDiffWorld = Array.from({ length: 10 }, () => stepRngDiffWorld.nextU32());

  assert.deepEqual(draw1, draw2);
  assert.notDeepEqual(draw1, drawDiffStep);
  assert.notDeepEqual(draw1, drawDiffCity);
  assert.notDeepEqual(draw1, drawDiffWorld);
});
