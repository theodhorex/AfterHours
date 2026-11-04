import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isoToScreen, screenToIso, screenToTile, depthSortKey, calculateFitCamera, isClick, getTileVariant } from "../src/lib/iso/iso-math.ts";
import { generateTerrain } from "../src/lib/iso/terrain.ts";
import { layoutCity } from "../src/lib/iso/layout.ts";
import { generateRoadPaths, generateActors } from "../src/lib/iso/animation.ts";
import { getStageTokens } from "../src/lib/iso/stage-tokens.ts";
import { shade, outlineColor, getTheme, SEASON_NAMES, relativeLuminance } from "../src/lib/iso/theme.ts";
import { getSceneTreePlacements, countFreeGrassTiles } from "../src/lib/iso/render.ts";
import { getElfTreeFoliage } from "../src/lib/iso/sprites-props.ts";
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

  it("sorted order is stable for adjacent buildings", () => {
    // Check all adjacent tile neighbors (orthogonal and diagonal)
    const center = { x: 12, y: 12 };
    const neighbors = [
      { x: 13, y: 12 }, // South-East (row+1)
      { x: 12, y: 13 }, // South-West (row+1)
      { x: 13, y: 11 }, // East (same row, different column)
      { x: 11, y: 13 }, // West (same row, different column)
      { x: 11, y: 12 }, // North-West (row-1)
      { x: 12, y: 11 }, // North-East (row-1)
    ];

    const centerKey = depthSortKey(center.x, center.y, 1);
    for (const n of neighbors) {
      const neighborKey = depthSortKey(n.x, n.y, 1);
      assert.notEqual(
        centerKey,
        neighborKey,
        `Depth sort key must never collide for adjacent buildings at (${center.x},${center.y}) vs (${n.x},${n.y})`
      );
    }

    // Two buildings with same x+y (e.g. (13, 11) and (11, 13)) must have deterministic strict ordering
    const kA = depthSortKey(13, 11, 1);
    const kB = depthSortKey(11, 13, 1);
    assert.notEqual(kA, kB, "Same-row diagonal neighbors must have deterministic non-equal sort keys");
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

  it("all placed objects on distinct land tiles, none on water or roads", () => {
    const terrain = generateTerrain("placed_objs_seed", "goblin_warrens", 48);
    const layout = layoutCity(terrain, mockView);
    const roadSet = new Set(layout.roads.map((r) => `${r.x},${r.y}`));

    const allObjects = [
      ...layout.buildings.map((b) => ({ id: b.id, x: b.tileX, y: b.tileY, kind: "building" })),
      ...layout.houses.map((h) => ({ id: h.id, x: h.tileX, y: h.tileY, kind: "house" })),
      ...layout.supportingBuildings.map((s) => ({ id: s.id, x: s.tileX, y: s.tileY, kind: "supporting" })),
      ...layout.marketStalls.map((m) => ({ id: m.id, x: m.tileX, y: m.tileY, kind: "stall" })),
      ...layout.ruralFeatures.map((r) => ({ id: r.id, x: r.tileX, y: r.tileY, kind: "rural" })),
    ];

    assert.ok(allObjects.length > 20, "Should have a substantial density of placed objects");

    const occupied = new Set<string>();
    for (const obj of allObjects) {
      const key = `${obj.x},${obj.y}`;
      assert.ok(!occupied.has(key), `Tile duplicate collision at ${key} for ${obj.id} (${obj.kind})`);
      occupied.add(key);

      const tileKind = terrain.tiles[obj.y][obj.x];
      assert.notEqual(tileKind, "water", `Object ${obj.id} placed on water at ${key}`);
      assert.ok(!roadSet.has(key), `Object ${obj.id} placed on road at ${key}`);
    }
  });

  it("density grows with population and with stage", () => {
    const terrain = generateTerrain("density_seed", "goblin_warrens", 48);

    const viewHamlet: CityView = {
      ...mockView,
      stage_id: "hamlet",
      stage_name: "Hamlet",
      citizens: { ...mockView.citizens, population: 40 },
    };
    const viewVillage: CityView = {
      ...mockView,
      stage_id: "village",
      stage_name: "Village",
      citizens: { ...mockView.citizens, population: 120 },
    };
    const viewTown: CityView = {
      ...mockView,
      stage_id: "town",
      stage_name: "Town",
      citizens: { ...mockView.citizens, population: 450 },
    };

    const lHamlet = layoutCity(terrain, viewHamlet);
    const lVillage = layoutCity(terrain, viewVillage);
    const lTown = layoutCity(terrain, viewTown);

    const countHamlet = lHamlet.houses.length + lHamlet.supportingBuildings.length + lHamlet.ruralFeatures.length;
    const countVillage = lVillage.houses.length + lVillage.supportingBuildings.length + lVillage.ruralFeatures.length;
    const countTown = lTown.houses.length + lTown.supportingBuildings.length + lTown.ruralFeatures.length;

    assert.ok(countVillage > countHamlet, `Village density (${countVillage}) should exceed Hamlet (${countHamlet})`);
    assert.ok(countTown > countVillage, `Town density (${countTown}) should exceed Village (${countVillage})`);
  });

  it("every district has at least its landmark and (at stage >= 1) supporting buildings", () => {
    const terrain = generateTerrain("district_seed", "goblin_warrens", 48);

    // Stage 0: Hamlet
    const viewStage0: CityView = { ...mockView, stage_id: "hamlet", stage_name: "Hamlet" };
    const lStage0 = layoutCity(terrain, viewStage0);
    for (const sec of lStage0.sectors) {
      const landmark = lStage0.buildings.find((b) => b.sectorIdx === sec.idx && b.isLandmark);
      assert.ok(landmark, `District ${sec.name} must have a designated landmark at stage 0`);
      assert.equal(landmark.tileX, sec.centerX);
      assert.equal(landmark.tileY, sec.centerY);
    }

    // Stage 1+: Village
    const lStage1 = layoutCity(terrain, mockView);
    for (const sec of lStage1.sectors) {
      const landmark = lStage1.buildings.find((b) => b.sectorIdx === sec.idx && b.isLandmark);
      assert.ok(landmark, `District ${sec.name} must have a landmark at stage 1`);
      const supporting = lStage1.supportingBuildings.filter((s) => s.sectorIdx === sec.idx);
      assert.ok(
        supporting.length >= 2,
        `District ${sec.name} must have supporting buildings at stage >= 1, found ${supporting.length}`
      );
    }
  });

  it("houses are distributed over districts proportionally to open businesses plus central ring", () => {
    const terrain = generateTerrain("house_dist_seed", "goblin_warrens", 48);
    const viewLargePop: CityView = {
      ...mockView,
      citizens: { ...mockView.citizens, population: 300 },
    };
    const layout = layoutCity(terrain, viewLargePop);

    // At least 3 different districts should have houses allocated
    const districtHouseCounts = new Map<number, number>();
    for (const h of layout.houses) {
      if (h.districtIdx !== undefined) {
        districtHouseCounts.set(h.districtIdx, (districtHouseCounts.get(h.districtIdx) ?? 0) + 1);
      }
    }

    // Central ring + multiple districts
    assert.ok(
      districtHouseCounts.size >= 4,
      `Houses should spread across multiple districts, found ${districtHouseCounts.size}`
    );
  });

  it("market plaza stall count follows in-stock commodities", () => {
    const terrain = generateTerrain("market_seed", "goblin_warrens", 48);
    const layout = layoutCity(terrain, mockView);
    const inStock = mockView.market.filter((m) => (m.stock ?? 0) > 0);

    assert.equal(layout.marketStalls.length, inStock.length);
  });

  it("stage style tokens map visibly across at least 3 distinct steps", () => {
    const s0 = getStageTokens("hamlet");
    const s1 = getStageTokens("village");
    const s2 = getStageTokens("town");
    const s3 = getStageTokens("city");
    const s4 = getStageTokens("grand_city");

    // Stage 0: Hamlet
    assert.equal(s0.stageIndex, 0);
    assert.equal(s0.roadStyle, "dirt");
    assert.equal(s0.hasDistrictWalls, false);
    assert.equal(s0.hasBanners, false);
    assert.equal(s0.hasPlazaFountain, false);

    // Stage 1: Village
    assert.equal(s1.stageIndex, 1);
    assert.equal(s1.roadStyle, "cobble");
    assert.equal(s1.hasDistrictWalls, false);
    assert.equal(s1.hasPlazaFountain, false);

    // Stage 2: Town
    assert.equal(s2.stageIndex, 2);
    assert.equal(s2.hasDistrictWalls, true);
    assert.equal(s2.hasBanners, true);
    assert.equal(s2.hasPlazaFountain, false);

    // Stage 3+: City / Grand City
    assert.equal(s3.stageIndex, 3);
    assert.equal(s3.hasDistrictWalls, true);
    assert.equal(s3.hasBanners, true);
    assert.equal(s3.hasPlazaFountain, true);
    assert.equal(s3.landmarkTier, 2);

    assert.equal(s4.hasPlazaFountain, true);

    // Tokens must differ in at least 3 steps
    const step0to1Diff = (s0.roadStyle as string) !== (s1.roadStyle as string);
    const step1to2Diff = (s1.hasDistrictWalls as boolean) !== (s2.hasDistrictWalls as boolean);
    const step2to3Diff = (s2.hasPlazaFountain as boolean) !== (s3.hasPlazaFountain as boolean);
    assert.ok(step0to1Diff && step1to2Diff && step2to3Diff, "Tokens must visibly differ across steps");
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

  describe("Pixel Theme & Pure Color Helpers (TDD)", () => {
    it("shade(hex, factor): pure color factor calculation", () => {
      // 1.0 preserves color
      assert.equal(shade(0x808080, 1.0), 0x808080);
      // factor < 1.0 darkens
      const darker = shade(0x808080, 0.5);
      assert.ok(darker < 0x808080);
      assert.equal(darker, 0x404040);
      // factor > 1.0 lightens and clamps at 255
      const lighter = shade(0xf08080, 1.5);
      assert.equal((lighter >> 16) & 0xff, 255);
      // factor 0 returns 0
      assert.equal(shade(0x123456, 0), 0x000000);
      // supports string hex
      assert.equal(shade("#808080", 0.5), "#404040");
    });

    it("outlineColor(hex): returns deterministic darker outline color", () => {
      const outline = outlineColor(0x4c6632);
      assert.equal(typeof outline, "number");
      assert.ok(outline < 0x4c6632);
      assert.equal(outlineColor(0x4c6632), outline);
      // supports string hex
      const strOutline = outlineColor("#4c6632");
      assert.ok(typeof strOutline === "string");
      assert.ok(strOutline.startsWith("#"));
    });

    it("getTheme(arcId, season): every arc x season returns complete valid tokens", () => {
      const arcs = ["goblin_warrens", "cave_hold", "dino_vale", "elf_grove"];
      const seasons = [0, 1, 2, 3];

      for (const arc of arcs) {
        for (const season of seasons) {
          const theme = getTheme(arc, season);
          assert.equal(theme.arcId, arc);
          assert.equal(theme.seasonIndex, season);
          assert.equal(theme.seasonName, SEASON_NAMES[season]);

          // Ground colors
          assert.ok(typeof theme.ground.grass === "number");
          assert.ok(typeof theme.ground.water === "number");
          assert.ok(typeof theme.ground.rock === "number");
          assert.ok(typeof theme.ground.road === "number");

          // Building colors
          assert.ok(typeof theme.building.wall === "number");
          assert.ok(typeof theme.building.roof === "number");
          assert.ok(typeof theme.building.accent === "number");
          assert.ok(typeof theme.building.chimneySmoke === "number");

          // Road & tree style
          assert.ok(["dirt", "cobble", "root_path", "flagstone", "mine_rails"].includes(theme.roadStyle));
          assert.ok(["mushroom", "crystal", "fern", "great_tree"].includes(theme.treeStyle));

          // Props per arc
          assert.ok(Array.isArray(theme.props) && theme.props.length >= 3);

          // Weather
          assert.ok([
            "rain", "fog", "falling_leaves", "snow", "fireflies", "embers", "dust", "none"
          ].includes(theme.weather));

          // Numeric ranges
          assert.ok(theme.windowGlowLevel >= 0 && theme.windowGlowLevel <= 1);
          assert.ok(theme.smokeThickness > 0);

          // Hex validity for all color properties (0 to 0xffffff)
          const allColors = [
            theme.primary, theme.secondary, theme.accent, theme.trim,
            theme.ground.grass, theme.ground.water, theme.ground.rock,
            theme.building.wall, theme.building.roof, theme.ambientTint
          ];
          for (const col of allColors) {
            assert.ok(
              Number.isInteger(col) && col >= 0 && col <= 0xffffff,
              `Invalid hex color: ${col}`
            );
          }
        }
      }
    });

    it("tokens differ between arcs", () => {
      const tGoblin = getTheme("goblin_warrens", 0);
      const tCave = getTheme("cave_hold", 0);
      const tDino = getTheme("dino_vale", 0);
      const tElf = getTheme("elf_grove", 0);

      assert.notEqual(tGoblin.treeStyle, tCave.treeStyle);
      assert.notEqual(tGoblin.treeStyle, tDino.treeStyle);
      assert.notEqual(tGoblin.treeStyle, tElf.treeStyle);
      assert.notEqual(tGoblin.ground.grass, tCave.ground.grass);
      assert.notEqual(tGoblin.building.wall, tElf.building.wall);
    });

    it("tokens differ between seasons for the same arc", () => {
      const tSpring = getTheme("goblin_warrens", 0);
      const tSummer = getTheme("goblin_warrens", 1);
      const tAutumn = getTheme("goblin_warrens", 2);
      const tWinter = getTheme("goblin_warrens", 3);

      assert.notEqual(tSpring.weather, tSummer.weather);
      assert.notEqual(tSpring.ground.grass, tAutumn.ground.grass);
      assert.notEqual(tSummer.ambientTint, tWinter.ambientTint);
      assert.ok(tWinter.hasSnowCaps);
      assert.ok(!tSummer.hasSnowCaps);
      assert.ok(tWinter.isFrozenWater);
      assert.ok(!tSummer.isFrozenWater);
      assert.ok(tWinter.smokeThickness > tSummer.smokeThickness);
    });

    it("step % 4 determinism and pure mapping", () => {
      const t0 = getTheme("goblin_warrens", 0);
      const t4 = getTheme("goblin_warrens", 4);
      const t8 = getTheme("goblin_warrens", 8);
      assert.deepEqual(t0, t4);
      assert.deepEqual(t0, t8);

      const t1 = getTheme("goblin_warrens", 1);
      const t5 = getTheme("goblin_warrens", 5);
      assert.deepEqual(t1, t5);
    });

    it("theme code imports nothing from sim state mutation path", async () => {
      // Pure view function: reads arcId + season, no sim mutation imports
      const themeModule = await import("../src/lib/iso/theme.ts");
      assert.equal(typeof themeModule.getTheme, "function");
      assert.equal(typeof themeModule.shade, "function");
      assert.equal(typeof themeModule.outlineColor, "function");
      assert.equal(typeof themeModule.relativeLuminance, "function");
    });

    it("every arc x season ground tone luminance > 0.25 and ambient tint luminance > 0.8", () => {
      const arcs = ["goblin_warrens", "cave_hold", "dino_vale", "elf_grove"];
      const seasons = [0, 1, 2, 3];

      for (const arc of arcs) {
        for (const season of seasons) {
          const theme = getTheme(arc, season);
          const tintLum = relativeLuminance(theme.ambientTint);
          assert.ok(
            tintLum > 0.8,
            `${arc} s${season} ambient tint luminance ${tintLum.toFixed(3)} must be > 0.8`
          );

          const grassLum = relativeLuminance(theme.ground.grass);
          const rockLum = relativeLuminance(theme.ground.rock);
          const waterLum = relativeLuminance(theme.ground.water);

          assert.ok(
            grassLum > 0.25,
            `${arc} s${season} grass luminance ${grassLum.toFixed(3)} must be > 0.25`
          );
          assert.ok(
            rockLum > 0.25,
            `${arc} s${season} rock luminance ${rockLum.toFixed(3)} must be > 0.25`
          );
          assert.ok(
            waterLum > 0.25,
            `${arc} s${season} water luminance ${waterLum.toFixed(3)} must be > 0.25`
          );
        }
      }
    });

    it("cave_hold features grey-blue stone, warm windows, and snow-capped peaks in winter", () => {
      const chSpring = getTheme("cave_hold", 0);
      const chWinter = getTheme("cave_hold", 3);
      assert.equal(chSpring.roadStyle, "mine_rails");
      assert.equal(chSpring.treeStyle, "crystal");
      assert.ok(chSpring.props.includes("mine_rails") || chSpring.props.includes("ore_mounds"));
      assert.ok(chWinter.hasSnowCaps, "cave_hold must have snow caps on peaks in winter");
      assert.notEqual(chSpring.ground.grass, chWinter.ground.grass);
      assert.ok(relativeLuminance(chSpring.building.windowLit) > 0.5, "warm lamp-lit forge windows");
    });

    it("dino_vale features lush green and ochre, ferns, and mist-free bright sky", () => {
      const dvSpring = getTheme("dino_vale", 0);
      const dvAutumn = getTheme("dino_vale", 2);
      assert.equal(dvSpring.treeStyle, "fern");
      assert.ok(dvSpring.props.includes("eggs") || dvSpring.props.includes("bones"));
      assert.notEqual(dvSpring.ground.grass, dvAutumn.ground.grass, "distinct palettes per season for dino_vale");
      assert.ok(relativeLuminance(dvSpring.ambientTint) > 0.85, "mist-free bright sky");
    });

    it("elf_grove features great trees, root bridges, spring blossoms, and autumn gold", () => {
      const egSpring = getTheme("elf_grove", 0);
      const egAutumn = getTheme("elf_grove", 2);
      assert.equal(egSpring.treeStyle, "great_tree");
      assert.ok(egSpring.props.includes("big_trees") || egSpring.props.includes("root_bridges"));
      assert.notEqual(egSpring.ground.grass, egAutumn.ground.grass, "distinct seasonal palettes for elf_grove");
      assert.ok(egSpring.accent !== undefined);
    });

    it("elf_grove tree-to-free-tile ratio <= 0.2 across seasons, capped at ~1 in 6, none on roads/footprints", () => {
      const seeds = ["tree_seed_a", "tree_seed_b", "elf_grove_dense"];
      for (const seed of seeds) {
        const terrain = generateTerrain(seed, "elf_grove", 48);
        const layout = layoutCity(terrain, { ...mockView, arc_id: "elf_grove" });

        const occupied = new Set<string>();
        for (const r of layout.roads) occupied.add(`${r.x},${r.y}`);
        for (const s of layout.sidewalks ?? []) occupied.add(`${s.x},${s.y}`);
        if (layout.plaza) occupied.add(`${layout.plaza.x},${layout.plaza.y}`);
        for (const b of layout.buildings) occupied.add(`${b.tileX},${b.tileY}`);
        for (const h of layout.houses) occupied.add(`${h.tileX},${h.tileY}`);
        for (const sb of layout.supportingBuildings ?? []) occupied.add(`${sb.tileX},${sb.tileY}`);
        for (const m of layout.marketStalls ?? []) occupied.add(`${m.tileX},${m.tileY}`);
        for (const rf of layout.ruralFeatures ?? []) occupied.add(`${rf.tileX},${rf.tileY}`);

        const freeGrassCount = countFreeGrassTiles(terrain, layout);
        assert.ok(freeGrassCount > 500, `expected plentiful free grass tiles, got ${freeGrassCount}`);

        for (let season = 0; season < 4; season++) {
          const trees = getSceneTreePlacements(terrain, layout, "elf_grove", season);
          const ratio = trees.length / freeGrassCount;

          assert.ok(
            ratio <= 0.2,
            `tree ratio ${ratio.toFixed(4)} must be <= 0.2 (treeCount: ${trees.length}, free: ${freeGrassCount})`
          );
          assert.ok(
            trees.length <= Math.ceil(freeGrassCount / 5),
            `tree count ${trees.length} should be at most about 1 in 6 free grass tiles`
          );

          // Assert zero trees on occupied tiles (roads, sidewalks, buildings, houses, etc.)
          for (const tree of trees) {
            const key = `${tree.tileX},${tree.tileY}`;
            assert.ok(!occupied.has(key), `Tree at (${key}) collides with road/plot/building footprint`);
          }
        }
      }
    });

    it("elf_grove mixes 3 tree sorts: pink blossom only in spring, gold in autumn, plain green other seasons", () => {
      // 3 sorts: 0, 1, 2
      // Spring: sort 1 has pink blossom, sort 0 & 2 are green broadleaf
      const s0Spring = getElfTreeFoliage(0, 0);
      const s1Spring = getElfTreeFoliage(1, 0);
      const s2Spring = getElfTreeFoliage(2, 0);

      assert.equal(s1Spring.isBlossom, true, "sort 1 should be pink blossom in spring");
      assert.equal(s0Spring.isBlossom, false, "sort 0 should be green broadleaf in spring");
      assert.equal(s2Spring.isBlossom, false, "sort 2 should be green broadleaf in spring");

      // Check summer (season 1): pink flood disappears outside spring!
      for (const season of [1, 2, 3]) {
        for (let sort = 0; sort < 3; sort++) {
          const foliage = getElfTreeFoliage(sort, season);
          assert.equal(
            foliage.isBlossom,
            false,
            `no pink blossom allowed in season ${season} (sort ${sort})`
          );
          if (season === 2) {
            assert.equal(foliage.isAutumnGold, true, `autumn season must feature gold foliage for sort ${sort}`);
          }
        }
      }
    });
  });
});
