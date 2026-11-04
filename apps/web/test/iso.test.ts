import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isoToScreen, screenToIso, screenToTile, depthSortKey, calculateFitCamera, isClick, getTileVariant } from "../src/lib/iso/iso-math.ts";
import { generateTerrain } from "../src/lib/iso/terrain.ts";
import { layoutCity } from "../src/lib/iso/layout.ts";
import { generateRoadPaths, generateActors } from "../src/lib/iso/animation.ts";
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

  it("shade variant determinism and range: returns deterministic variant in [0, variants-1]", () => {
    // Deterministic check
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        const v1 = getTileVariant(x, y, 3);
        const v2 = getTileVariant(x, y, 3);
        assert.equal(v1, v2, `Mismatch at (${x}, ${y})`);
        assert.ok(v1 >= 0 && v1 < 3, `Variant out of range: ${v1}`);
      }
    }

    // Spread check: all variants appear across sample coordinates
    const seen = new Set<number>();
    for (let i = 0; i < 40; i++) {
      seen.add(getTileVariant(i, i * 2 + 1, 3));
    }
    assert.equal(seen.size, 3, "All 3 variants should appear across sample coordinates");
  });

  it("click-vs-drag threshold helper: isClick is true only within threshold", () => {
    assert.equal(isClick(0, 0, 4), true);
    assert.equal(isClick(2, 3, 4), true); // 4 + 9 = 13 <= 16
    assert.equal(isClick(4, 0, 4), true); // 16 <= 16
    assert.equal(isClick(3, 3, 4), false); // 9 + 9 = 18 > 16
    assert.equal(isClick(0, 5, 4), false);
    assert.equal(isClick(-4, 0, 4), true);
    assert.equal(isClick(-4, -1, 4), false);
  });

  it("bounding-box fit math: zoom fits all buildings inside the viewport with padding", () => {
    const terrain = generateTerrain("fit_seed", "goblin_warrens", 48);
    const layout = layoutCity(terrain, mockView);
    const points = layout.buildings.map((b) => ({ x: b.tileX, y: b.tileY }));
    const vw = 860;
    const vh = 540;
    const pad = 40;

    const cam = calculateFitCamera(points, {
      viewportWidth: vw,
      viewportHeight: vh,
      padding: pad,
      minZoom: 0.4,
      maxZoom: 3.0,
    });

    assert.ok(cam.zoom >= 0.4 && cam.zoom <= 3.0, `Zoom ${cam.zoom} should be within limits`);

    // Verify all points project within [pad, vw - pad] and [pad, vh - pad]
    for (const pt of points) {
      const scr = isoToScreen(pt.x, pt.y);
      const projX = scr.x * cam.zoom + cam.x;
      const projY = scr.y * cam.zoom + cam.y;

      assert.ok(
        projX >= pad - 1 && projX <= vw - pad + 1,
        `Point (${pt.x}, ${pt.y}) projected x=${projX} outside [${pad}, ${vw - pad}]`
      );
      assert.ok(
        projY >= pad - 1 && projY <= vh - pad + 1,
        `Point (${pt.x}, ${pt.y}) projected y=${projY} outside [${pad}, ${vh - pad}]`
      );
    }
  });

  it("person/cart path generation is deterministic and stays on road tiles", () => {
    const terrain = generateTerrain("path_seed", "goblin_warrens", 40);
    const layout = layoutCity(terrain, mockView);
    const roadSet = new Set(layout.roads.map((r) => `${r.x},${r.y}`));

    const paths1 = generateRoadPaths(layout.roads, layout.plaza, layout.buildings);
    const paths2 = generateRoadPaths(layout.roads, layout.plaza, layout.buildings);

    assert.deepEqual(paths1, paths2, "Path generation must be deterministic");
    assert.ok(paths1.length > 0, "Must generate at least one path");

    for (const path of paths1) {
      assert.ok(path.length >= 2, "Path must have at least 2 waypoints");
      for (const pt of path) {
        assert.ok(
          roadSet.has(`${pt.x},${pt.y}`),
          `Path waypoint (${pt.x}, ${pt.y}) must be on a road tile`
        );
      }
    }
  });

  it("the cap on mobile counts: never exceeds 40 even with massive population or open businesses", () => {
    const terrain = generateTerrain("actor_seed", "goblin_warrens", 40);
    const layout = layoutCity(terrain, mockView);

    // Normal case
    const actorsNormal = generateActors(layout.roads, layout.plaza, layout.buildings, 50, 10);
    assert.ok(actorsNormal.length >= 4, "Should have minimum actors");
    assert.ok(actorsNormal.length <= 40, "Must be capped at 40");

    // Extreme case: 10,000 population, 200 businesses
    const actorsExtreme = generateActors(layout.roads, layout.plaza, layout.buildings, 10000, 200);
    assert.equal(actorsExtreme.length, 40, "Must be strictly capped at 40");

    // Zero population/business case
    const actorsEmpty = generateActors(layout.roads, layout.plaza, layout.buildings, 0, 0);
    assert.ok(actorsEmpty.length >= 2, "Should have minimum ambient actors");
    assert.ok(actorsEmpty.length <= 40);
  });
});
