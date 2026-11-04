import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateTerrain } from "../src/lib/iso/terrain.ts";
import { layoutCity } from "../src/lib/iso/layout.ts";
import { MOCK_CITY } from "../src/data/mock-city.ts";
import type { CityView } from "../src/lib/sim-view.ts";

const mockView: CityView = {
  ...MOCK_CITY,
  stateRoot: "0x1234567890abcdef",
};

describe("Dense City Layout (V1b) - Item 1: Road Network", () => {
  it("connected graph: every district landmark is reachable from plaza via road graph", () => {
    const terrain = generateTerrain("road_conn_seed", "goblin_warrens", 48);
    const layout = layoutCity(terrain, mockView);

    // Build 4-connected road adjacency map
    const roadMap = new Map<string, { x: number; y: number }>();
    for (const r of layout.roads) {
      roadMap.set(`${r.x},${r.y}`, { x: r.x, y: r.y });
    }

    // Find road tile closest to plaza to start BFS
    let startKey: string | null = null;
    let minD = Infinity;
    for (const r of layout.roads) {
      const d = Math.abs(r.x - layout.plaza.x) + Math.abs(r.y - layout.plaza.y);
      if (d < minD) {
        minD = d;
        startKey = `${r.x},${r.y}`;
      }
    }
    assert.ok(startKey !== null, "Must have road tiles");
    assert.ok(minD <= 2, `Plaza should be directly adjacent to road network, minD=${minD}`);

    // Run BFS to collect all reachable road tiles
    const reachableRoads = new Set<string>();
    const queue: string[] = [startKey];
    reachableRoads.add(startKey);

    while (queue.length > 0) {
      const curr = queue.shift()!;
      const [cx, cy] = curr.split(",").map(Number);
      const neighbors = [
        `${cx + 1},${cy}`,
        `${cx - 1},${cy}`,
        `${cx},${cy + 1}`,
        `${cx},${cy - 1}`,
      ];
      for (const n of neighbors) {
        if (roadMap.has(n) && !reachableRoads.has(n)) {
          reachableRoads.add(n);
          queue.push(n);
        }
      }
    }

    // Every district landmark must be adjacent to at least one reachable road tile
    for (const sec of layout.sectors) {
      const adjacentTiles = [
        `${sec.centerX + 1},${sec.centerY}`,
        `${sec.centerX - 1},${sec.centerY}`,
        `${sec.centerX},${sec.centerY + 1}`,
        `${sec.centerX},${sec.centerY - 1}`,
      ];
      const touchesReachableRoad = adjacentTiles.some((k) => reachableRoads.has(k));
      assert.ok(
        touchesReachableRoad,
        `District ${sec.name} (${sec.kind}) at (${sec.centerX},${sec.centerY}) must connect to the road graph`
      );
    }
  });

  it("no road on rock tiles, and no road on water tiles except bridges", () => {
    const arcs = ["goblin_warrens", "cave_hold", "dino_vale", "elf_grove"];
    for (const arc of arcs) {
      const terrain = generateTerrain(`terrain_road_${arc}`, arc, 48);
      const layout = layoutCity(terrain, { ...mockView, arc_id: arc });

      for (const r of layout.roads) {
        const tileKind = terrain.tiles[r.y][r.x];
        assert.notEqual(
          tileKind,
          "rock",
          `Road tile at (${r.x},${r.y}) is placed on rock in arc ${arc}`
        );
        if (tileKind === "water") {
          assert.equal(
            r.isBridge,
            true,
            `Road tile on water at (${r.x},${r.y}) must be marked as isBridge: true in arc ${arc}`
          );
        }
      }
    }
  });

  it("determinism: same terrain and view yields identical road network", () => {
    const terrain = generateTerrain("det_roads", "cave_hold", 48);
    const layout1 = layoutCity(terrain, mockView);
    const layout2 = layoutCity(terrain, mockView);

    assert.deepEqual(layout1.roads, layout2.roads);
    assert.deepEqual(layout1.sidewalks, layout2.sidewalks);
  });

  it("per-arc flavour differs: grid-based cave_hold differs from organic goblin_warrens", () => {
    const tCave = generateTerrain("flavour_seed", "cave_hold", 48);
    const tGoblin = generateTerrain("flavour_seed", "goblin_warrens", 48);

    const lCave = layoutCity(tCave, { ...mockView, arc_id: "cave_hold" });
    const lGoblin = layoutCity(tGoblin, { ...mockView, arc_id: "goblin_warrens" });

    const caveKeys = new Set(lCave.roads.map((r) => `${r.x},${r.y}`));
    const goblinKeys = new Set(lGoblin.roads.map((r) => `${r.x},${r.y}`));

    let symmetricDiff = 0;
    for (const k of caveKeys) if (!goblinKeys.has(k)) symmetricDiff++;
    for (const k of goblinKeys) if (!caveKeys.has(k)) symmetricDiff++;

    assert.ok(
      symmetricDiff > 20,
      `Road networks should differ significantly across arcs, diff=${symmetricDiff}`
    );
  });

  it("sidewalk strips generated on both sides of main roads at stage >= 1", () => {
    const terrain = generateTerrain("sidewalk_seed", "cave_hold", 48);
    const layout = layoutCity(terrain, mockView);

    assert.ok(Array.isArray(layout.sidewalks), "Layout must produce sidewalks array");
    assert.ok(layout.sidewalks.length > 10, "Should generate sidewalk strips along main roads");

    const roadKeys = new Set(layout.roads.map((r) => `${r.x},${r.y}`));
    for (const sw of layout.sidewalks) {
      const key = `${sw.x},${sw.y}`;
      assert.ok(!roadKeys.has(key), `Sidewalk at (${sw.x},${sw.y}) must not collide with road tile`);
      const tileKind = terrain.tiles[sw.y][sw.x];
      assert.notEqual(tileKind, "water", `Sidewalk at (${sw.x},${sw.y}) cannot be on water`);
      assert.notEqual(tileKind, "rock", `Sidewalk at (${sw.x},${sw.y}) cannot be on rock`);
    }
  });
});

describe("Dense City Layout (V1b) - Item 2: Blocks and Buildings", () => {
  it("every building and house lot touches a road or sidewalk", () => {
    const terrain = generateTerrain("lots_touch_seed", "goblin_warrens", 48);
    const layout = layoutCity(terrain, mockView);

    const roadOrSidewalk = new Set<string>();
    for (const r of layout.roads) roadOrSidewalk.add(`${r.x},${r.y}`);
    for (const sw of layout.sidewalks ?? []) roadOrSidewalk.add(`${sw.x},${sw.y}`);

    const allLots = [
      ...layout.buildings.map((b) => ({ id: b.id, x: b.tileX, y: b.tileY, kind: "building" })),
      ...layout.houses.map((h) => ({ id: h.id, x: h.tileX, y: h.tileY, kind: "house" })),
      ...layout.supportingBuildings.map((s) => ({ id: s.id, x: s.tileX, y: s.tileY, kind: "supporting" })),
    ];

    assert.ok(allLots.length >= 20, "Should have lots placed");

    for (const lot of allLots) {
      const neighbors = [
        `${lot.x},${lot.y - 1}`, // N
        `${lot.x + 1},${lot.y}`, // E
        `${lot.x},${lot.y + 1}`, // S
        `${lot.x - 1},${lot.y}`, // W
      ];
      const touchesRoadOrSidewalk = neighbors.some((k) => roadOrSidewalk.has(k));
      assert.ok(
        touchesRoadOrSidewalk,
        `Lot ${lot.id} (${lot.kind}) at (${lot.x},${lot.y}) must touch a road or sidewalk`
      );
    }
  });

  it("lot front faces the road or sidewalk", () => {
    const terrain = generateTerrain("facing_seed", "cave_hold", 48);
    const layout = layoutCity(terrain, mockView);

    const roadOrSidewalk = new Set<string>();
    for (const r of layout.roads) roadOrSidewalk.add(`${r.x},${r.y}`);
    for (const sw of layout.sidewalks ?? []) roadOrSidewalk.add(`${sw.x},${sw.y}`);

    for (const b of layout.buildings) {
      assert.ok(b.facing, `Building ${b.id} must declare facing`);
      let tx = b.tileX;
      let ty = b.tileY;
      if (b.facing === "N") ty -= 1;
      else if (b.facing === "E") tx += 1;
      else if (b.facing === "S") ty += 1;
      else if (b.facing === "W") tx -= 1;

      assert.ok(
        roadOrSidewalk.has(`${tx},${ty}`),
        `Building ${b.id} facing ${b.facing} at (${b.tileX},${b.tileY}) does not face a road/sidewalk at (${tx},${ty})`
      );
    }

    for (const h of layout.houses) {
      assert.ok(h.facing, `House ${h.id} must declare facing`);
      let tx = h.tileX;
      let ty = h.tileY;
      if (h.facing === "N") ty -= 1;
      else if (h.facing === "E") tx += 1;
      else if (h.facing === "S") ty += 1;
      else if (h.facing === "W") tx -= 1;

      assert.ok(
        roadOrSidewalk.has(`${tx},${ty}`),
        `House ${h.id} facing ${h.facing} at (${h.tileX},${h.tileY}) does not face a road/sidewalk at (${tx},${ty})`
      );
    }
  });

  it("building lots are on distinct land tiles, none on roads or water", () => {
    const terrain = generateTerrain("distinct_lots_seed", "dino_vale", 48);
    const layout = layoutCity(terrain, mockView);

    const roadSet = new Set(layout.roads.map((r) => `${r.x},${r.y}`));
    const occupied = new Set<string>();

    const allPlaced = [
      ...layout.buildings.map((b) => ({ id: b.id, x: b.tileX, y: b.tileY })),
      ...layout.houses.map((h) => ({ id: h.id, x: h.tileX, y: h.tileY })),
      ...layout.supportingBuildings.map((s) => ({ id: s.id, x: s.tileX, y: s.tileY })),
      ...layout.marketStalls.map((m) => ({ id: m.id, x: m.tileX, y: m.tileY })),
    ];

    for (const p of allPlaced) {
      const k = `${p.x},${p.y}`;
      assert.ok(!occupied.has(k), `Collision at (${k}) for ${p.id}`);
      occupied.add(k);

      assert.ok(!roadSet.has(k), `Object ${p.id} placed on road at (${k})`);
      assert.notEqual(terrain.tiles[p.y][p.x], "water", `Object ${p.id} placed on water at (${k})`);
    }
  });

  it("determinism: repeated layout produces identical lots and facings", () => {
    const terrain = generateTerrain("det_lots", "elf_grove", 48);
    const l1 = layoutCity(terrain, mockView);
    const l2 = layoutCity(terrain, mockView);

    assert.deepEqual(l1.buildings, l2.buildings);
    assert.deepEqual(l1.houses, l2.houses);
    assert.deepEqual(l1.supportingBuildings, l2.supportingBuildings);
  });
});
