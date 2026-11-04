import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  createWorld,
  advanceWorld,
} from "../src/lib/sim-adapter.ts";
import {
  buildCheckpoints,
  auditCheckpoints,
  tamperCheckpoint,
} from "../src/lib/audit.ts";

describe("Audit Pure Logic (TDD)", () => {
  test("buildCheckpoints records checkpoints every 40 steps", () => {
    let world = createWorld("goblin_warrens", "audit_seed_1");
    assert.deepEqual(buildCheckpoints(world), [], "genesis has 0 checkpoints");

    // Advance 39 steps - still 0 checkpoints
    world = advanceWorld(world, 39);
    assert.deepEqual(buildCheckpoints(world), [], "step 39 has 0 checkpoints");

    // Advance 1 step - reaches step 40, exactly 1 checkpoint
    world = advanceWorld(world, 1);
    const cps40 = buildCheckpoints(world);
    assert.equal(cps40.length, 1, "step 40 has 1 checkpoint");
    assert.equal(cps40[0].from_step, 0);
    assert.equal(cps40[0].to_step, 40);

    // Advance 40 more steps - reaches step 80, 2 checkpoints
    world = advanceWorld(world, 40);
    const cps80 = buildCheckpoints(world);
    assert.equal(cps80.length, 2, "step 80 has 2 checkpoints");
    assert.equal(cps80[1].from_step, 40);
    assert.equal(cps80[1].to_step, 80);
  });

  test("honest checkpoints audit OK", () => {
    let world = createWorld("goblin_warrens", "audit_seed_2");
    world = advanceWorld(world, 80);
    const checkpoints = buildCheckpoints(world);
    assert.equal(checkpoints.length, 2);

    const result = auditCheckpoints({
      arcId: "goblin_warrens",
      seed: "audit_seed_2",
      cityId: checkpoints[0].city_id,
      checkpoints,
    });

    assert.equal(result.ok, true);
    assert.equal(result.lines.length, 2);
    assert.equal(result.lines[0].status, "OK");
    assert.equal(result.lines[1].status, "OK");
    assert.match(result.summary, /^VERIFIED: 2 checkpoints match the replay/);
  });

  test("replay with different seed fails audit", () => {
    let world = createWorld("goblin_warrens", "audit_seed_3");
    world = advanceWorld(world, 40);
    const checkpoints = buildCheckpoints(world);

    const result = auditCheckpoints({
      arcId: "goblin_warrens",
      seed: "wrong_seed_here",
      cityId: checkpoints[0].city_id,
      checkpoints,
    });

    assert.equal(result.ok, false);
    assert.equal(result.lines.some((l) => l.status === "MISMATCH"), true);
    assert.match(result.summary, /^FAILED:/);
  });

  test("tamperCheckpoint 'produced+1' fails with produced amount mismatch", () => {
    let world = createWorld("goblin_warrens", "audit_seed_4");
    world = advanceWorld(world, 40);
    const [cp] = buildCheckpoints(world);

    const tampered = tamperCheckpoint(cp, "produced+1");
    const result = auditCheckpoints({
      arcId: "goblin_warrens",
      seed: "audit_seed_4",
      cityId: cp.city_id,
      checkpoints: [tampered],
    });

    assert.equal(result.ok, false);
    assert.match(result.summary, /produced amount mismatch/);
  });

  test("tamperCheckpoint 'state_root' fails with new_state_root mismatch", () => {
    let world = createWorld("goblin_warrens", "audit_seed_5");
    world = advanceWorld(world, 40);
    const [cp] = buildCheckpoints(world);

    const tampered = tamperCheckpoint(cp, "state_root");
    const result = auditCheckpoints({
      arcId: "goblin_warrens",
      seed: "audit_seed_5",
      cityId: cp.city_id,
      checkpoints: [tampered],
    });

    assert.equal(result.ok, false);
    assert.match(result.summary, /new_state_root mismatch at step 40/);
  });

  test("tamperCheckpoint 'stage' fails with stage mismatch", () => {
    let world = createWorld("goblin_warrens", "audit_seed_6");
    world = advanceWorld(world, 40);
    const [cp] = buildCheckpoints(world);

    const tampered = tamperCheckpoint(cp, "stage");
    const result = auditCheckpoints({
      arcId: "goblin_warrens",
      seed: "audit_seed_6",
      cityId: cp.city_id,
      checkpoints: [tampered],
    });

    assert.equal(result.ok, false);
    assert.match(result.summary, /stage mismatch at step 40/);
  });

  test("determinism: repeated audit runs yield identical output", () => {
    let world = createWorld("goblin_warrens", "audit_seed_7");
    world = advanceWorld(world, 80);
    const checkpoints = buildCheckpoints(world);

    const res1 = auditCheckpoints({
      arcId: "goblin_warrens",
      seed: "audit_seed_7",
      checkpoints,
    });
    const res2 = auditCheckpoints({
      arcId: "goblin_warrens",
      seed: "audit_seed_7",
      checkpoints,
    });

    assert.deepEqual(res1, res2);
  });

  test("reset behavior of checkpoint recorder across seed and arc changes", () => {
    let world = createWorld("goblin_warrens", "audit_seed_8");
    world = advanceWorld(world, 40);
    assert.equal(buildCheckpoints(world).length, 1);
    assert.equal(buildCheckpoints(world)[0].to_step, 40);

    // 1. Reset world with same seed
    const resetSame = createWorld("goblin_warrens", "audit_seed_8");
    assert.equal(buildCheckpoints(resetSame).length, 0);

    // 2. Reset world with new seed
    const resetNewSeed = createWorld("goblin_warrens", "different_seed_9");
    assert.equal(buildCheckpoints(resetNewSeed).length, 0);

    // 3. Reset world with new arc
    const resetNewArc = createWorld("cave_hold", "audit_seed_8");
    assert.equal(buildCheckpoints(resetNewArc).length, 0);

    // 4. Advancing after reset accumulates new checkpoints cleanly from step 0
    const advancedAfterReset = advanceWorld(resetNewSeed, 40);
    const cpsAfterReset = buildCheckpoints(advancedAfterReset);
    assert.equal(cpsAfterReset.length, 1);
    assert.equal(cpsAfterReset[0].from_step, 0);
    assert.equal(cpsAfterReset[0].to_step, 40);
    assert.equal(advancedAfterReset.seed, "different_seed_9");
  });
});
