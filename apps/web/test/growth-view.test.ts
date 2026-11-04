import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeGrowthView,
  createReplaySnapshotStore,
  type GrowthInput,
  type GrowthViewResult,
} from "../src/lib/iso/growth-view.ts";
import { generateTerrain } from "../src/lib/iso/terrain.ts";
import { layoutCity } from "../src/lib/iso/layout.ts";
import { MOCK_CITY } from "../src/data/mock-city.ts";

describe("City Growth Model (TDD) - Item 1", () => {
  const terrain = generateTerrain("goblin_seed_0", "goblin_warrens", 40);
  const testCity = { ...MOCK_CITY, stateRoot: "0xgenesis_state_root" };
  const layout = layoutCity(terrain, testCity);

  const baseInput: GrowthInput = {
    arcId: "goblin_warrens",
    stageId: "hamlet",
    stageIndex: 0,
    year: 5,
    step: 20,
    population: 80,
    businesses: [
      { id: "b1", sectorIdx: 0, open: true, insolvent: false },
      { id: "b2", sectorIdx: 1, open: true, insolvent: false },
      { id: "b3", sectorIdx: 2, open: false, insolvent: true },
    ],
    roads: layout.roads,
    buildings: layout.buildings,
    houses: layout.houses,
    plaza: layout.plaza,
  };

  it("determinism: identical inputs yield identical growth view", () => {
    const v1 = computeGrowthView(baseInput);
    const v2 = computeGrowthView(baseInput);

    assert.equal(v1.builtRoads.length, v2.builtRoads.length);
    assert.deepEqual(
      v1.builtRoads.map((r) => `${r.x},${r.y}`),
      v2.builtRoads.map((r) => `${r.x},${r.y}`)
    );
    assert.deepEqual(v1.buildingSlots, v2.buildingSlots);
    assert.equal(v1.citizenCount, v2.citizenCount);
    assert.deepEqual(v1.citizenPositions, v2.citizenPositions);
    assert.equal(v1.agingLevel, v2.agingLevel);
  });

  it("monotonicity: road network expands as city ages and population grows", () => {
    const step1: GrowthInput = {
      ...baseInput,
      year: 10,
      step: 40,
      stageIndex: 0,
      stageId: "hamlet",
      population: 80,
    };
    const step2: GrowthInput = {
      ...baseInput,
      year: 80,
      step: 320,
      stageIndex: 1,
      stageId: "village",
      population: 150,
    };
    const step3: GrowthInput = {
      ...baseInput,
      year: 300,
      step: 1200,
      stageIndex: 2,
      stageId: "town",
      population: 320,
    };

    const g1 = computeGrowthView(step1);
    const g2 = computeGrowthView(step2);
    const g3 = computeGrowthView(step3);

    assert.ok(g1.builtRoads.length <= g2.builtRoads.length);
    assert.ok(g2.builtRoads.length <= g3.builtRoads.length);

    // Every road built in step1 must also be in step2
    const set2 = new Set(g2.builtRoads.map((r) => `${r.x},${r.y}`));
    for (const r of g1.builtRoads) {
      assert.ok(set2.has(`${r.x},${r.y}`), `Road at ${r.x},${r.y} missing in step2`);
    }

    // Every road built in step2 must also be in step3
    const set3 = new Set(g3.builtRoads.map((r) => `${r.x},${r.y}`));
    for (const r of g2.builtRoads) {
      assert.ok(set3.has(`${r.x},${r.y}`), `Road at ${r.x},${r.y} missing in step3`);
    }
  });

  it("stability across scrub order: scrubbing forward and backward gives exact same result", () => {
    const steps = [10, 50, 150, 400, 1000, 150, 50, 10];
    const viewsByYear = new Map<number, GrowthViewResult>();

    for (const yr of steps) {
      const input: GrowthInput = {
        ...baseInput,
        year: yr,
        step: yr * 4,
        stageIndex: yr < 40 ? 0 : yr < 200 ? 1 : 2,
        population: Math.min(330, 80 + yr),
      };
      const v = computeGrowthView(input);
      if (viewsByYear.has(yr)) {
        const prev = viewsByYear.get(yr)!;
        assert.deepEqual(
          v.builtRoads.map((r) => `${r.x},${r.y}`),
          prev.builtRoads.map((r) => `${r.x},${r.y}`)
        );
        assert.equal(v.citizenCount, prev.citizenCount);
        assert.equal(v.agingLevel, prev.agingLevel);
      } else {
        viewsByYear.set(yr, v);
      }
    }
  });

  it("citizen sprite count scales with population and is capped at 60", () => {
    const small = computeGrowthView({ ...baseInput, population: 40 });
    const mid = computeGrowthView({ ...baseInput, population: 200 });
    const huge = computeGrowthView({ ...baseInput, population: 1200 });

    assert.ok(small.citizenCount >= 2 && small.citizenCount <= 6);
    assert.ok(mid.citizenCount >= 15 && mid.citizenCount <= 25);
    assert.equal(huge.citizenCount, 60, "Must be capped at 60 citizens");
    assert.equal(huge.citizenPositions.length, 60);

    // All citizens are on road coordinates
    const roadSet = new Set(huge.builtRoads.map((r) => `${r.x},${r.y}`));
    for (const pos of huge.citizenPositions) {
      assert.ok(roadSet.has(`${pos.x},${pos.y}`), `Citizen at non-road ${pos.x},${pos.y}`);
    }
  });

  it("building tiers progress from 0 up to 3 based on stage and age", () => {
    const hamlet = computeGrowthView({ ...baseInput, stageIndex: 0, year: 10 });
    const town = computeGrowthView({ ...baseInput, stageIndex: 2, year: 250 });
    const metropolis = computeGrowthView({ ...baseInput, stageIndex: 4, year: 800 });

    assert.ok(hamlet.buildingSlots.every((b) => b.tier <= 1));
    assert.ok(town.buildingSlots.some((b) => b.tier >= 1));
    assert.ok(metropolis.buildingSlots.some((b) => b.tier >= 3));
  });

  it("aging level tracks centuries for visual progression during 2500-year plateau", () => {
    const y50 = computeGrowthView({ ...baseInput, year: 50 });
    const y500 = computeGrowthView({ ...baseInput, year: 500 });
    const y1500 = computeGrowthView({ ...baseInput, year: 1500 });
    const y2500 = computeGrowthView({ ...baseInput, year: 2500 });

    assert.equal(y50.century, 0);
    assert.equal(y500.century, 5);
    assert.equal(y1500.century, 15);
    assert.equal(y2500.century, 25);

    assert.ok(y50.agingLevel <= y500.agingLevel);
    assert.ok(y500.agingLevel <= y1500.agingLevel);
    assert.ok(y2500.agingLevel >= 3);
  });

  it("snapshot store: extends replay range to 10000 steps with 40-step snapshots", () => {
    const store = createReplaySnapshotStore("goblin_warrens", "goblin_seed_0");
    // Verify initial state
    const genesisSnap = store.getSnapshotAtOrBefore(0);
    assert.ok(genesisSnap);
    assert.equal(genesisSnap.step, 0);

    // Replay small sample up to step 120 (3 snapshots: 40, 80, 120)
    store.ensureStep(120);
    const snap120 = store.getSnapshotAtOrBefore(120);
    assert.ok(snap120);
    assert.equal(snap120.step, 120);

    // Check intermediate scrub step 105 recovers nearest snapshot 80
    const snapNear = store.getSnapshotAtOrBefore(105);
    assert.equal(snapNear.step, 80);

    // Maximum step capacity is 10000
    assert.equal(store.maxStep, 10000);
  });
});
