import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isoToScreen, screenToIso, screenToTile, depthSortKey } from "../src/lib/iso/iso-math.ts";
import { generateTerrain } from "../src/lib/iso/terrain.ts";
import { layoutCity } from "../src/lib/iso/layout.ts";
import { MOCK_CITY } from "../src/data/mock-city.ts";
import type { CityView } from "../src/lib/sim-view.ts";

const mockView: CityView = {
  ...MOCK_CITY,
  stateRoot: "0x1234567890abcdef",
};

describe("Isometric City Logic", () => {
  it("iso round trip: screenToIso(isoToScreen(x, y)) returns original coords", () => {
    const testCoords = [
      { x: 0, y: 0 },
      { x: 10, y: 15 },
      { x: 24, y: 24 },
      { x: 47, y: 2 },
    ];
    for (const { x, y } of testCoords) {
      const screen = isoToScreen(x, y);
      const iso = screenToIso(screen.x, screen.y);
      assert.ok(Math.abs(iso.x - x) < 1e-6, `x roundtrip mismatch: ${iso.x} vs ${x}`);
      assert.ok(Math.abs(iso.y - y) < 1e-6, `y roundtrip mismatch: ${iso.y} vs ${y}`);
      const tile = screenToTile(screen.x + 32, screen.y + 16);
      // center offset point hit test
      assert.equal(typeof tile.x, "number");
      assert.equal(typeof tile.y, "number");
    }
  });

  it("depth order: depthSortKey orders by isometric row and elevation/layer", () => {
    const k1 = depthSortKey(10, 10, 0);
    const k2 = depthSortKey(10, 11, 0);
    const k3 = depthSortKey(10, 10, 1);
    assert.ok(k2 > k1, "Tile with greater (x+y) should have higher depth sort key");
    assert.ok(k3 > k1, "Higher elevation on same tile should have higher depth sort key");
  });

  it("terrain determinism: same seed produces same grid, different seed differs", () => {
    const t1 = generateTerrain("seed_alpha", "goblin_warrens", 48);
    const t2 = generateTerrain("seed_alpha", "goblin_warrens", 48);
    const t3 = generateTerrain("seed_beta", "goblin_warrens", 48);

    assert.equal(t1.size, 48);
    assert.equal(t2.size, 48);

    // Deep equality for t1 and t2
    for (let y = 0; y < 48; y++) {
      for (let x = 0; x < 48; x++) {
        assert.equal(t1.tiles[y][x], t2.tiles[y][x], `Mismatch at ${x},${y}`);
      }
    }

    // Differences for t3 vs t1
    let diffCount = 0;
    for (let y = 0; y < 48; y++) {
      for (let x = 0; x < 48; x++) {
        if (t1.tiles[y][x] !== t3.tiles[y][x]) {
          diffCount++;
        }
      }
    }
    assert.ok(diffCount > 50, "Different seed should produce noticeably different terrain");
  });

  it("all four arcs produce water + land", () => {
    const arcs = ["goblin_warrens", "cave_hold", "dino_vale", "elf_grove"];
    for (const arc of arcs) {
      const terrain = generateTerrain("test_seed", arc, 48);
      let waterCount = 0;
      let landCount = 0;
      for (let y = 0; y < 48; y++) {
        for (let x = 0; x < 48; x++) {
          const kind = terrain.tiles[y][x];
          if (kind === "water") waterCount++;
          else landCount++;
        }
      }
      assert.ok(waterCount > 0, `Arc ${arc} has no water`);
      assert.ok(landCount > 0, `Arc ${arc} has no land`);
    }
  });

  it("all businesses placed on distinct land tiles, none on water", () => {
    const terrain = generateTerrain("layout_seed_1", "goblin_warrens", 48);
    const layout = layoutCity(terrain, mockView);

    const totalBiz = mockView.sectors.reduce((sum, s) => sum + s.businesses.length, 0);
    assert.equal(layout.buildings.length, totalBiz, "All businesses should be placed");

    const occupied = new Set<string>();
    for (const b of layout.buildings) {
      const key = `${b.tileX},${b.tileY}`;
      assert.ok(!occupied.has(key), `Duplicate tile placement at ${key} for ${b.id}`);
      occupied.add(key);

      const tileKind = terrain.tiles[b.tileY][b.tileX];
      assert.notEqual(tileKind, "water", `Building ${b.id} placed on water tile at ${key}`);
    }
  });

  it("houses count is monotone non-decreasing in population", () => {
    const terrain = generateTerrain("pop_seed", "goblin_warrens", 48);

    const viewLow: CityView = {
      ...mockView,
      citizens: { ...mockView.citizens, population: 30 },
    };
    const viewMid: CityView = {
      ...mockView,
      citizens: { ...mockView.citizens, population: 60 },
    };
    const viewHigh: CityView = {
      ...mockView,
      citizens: { ...mockView.citizens, population: 150 },
    };

    const layoutLow = layoutCity(terrain, viewLow);
    const layoutMid = layoutCity(terrain, viewMid);
    const layoutHigh = layoutCity(terrain, viewHigh);

    assert.ok(layoutLow.houses.length >= 4, "Minimum 4 houses");
    assert.ok(layoutMid.houses.length >= layoutLow.houses.length, "Houses should increase with pop");
    assert.ok(layoutHigh.houses.length >= layoutMid.houses.length, "Houses should increase with pop");
  });

  it("ruined flag follows open: false or insolvent_steps > 0", () => {
    const terrain = generateTerrain("ruin_seed", "goblin_warrens", 48);
    const layout = layoutCity(terrain, mockView);

    for (const b of layout.buildings) {
      // Find original business
      const original = mockView.sectors
        .flatMap((s) => s.businesses)
        .find((biz) => biz.id === b.id);
      assert.ok(original, `Original business found for ${b.id}`);
      const shouldBeRuined = !original.open || original.insolvent_steps > 0;
      assert.equal(b.ruined, shouldBeRuined, `Ruined flag incorrect for ${b.id}`);
    }
  });

  it("layout is deterministic (same terrain + view yields identical layout)", () => {
    const terrain = generateTerrain("layout_det_seed", "goblin_warrens", 48);
    const layout1 = layoutCity(terrain, mockView);
    const layout2 = layoutCity(terrain, mockView);

    assert.deepEqual(layout1, layout2);
  });
});
