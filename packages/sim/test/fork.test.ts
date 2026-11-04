import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArc } from "../src/arc.ts";
import { genesis } from "../src/genesis.ts";
import { parsePricingRules } from "../src/pricing.ts";
import { parseGrowthRules } from "../src/growth.ts";
import { runSteps } from "../src/run.ts";
import { forkCity, forkPrevRoot, verifyFork } from "../src/fork.ts";
import { checkConservation, buildCheckpoint } from "../src/checkpoint.ts";

const CAVE_HOLD_PATH = join(import.meta.dirname, "../../../data/arcs/cave_hold.json");
const PRICING_PATH = join(import.meta.dirname, "../../../data/pricing.rules.json");
const GROWTH_PATH = join(import.meta.dirname, "../../../data/growth.rules.json");

function loadContext() {
  const arc = parseArc(JSON.parse(readFileSync(CAVE_HOLD_PATH, "utf8")));
  const pricing = parsePricingRules(JSON.parse(readFileSync(PRICING_PATH, "utf8")));
  const growth = parseGrowthRules(JSON.parse(readFileSync(GROWTH_PATH, "utf8")));
  return { arc, pricing, growth };
}

test("forkPrevRoot returns 64-char hex leaf hash of fork_of and city_id", () => {
  const parentRoot = "1111111111111111111111111111111111111111111111111111111111111111";
  const prev1 = forkPrevRoot(parentRoot, "fork_city_a");
  const prev2 = forkPrevRoot(parentRoot, "fork_city_a");
  const prev3 = forkPrevRoot(parentRoot, "fork_city_b");

  assert.equal(prev1.length, 64);
  assert.equal(/^[0-9a-f]{64}$/.test(prev1), true);
  assert.equal(prev1, prev2);
  assert.notEqual(prev1, prev3);
});

test("forkCity produces deep copy with new city_id, kept step, and correct prevRoot without mutating parent", () => {
  const ctx = loadContext();
  const state0 = genesis(ctx.arc, "parent_city", "seed_1");
  const parentRun = runSteps(state0, 10, ctx);
  const parentRoot = parentRun.roots[parentRun.roots.length - 1];

  // Snapshot parent state JSON for mutation check
  const parentSnapshot = JSON.stringify(parentRun.state, (_, v) =>
    typeof v === "bigint" ? v.toString() : v
  );

  const forked = forkCity(parentRun.state, "child_city", parentRoot);

  // 1. New city_id
  assert.equal(forked.state.city_id, "child_city");
  assert.equal(forked.prevRoot, forkPrevRoot(parentRoot, "child_city"));

  // 2. Step is kept
  assert.equal(forked.state.step, parentRun.state.step);

  // 3. Totals stay consistent
  assert.deepEqual(forked.state.totals, parentRun.state.totals);

  // 4. Business IDs and inventories are copied
  for (let s = 0; s < 6; s++) {
    assert.equal(forked.state.sectors[s].businesses.length, parentRun.state.sectors[s].businesses.length);
    for (let b = 0; b < forked.state.sectors[s].businesses.length; b++) {
      const orig = parentRun.state.sectors[s].businesses[b];
      const copy = forked.state.sectors[s].businesses[b];
      assert.equal(copy.id, orig.id);
      assert.equal(copy.recipe, orig.recipe);
      assert.equal(copy.open, orig.open);
      assert.equal(copy.coin, orig.coin);
      assert.deepEqual(copy.inventory, orig.inventory);
    }
  }

  // 5. Parent state is not mutated when forked state is mutated
  forked.state.sectors[0].businesses[0].coin += 9999n;
  forked.state.sectors[0].businesses[0].inventory.grain = 12345n;
  forked.state.citizens.purse += 500n;

  const currentParentSnapshot = JSON.stringify(parentRun.state, (_, v) =>
    typeof v === "bigint" ? v.toString() : v
  );
  assert.equal(currentParentSnapshot, parentSnapshot);
});

test("two forks of same checkpoint with SAME new id produce identical roots", () => {
  const ctx = loadContext();
  const state0 = genesis(ctx.arc, "parent_city", "seed_1");
  const parentRun = runSteps(state0, 20, ctx);
  const parentRoot = parentRun.roots[parentRun.roots.length - 1];

  const fork1 = forkCity(parentRun.state, "identical_fork", parentRoot);
  const fork2 = forkCity(parentRun.state, "identical_fork", parentRoot);

  const run1 = runSteps(fork1.state, 15, ctx, fork1.prevRoot);
  const run2 = runSteps(fork2.state, 15, ctx, fork2.prevRoot);

  assert.deepEqual(run1.roots, run2.roots);
  assert.deepEqual(run1.state.totals, run2.state.totals);
});

test("different new city ids diverge because step PRNG is seeded from city_id", () => {
  const ctx = loadContext();
  const state0 = genesis(ctx.arc, "parent_city", "seed_1");
  const parentRun = runSteps(state0, 20, ctx);
  const parentRoot = parentRun.roots[parentRun.roots.length - 1];

  const forkA = forkCity(parentRun.state, "fork_branch_a", parentRoot);
  const forkB = forkCity(parentRun.state, "fork_branch_b", parentRoot);

  const runA = runSteps(forkA.state, 20, ctx, forkA.prevRoot);
  const runB = runSteps(forkB.state, 20, ctx, forkB.prevRoot);

  // prevRoots differ
  assert.notEqual(forkA.prevRoot, forkB.prevRoot);
  // Roots diverge
  assert.notEqual(runA.roots[0], runB.roots[0]);
  assert.notEqual(runA.roots[runA.roots.length - 1], runB.roots[runB.roots.length - 1]);
});

test("fork at step 80 then 40 more steps conserves items and coin and matches second identical fork", () => {
  const ctx = loadContext();
  const state0 = genesis(ctx.arc, "parent_city", "seed_1");
  const parentRun = runSteps(state0, 80, ctx);
  const parentRoot = parentRun.roots[parentRun.roots.length - 1];

  const fork1 = forkCity(parentRun.state, "fork_80", parentRoot);
  const fork2 = forkCity(parentRun.state, "fork_80", parentRoot);

  const run1 = runSteps(fork1.state, 40, ctx, fork1.prevRoot);
  const run2 = runSteps(fork2.state, 40, ctx, fork2.prevRoot);

  // Exactly identical roots and state
  assert.deepEqual(run1.roots, run2.roots);
  assert.equal(run1.state.step, 120);
  assert.equal(run2.state.step, 120);

  // Conservation check over the 40 steps of fork
  const cp = buildCheckpoint({
    prev: fork1.state,
    next: run1.state,
    events: run1.events,
    stateRoot: run1.roots[run1.roots.length - 1],
  });
  const recomputedTotals = checkConservation(fork1.state.totals, cp);

  for (const item of ctx.arc.items) {
    assert.equal(
      recomputedTotals.items[item.id] ?? 0n,
      run1.state.totals.items[item.id] ?? 0n,
      `Item ${item.id} conserved in fork`
    );
  }
  assert.equal(recomputedTotals.coin, run1.state.totals.coin, "Coin conserved in fork");
});

test("verifyFork recomputes first state root of fork from parent root", () => {
  const ctx = loadContext();
  const state0 = genesis(ctx.arc, "parent_city", "seed_1");
  const parentRun = runSteps(state0, 10, ctx);
  const parentRoot = parentRun.roots[parentRun.roots.length - 1];

  const forked = forkCity(parentRun.state, "verify_fork_city", parentRoot);
  const run = runSteps(forked.state, 1, ctx, forked.prevRoot);
  const firstForkRoot = run.roots[0];

  // Verification succeeds with honest root and events
  const ok = verifyFork(parentRoot, firstForkRoot, run.state, run.events);
  assert.equal(ok, true);

  // Tampered parent root fails
  assert.equal(
    verifyFork("0".repeat(64), firstForkRoot, run.state, run.events),
    false
  );

  // Tampered fork root fails
  assert.equal(
    verifyFork(parentRoot, "f".repeat(64), run.state, run.events),
    false
  );
});
