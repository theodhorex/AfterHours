import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { parseArc } from "../../sim/src/arc.ts";
import { genesis } from "../../sim/src/genesis.ts";
import { parsePricingRules } from "../../sim/src/pricing.ts";
import { parseGrowthRules } from "../../sim/src/growth.ts";
import { step } from "../../sim/src/step.ts";
import { cityRoot, nextStateRoot, eventRoot, genesisPrevRoot } from "../../sim/src/roots.ts";
import { buildCheckpoint } from "../../sim/src/checkpoint.ts";
import { verifyCheckpoints, computeRulesHash } from "../src/verify.ts";
import type { Checkpoint } from "../../sim/src/checkpoint.ts";
import type { SimEvent } from "../../sim/src/types.ts";

const root = process.cwd();
const pricing = parsePricingRules(readFileSync(join(root, "data/pricing.rules.json"), "utf-8"));
const growth = parseGrowthRules(JSON.parse(readFileSync(join(root, "data/growth.rules.json"), "utf-8")));
const arc = parseArc(JSON.parse(readFileSync(join(root, "data/arcs/goblin_warrens.json"), "utf-8")));

function generateHonestCheckpoints(numWindows = 3, windowSize = 20): Checkpoint[] {
  let currState = genesis(arc, "city-verify-test", "seed-verify");
  let currPrevRoot = genesisPrevRoot(currState.city_id, currState.world_seed);
  const ctx = { arc, pricing, growth };
  const checkpoints: Checkpoint[] = [];

  for (let w = 0; w < numWindows; w++) {
    const windowPrevState = currState;
    const windowEvents: SimEvent[] = [];
    let lastStateRoot = currPrevRoot;

    for (let s = 0; s < windowSize; s++) {
      const res = step(currState, ctx);
      currState = res.state;
      windowEvents.push(...res.events);

      const eRoot = eventRoot(res.events);
      const cRoot = cityRoot(currState);
      lastStateRoot = nextStateRoot(currPrevRoot, currState.step, eRoot, cRoot);
      currPrevRoot = lastStateRoot;
    }

    const cp = buildCheckpoint({
      prev: windowPrevState,
      next: currState,
      events: windowEvents,
      stateRoot: lastStateRoot,
    });
    checkpoints.push(cp);
  }

  return checkpoints;
}

test("verifyCheckpoints: honest checkpoints verify successfully", () => {
  const checkpoints = generateHonestCheckpoints(3, 20);
  const result = verifyCheckpoints({
    arcId: "goblin_warrens",
    seed: "seed-verify",
    cityId: "city-verify-test",
    checkpoints,
  });

  assert.equal(result.success, true);
  assert.equal(result.count, 3);
  assert.deepEqual(result.lines, ["OK", "OK", "OK"]);
  assert.equal(result.finalLine, "VERIFIED: 3 checkpoints match the replay");
});

test("verifyCheckpoints: tampered new_state_root fails with clear message", () => {
  const checkpoints = generateHonestCheckpoints(3, 20);
  checkpoints[1].new_state_root = "0".repeat(64);

  const result = verifyCheckpoints({
    arcId: "goblin_warrens",
    seed: "seed-verify",
    cityId: "city-verify-test",
    checkpoints,
  });

  assert.equal(result.success, false);
  assert.equal(result.lines[0], "OK");
  assert.equal(result.lines[1], "MISMATCH");
  assert.match(result.finalLine, /^FAILED:.*new_state_root/);
  assert.match(result.finalLine, /step 40/);
});

test("verifyCheckpoints: tampered produced amount fails with clear message", () => {
  const checkpoints = generateHonestCheckpoints(3, 20);
  const firstItem = Object.keys(checkpoints[0].items)[0];
  const orig = BigInt(checkpoints[0].items[firstItem].produced);
  checkpoints[0].items[firstItem].produced = (orig + 999n).toString();

  const result = verifyCheckpoints({
    arcId: "goblin_warrens",
    seed: "seed-verify",
    cityId: "city-verify-test",
    checkpoints,
  });

  assert.equal(result.success, false);
  assert.equal(result.lines[0], "MISMATCH");
  assert.match(result.finalLine, /^FAILED:.*produced/);
  assert.match(result.finalLine, /step 20/);
});

test("verifyCheckpoints: tampered stage fails with clear message", () => {
  const checkpoints = generateHonestCheckpoints(3, 20);
  checkpoints[0].stage = 99;

  const result = verifyCheckpoints({
    arcId: "goblin_warrens",
    seed: "seed-verify",
    cityId: "city-verify-test",
    checkpoints,
  });

  assert.equal(result.success, false);
  assert.equal(result.lines[0], "MISMATCH");
  assert.match(result.finalLine, /^FAILED:.*stage/);
  assert.match(result.finalLine, /step 20/);
});

test("verifyCheckpoints: wrong seed fails replay verification", () => {
  const checkpoints = generateHonestCheckpoints(3, 20);

  const result = verifyCheckpoints({
    arcId: "goblin_warrens",
    seed: "wrong-seed-value",
    cityId: "city-verify-test",
    checkpoints,
  });

  assert.equal(result.success, false);
  assert.equal(result.lines[0], "MISMATCH");
  assert.match(result.finalLine, /^FAILED:/);
});

test("verifyCheckpoints: missing window fails with clear message", () => {
  const checkpoints = generateHonestCheckpoints(3, 20);
  // Remove the middle window (index 1: steps 20..40)
  const sliced = [checkpoints[0], checkpoints[2]];

  const result = verifyCheckpoints({
    arcId: "goblin_warrens",
    seed: "seed-verify",
    cityId: "city-verify-test",
    checkpoints: sliced,
  });

  assert.equal(result.success, false);
  assert.equal(result.lines[0], "OK");
  assert.equal(result.lines[1], "MISMATCH");
  assert.match(result.finalLine, /^FAILED:.*missing window/);
  assert.match(result.finalLine, /expected from_step 20/);
});

test("CLI: honest checkpoints exit 0 and print VERIFIED", () => {
  const tmpDir = join(root, "demo", "test_tmp");
  mkdirSync(tmpDir, { recursive: true });
  const cpFile = join(tmpDir, "honest_cp.json");
  const checkpoints = generateHonestCheckpoints(2, 20);
  writeFileSync(cpFile, JSON.stringify(checkpoints, null, 2), "utf-8");

  const run = spawnSync(
    "node",
    [
      "packages/verify/cli.ts",
      "--arc",
      "goblin_warrens",
      "--seed",
      "seed-verify",
      "--city",
      "city-verify-test",
      "--checkpoints",
      cpFile,
    ],
    { encoding: "utf-8" }
  );

  rmSync(tmpDir, { recursive: true, force: true });

  assert.equal(run.status, 0, `stderr: ${run.stderr}`);
  assert.match(run.stdout, /OK/);
  assert.match(run.stdout, /VERIFIED: 2 checkpoints match the replay/);
});

test("CLI: tampered checkpoint exits 1 and prints FAILED", () => {
  const tmpDir = join(root, "demo", "test_tmp");
  mkdirSync(tmpDir, { recursive: true });
  const cpFile = join(tmpDir, "tampered_cp.json");
  const checkpoints = generateHonestCheckpoints(2, 20);
  checkpoints[0].new_state_root = "f".repeat(64);
  writeFileSync(cpFile, JSON.stringify(checkpoints, null, 2), "utf-8");

  const run = spawnSync(
    "node",
    [
      "packages/verify/cli.ts",
      "--arc",
      "goblin_warrens",
      "--seed",
      "seed-verify",
      "--city",
      "city-verify-test",
      "--checkpoints",
      cpFile,
    ],
    { encoding: "utf-8" }
  );

  rmSync(tmpDir, { recursive: true, force: true });

  assert.equal(run.status, 1);
  assert.match(run.stdout, /MISMATCH/);
  assert.match(run.stdout, /FAILED:/);
});

test("CLI: --rules-hash prints sha256 hashes and exits 0", () => {
  const run = spawnSync(
    "node",
    ["packages/verify/cli.ts", "--rules-hash", "--arc", "goblin_warrens"],
    { encoding: "utf-8" }
  );

  assert.equal(run.status, 0, `stderr: ${run.stderr}`);
  assert.match(run.stdout, /pricing:/);
  assert.match(run.stdout, /growth:/);
  assert.match(run.stdout, /arc:/);
  assert.match(run.stdout, /rules_hash:/);
});
