import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArc } from "../src/arc.ts";
import { genesis } from "../src/genesis.ts";
import { Pcg32 } from "../src/prng.ts";
import {
  businessLeaf,
  sectorRoot,
  cityCore,
  cityRoot,
  eventRoot,
  genesisPrevRoot,
  nextStateRoot,
  sectorProof,
  verifySectorProof,
} from "../src/roots.ts";
import type { CityState, SectorState, Business } from "../src/types.ts";

const CAVE_HOLD_PATH = join(import.meta.dirname, "../../../data/arcs/cave_hold.json");

function createTestState(): CityState {
  const raw = JSON.parse(readFileSync(CAVE_HOLD_PATH, "utf8"));
  const arc = parseArc(raw);
  return genesis(arc, "cave_hold_test", "world_seed_42");
}

test("cityRoot and sectorRoot are stable across two calls (determinism)", () => {
  const state1 = createTestState();
  const state2 = createTestState();

  assert.equal(cityRoot(state1), cityRoot(state2));
  assert.equal(cityCore(state1), cityCore(state2));
  for (let i = 0; i < 6; i++) {
    assert.equal(sectorRoot(state1.sectors[i]), sectorRoot(state2.sectors[i]));
  }
});

test("proof of each of the 6 sectors verifies against cityRoot", () => {
  const state = createTestState();
  const cRoot = cityRoot(state);

  for (let idx = 0; idx < 6; idx++) {
    const sRoot = sectorRoot(state.sectors[idx]);
    const proof = sectorProof(state, idx);
    assert.equal(proof.idx, idx);
    assert.equal(proof.sectorRoots.length, 5);
    const ok = verifySectorProof(sRoot, proof, cRoot);
    assert.equal(ok, true, `Proof for sector ${idx} failed verification`);
  }
});

test("tampered proofs fail verification", () => {
  const state = createTestState();
  const cRoot = cityRoot(state);
  const sRoot0 = sectorRoot(state.sectors[0]);
  const proof0 = sectorProof(state, 0);

  // 1. Tamper sibling
  const tamperedSiblings = [...proof0.sectorRoots] as [string, string, string, string, string];
  tamperedSiblings[0] = "0000000000000000000000000000000000000000000000000000000000000000";
  assert.equal(
    verifySectorProof(sRoot0, { ...proof0, sectorRoots: tamperedSiblings }, cRoot),
    false
  );

  // 2. Tamper core
  const tamperedCore = "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
  assert.equal(
    verifySectorProof(sRoot0, { ...proof0, core: tamperedCore }, cRoot),
    false
  );

  // 3. Tamper claimed sector root
  const tamperedSectorRoot = "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
  assert.equal(verifySectorProof(tamperedSectorRoot, proof0, cRoot), false);

  // 4. Tamper city root
  const tamperedCityRoot = "deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";
  assert.equal(verifySectorProof(sRoot0, proof0, tamperedCityRoot), false);

  // 5. Wrong idx
  assert.equal(verifySectorProof(sRoot0, { ...proof0, idx: 1 }, cRoot), false);

  // 6. Malformed hex
  assert.equal(verifySectorProof("not-hex", proof0, cRoot), false);
  assert.equal(verifySectorProof(sRoot0, { ...proof0, core: "short" }, cRoot), false);
});

test("property-based: changing one business changes exactly its sector root and city root and no other sector root", () => {
  const prng = new Pcg32(987654321n, 12345n);

  for (let trial = 0; trial < 15; trial++) {
    const baseState = createTestState();
    const originalSectorRoots = baseState.sectors.map((s) => sectorRoot(s));
    const originalCityRoot = cityRoot(baseState);

    // Pick a sector with businesses
    const targetSectorIdx = prng.nextBelow(6);
    const sector = baseState.sectors[targetSectorIdx];
    if (sector.businesses.length === 0) continue;

    const bIdx = prng.nextBelow(sector.businesses.length);

    // Deep-clone state for mutation
    const mutatedState: CityState = JSON.parse(
      JSON.stringify(baseState, (_, v) => (typeof v === "bigint" ? `${v.toString()}n` : v)),
      (_, v) => {
        if (typeof v === "string" && /^-?\d+n$/.test(v)) {
          return BigInt(v.slice(0, -1));
        }
        return v;
      }
    );

    // Mutate business coin in mutated state
    mutatedState.sectors[targetSectorIdx].businesses[bIdx].coin += BigInt(trial + 1) * 100n;

    const newSectorRoots = mutatedState.sectors.map((s) => sectorRoot(s));
    const newCityRoot = cityRoot(mutatedState);

    // Assert target sector root changed
    assert.notEqual(
      newSectorRoots[targetSectorIdx],
      originalSectorRoots[targetSectorIdx],
      `Trial ${trial}: Target sector ${targetSectorIdx} root should change`
    );

    // Assert city root changed
    assert.notEqual(
      newCityRoot,
      originalCityRoot,
      `Trial ${trial}: City root should change`
    );

    // Assert every other sector root remains EXACTLY identical
    for (let s = 0; s < 6; s++) {
      if (s !== targetSectorIdx) {
        assert.equal(
          newSectorRoots[s],
          originalSectorRoots[s],
          `Trial ${trial}: Sector ${s} root should NOT change when sector ${targetSectorIdx} business changes`
        );
      }
    }
  }
});

test("property-based: root does not depend on object key insertion order", () => {
  const baseState = createTestState();
  const baseRoot = cityRoot(baseState);

  // Build state with reverse/scrambled key insertion in market and totals
  const priceKeys = Object.keys(baseState.market.price).reverse();
  const scrambledPrice: Record<string, bigint> = {};
  for (const k of priceKeys) {
    scrambledPrice[k] = baseState.market.price[k];
  }

  const reorderedState: CityState = {
    ...baseState,
    market: {
      demand_ema: { ...baseState.market.demand_ema },
      price: scrambledPrice,
    },
  };

  assert.equal(cityRoot(reorderedState), baseRoot);
});

test("eventRoot, genesisPrevRoot, nextStateRoot per section 9", () => {
  const gPrev = genesisPrevRoot("cave_hold", "seed_alpha");
  assert.equal(typeof gPrev, "string");
  assert.equal(gPrev.length, 64);

  const eRootEmpty = eventRoot([]);
  assert.equal(typeof eRootEmpty, "string");
  assert.equal(eRootEmpty.length, 64);

  const eRootWithEvents = eventRoot([
    { event: "step_start", city_id: "cave_hold", step: 0 },
    { event: "step_end", city_id: "cave_hold", step: 0 },
  ]);
  assert.equal(typeof eRootWithEvents, "string");
  assert.equal(eRootWithEvents.length, 64);
  assert.notEqual(eRootWithEvents, eRootEmpty);

  const state = createTestState();
  const cRoot = cityRoot(state);
  const nRoot = nextStateRoot(gPrev, 0, eRootEmpty, cRoot);
  assert.equal(typeof nRoot, "string");
  assert.equal(nRoot.length, 64);

  // Changing step changes nextStateRoot
  const nRootStep1 = nextStateRoot(gPrev, 1, eRootEmpty, cRoot);
  assert.notEqual(nRoot, nRootStep1);
});
