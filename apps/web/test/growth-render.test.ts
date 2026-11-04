import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeGrowthView,
  createReplaySnapshotStore,
  type GrowthInput,
} from "../src/lib/iso/growth-view.ts";
import {
  getCenturyMonumentSpec,
  formatAgeStats,
  generateLiveRegionText,
} from "../src/lib/iso/growth-render-pure.ts";
import { generateTerrain } from "../src/lib/iso/terrain.ts";
import { layoutCity } from "../src/lib/iso/layout.ts";
import { MOCK_CITY } from "../src/data/mock-city.ts";

describe("City Growth Render Pure Logic (TDD) - Item 2 & 3", () => {
  const arcs = ["goblin_warrens", "cave_hold", "dino_vale", "elf_grove"] as const;

  it("growth view works across all 4 arcs and produces deterministic monotonic roads", () => {
    for (const arcId of arcs) {
      const terrain = generateTerrain(`${arcId}_seed`, arcId, 40);
      const city = { ...MOCK_CITY, arc_id: arcId, stateRoot: "0xroot" };
      const layout = layoutCity(terrain, city);

      const inputEarly: GrowthInput = {
        arcId,
        stageIndex: 0,
        year: 10,
        population: 80,
        businesses: [{ id: "b1", sectorIdx: 0, open: true }],
        roads: layout.roads,
        buildings: layout.buildings,
        houses: layout.houses,
        plaza: layout.plaza,
      };

      const inputLate: GrowthInput = {
        arcId,
        stageIndex: 2,
        year: 500,
        population: 330,
        businesses: [{ id: "b1", sectorIdx: 0, open: true }],
        roads: layout.roads,
        buildings: layout.buildings,
        houses: layout.houses,
        plaza: layout.plaza,
      };

      const viewEarly = computeGrowthView(inputEarly);
      const viewLate = computeGrowthView(inputLate);

      assert.ok(viewEarly.builtRoads.length <= viewLate.builtRoads.length);
      assert.ok(viewEarly.builtRoads.length >= 12);
      assert.ok(viewLate.builtRoads.length <= layout.roads.length);

      // Monotonicity: every road in early is in late
      const lateSet = new Set(viewLate.builtRoads.map((r) => `${r.x},${r.y}`));
      for (const r of viewEarly.builtRoads) {
        assert.ok(lateSet.has(`${r.x},${r.y}`), `Arc ${arcId}: early road missing in late`);
      }
    }
  });

  it("century aging monument specs advance deterministically by century", () => {
    const m0 = getCenturyMonumentSpec(0, "goblin_warrens");
    assert.equal(m0.agingLevel, 0);
    assert.equal(m0.kind, "well");

    const m5 = getCenturyMonumentSpec(5, "goblin_warrens");
    assert.equal(m5.agingLevel, 1);
    assert.equal(m5.kind, "cistern");

    const m12 = getCenturyMonumentSpec(12, "goblin_warrens");
    assert.equal(m12.agingLevel, 2);
    assert.equal(m12.kind, "statue");

    const m18 = getCenturyMonumentSpec(18, "goblin_warrens");
    assert.equal(m18.agingLevel, 3);
    assert.equal(m18.kind, "obelisk");

    const m24 = getCenturyMonumentSpec(24, "goblin_warrens");
    assert.equal(m24.agingLevel, 4);
    assert.equal(m24.kind, "relic_monolith");
    assert.ok(m24.hasRunicGlow);
  });

  it("formatAgeStats formats compact age and status metrics cleanly", () => {
    const stats = formatAgeStats({
      year: 120,
      season: 1,
      stageName: "Town",
      population: 310,
      openBiz: 11,
      totalBiz: 12,
      satisfaction: 92,
      patinaName: "Light Weathered Moss",
    });

    assert.equal(stats.yearLabel, "Year 120 of 2500");
    assert.equal(stats.seasonName, "Summer");
    assert.equal(stats.stageName, "Town");
    assert.equal(stats.popLabel, "310");
    assert.equal(stats.bizLabel, "11 / 12");
    assert.equal(stats.satisfactionLabel, "92%");
    assert.equal(stats.patinaName, "Light Weathered Moss");
  });

  it("generateLiveRegionText announces stage upgrades and milestone summaries for screen readers", () => {
    // Stage upgrade announcement
    const textUpgrade = generateLiveRegionText({
      cityName: "Goblin Warrens",
      year: 120,
      stageName: "Town",
      prevStageName: "Village",
      population: 310,
      openBiz: 11,
    });
    assert.match(textUpgrade, /Year 120: Goblin Warrens reached Town/i);

    // Normal scrub update
    const textNormal = generateLiveRegionText({
      cityName: "Goblin Warrens",
      year: 50,
      stageName: "Village",
      prevStageName: "Village",
      population: 180,
      openBiz: 8,
    });
    assert.match(textNormal, /Year 50: Village, 180 citizens, 8 open businesses/i);
  });

  it("replay snapshot store covers 10000 steps deterministically", () => {
    const store = createReplaySnapshotStore("goblin_warrens", "goblin_seed_0");
    assert.equal(store.maxStep, 10000);

    const s0 = store.getStateAtStep(0);
    assert.equal(s0.state.step, 0);

    const s40 = store.getStateAtStep(40);
    assert.equal(s40.state.step, 40);

    // Scrub back to 0
    const s0Again = store.getStateAtStep(0);
    assert.equal(s0Again.state.step, 0);
    assert.equal(s0Again.stateRoot, s0.stateRoot);
  });
});
