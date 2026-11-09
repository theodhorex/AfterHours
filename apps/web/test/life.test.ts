import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildRoadGraph,
  pickNextRoadTile,
  stepWalker,
  computeWalkerCounts,
  spawnWalkers,
  type WalkerState,
} from "../src/lib/iso/life-paths.ts";
import {
  computeBirdCount,
  stepBird,
  isSpriteInView,
  MAX_ANIMATED_SPRITES,
  type BirdState,
  type ViewportBounds,
} from "../src/lib/iso/life-ambient.ts";
import { createRng } from "../src/lib/iso/rng.ts";
import type { RoadTile } from "../src/lib/iso/layout-types.ts";

describe("Living City Life Paths & Walkers Pure Logic (G4 Item 5)", () => {
  const sampleRoads: RoadTile[] = [
    { x: 10, y: 10, isBridge: false },
    { x: 11, y: 10, isBridge: false },
    { x: 12, y: 10, isBridge: false },
    { x: 11, y: 11, isBridge: false },
    { x: 11, y: 12, isBridge: false },
  ];

  it("buildRoadGraph constructs adjacency list only on valid orthogonal road neighbors", () => {
    const graph = buildRoadGraph(sampleRoads);
    assert.equal(graph.size, 5);

    // Center tile (11, 10) is connected to (10, 10), (12, 10), and (11, 11)
    const centerNeighbors = graph.get("11,10");
    assert.ok(centerNeighbors);
    assert.equal(centerNeighbors.length, 3);
    const keys = centerNeighbors.map((n) => `${n.x},${n.y}`).sort();
    assert.deepEqual(keys, ["10,10", "11,11", "12,10"]);

    // Dead end (11, 12) only connects to (11, 11)
    const deadEndNeighbors = graph.get("11,12");
    assert.ok(deadEndNeighbors);
    assert.equal(deadEndNeighbors.length, 1);
    assert.deepEqual(deadEndNeighbors[0], { x: 11, y: 11 });
  });

  it("pickNextRoadTile never leaves road tiles and avoids immediate U-turns at non-dead-ends", () => {
    const graph = buildRoadGraph(sampleRoads);
    const rng = createRng("test_u_turn_seed");

    // At junction (11, 10), coming from (10, 10). Neighbors are (10,10), (12,10), (11,11).
    // It should NEVER immediately reverse back to (10, 10).
    const current = { x: 11, y: 10 };
    const prev = { x: 10, y: 10 };

    for (let i = 0; i < 50; i++) {
      const next = pickNextRoadTile(graph, current, prev, rng);
      assert.notDeepEqual(next, prev, "Must not choose immediate U-turn when other paths exist");
      const key = `${next.x},${next.y}`;
      assert.ok(graph.has(key), "Chosen tile must exist in road graph");
    }

    // At dead-end (11, 12), coming from (11, 11). Only neighbor is (11, 11).
    // Here it MUST reverse to (11, 11) since degree is 1.
    const deadEndCurrent = { x: 11, y: 12 };
    const deadEndPrev = { x: 11, y: 11 };
    const deadEndNext = pickNextRoadTile(graph, deadEndCurrent, deadEndPrev, rng);
    assert.deepEqual(deadEndNext, deadEndPrev, "Must turn around at dead end");
  });

  it("stepWalker moves smoothly along tile centres and respects pause timer at doors", () => {
    const graph = buildRoadGraph(sampleRoads);
    const rng = createRng("walker_step_seed");

    let walker: WalkerState = {
      id: "walker_1",
      kind: "pedestrian",
      arcId: "goblin_warrens",
      from: { x: 10, y: 10 },
      to: { x: 11, y: 10 },
      prev: null,
      progress: 0.0,
      speed: 1.0, // 1 tile/s
      pauseTimer: 0,
      currentPos: { x: 10, y: 10 },
      facing: 1,
      bobFrame: 0,
      colorIdx: 0,
    };

    // Step 0.25s -> progress should be 0.25, currentPos interpolated smoothly
    walker = stepWalker(walker, 0.25, graph, rng, false);
    assert.equal(walker.progress, 0.25);
    assert.equal(walker.currentPos.x, 10.25);
    assert.equal(walker.currentPos.y, 10.0);

    // Now test pause timer (e.g. at a business door)
    walker.pauseTimer = 1.0;
    const progressBefore = walker.progress;
    walker = stepWalker(walker, 0.4, graph, rng, false);
    assert.equal(walker.progress, progressBefore, "Should not advance progress while paused");
    assert.ok(Math.abs(walker.pauseTimer - 0.6) < 1e-6, "Pause timer should decrement by dt");
  });

  it("reduced-motion yields zero speed: walkers remain static at start tiles", () => {
    const graph = buildRoadGraph(sampleRoads);
    const rng = createRng("walker_rm_seed");

    let walker: WalkerState = {
      id: "walker_rm",
      kind: "pedestrian",
      arcId: "elf_grove",
      from: { x: 10, y: 10 },
      to: { x: 11, y: 10 },
      prev: null,
      progress: 0.0,
      speed: 0.8,
      pauseTimer: 0,
      currentPos: { x: 10, y: 10 },
      facing: 1,
      bobFrame: 0,
      colorIdx: 0,
    };

    // Step with reducedMotion = true
    walker = stepWalker(walker, 1.0, graph, rng, true);
    assert.equal(walker.progress, 0.0, "Progress must stay 0 with reduced motion");
    assert.deepEqual(walker.currentPos, { x: 10, y: 10 }, "Position must remain static at start");
    assert.equal(walker.bobFrame, 0, "No bob frame animation with reduced motion");
  });

  it("computeWalkerCounts enforces caps: pedestrians <= 24, carts <= 8", () => {
    // Normal population and open businesses
    const normal = computeWalkerCounts(60, 4);
    assert.ok(normal.pedestrianCount >= 2 && normal.pedestrianCount <= 24);
    assert.equal(normal.cartCount, 4);

    // Extreme case: 10,000 population, 50 open businesses
    const extreme = computeWalkerCounts(10000, 50);
    assert.equal(extreme.pedestrianCount, 24, "Pedestrians strictly capped at 24");
    assert.equal(extreme.cartCount, 8, "Carts strictly capped at 8");

    // Zero population and businesses
    const empty = computeWalkerCounts(0, 0);
    assert.ok(empty.pedestrianCount >= 1 && empty.pedestrianCount <= 24);
    assert.equal(empty.cartCount, 0, "Zero businesses yield zero carts");
  });

  it("spawnWalkers determinism: same seed yields same positions, all on road tiles", () => {
    const graph = buildRoadGraph(sampleRoads);
    const buildings = [
      { id: "b1", tileX: 11, tileY: 9, open: true, ruined: false, hasStock: true },
      { id: "b2", tileX: 12, tileY: 11, open: false, ruined: true, hasStock: false },
    ];
    const houses = [
      { id: "h1", tileX: 10, tileY: 11, level: 1 },
      { id: "h2", tileX: 13, tileY: 10, level: 2 },
    ];

    const walkersA = spawnWalkers({
      seed: "city_seed_42",
      arcId: "dino_valley",
      roads: sampleRoads,
      graph,
      buildings,
      houses,
      population: 40,
    });

    const walkersB = spawnWalkers({
      seed: "city_seed_42",
      arcId: "dino_valley",
      roads: sampleRoads,
      graph,
      buildings,
      houses,
      population: 40,
    });

    assert.equal(walkersA.length, walkersB.length);
    for (let i = 0; i < walkersA.length; i++) {
      assert.deepEqual(walkersA[i].from, walkersB[i].from);
      assert.deepEqual(walkersA[i].to, walkersB[i].to);
      assert.equal(walkersA[i].kind, walkersB[i].kind);
      assert.equal(walkersA[i].speed, walkersB[i].speed);
      assert.ok(
        sampleRoads.some((r) => r.x === walkersA[i].from.x && r.y === walkersA[i].from.y),
        "Walker start must be on road"
      );
    }

    // Insolvent or closed businesses (b2) get no cart; only b1 (open + stock) gets cart
    const carts = walkersA.filter((w) => w.kind === "cart");
    assert.equal(carts.length, 1);
    assert.equal(carts[0].targetBusinessId, "b1");
  });

  it("spawnWalkers preserves walker state by id across sim step rebuilds", () => {
    const graph = buildRoadGraph(sampleRoads);
    const buildings = [{ id: "b1", tileX: 11, tileY: 9, open: true, ruined: false, hasStock: true }];
    const houses = [{ id: "h1", tileX: 10, tileY: 11, level: 1 }];

    const initial = spawnWalkers({
      seed: "step_0",
      arcId: "goblin_warrens",
      roads: sampleRoads,
      graph,
      buildings,
      houses,
      population: 30,
    });

    // Advance first walker
    const rng = createRng("step_sim");
    const advanced = stepWalker(initial[0], 0.5, graph, rng, false);
    const existingMap = new Map<string, WalkerState>();
    existingMap.set(advanced.id, advanced);

    // Rebuild scene on next sim step with existingMap passed
    const nextStep = spawnWalkers({
      seed: "step_1",
      arcId: "goblin_warrens",
      roads: sampleRoads,
      graph,
      buildings,
      houses,
      population: 30,
      existingWalkers: existingMap,
    });

    const matching = nextStep.find((w) => w.id === advanced.id);
    assert.ok(matching);
    assert.deepEqual(matching.currentPos, advanced.currentPos, "Walker must not teleport across rebuilds");
    assert.equal(matching.progress, advanced.progress);
  });

  describe("Ambient Life & Performance Caps (Items 3 & 4)", () => {
    const mapBounds: ViewportBounds = {
      minX: -400,
      maxX: 400,
      minY: -200,
      maxY: 600,
    };

    it("computeBirdCount returns between 5 and 9 birds across diverse seeds", () => {
      const seeds = ["seed_1", "seed_2", "goblin_birds", "dino_birds", "elf_flock"];
      for (const s of seeds) {
        const count = computeBirdCount(s);
        assert.ok(count >= 5 && count <= 9, `Bird count ${count} must be within 5..9`);
      }
    });

    it("stepBird drifts in loose arcs and wraps around map boundaries", () => {
      let bird: BirdState = {
        id: "bird_0",
        x: 395,
        y: 100,
        vx: 20,
        vy: 5,
        angle: 0.1,
        arcSpeed: 0.2,
        wingFrame: 0,
        flapTimer: 0,
      };

      // Step bird past maxX (400 + margin of 50 -> 450)
      bird = stepBird(bird, 3.0, mapBounds, false);
      // Bird should wrap around to left edge (minX - margin)
      assert.ok(bird.x < 0, `Bird x (${bird.x}) should have wrapped to the left side`);
    });

    it("stepBird with reduced-motion returns static position", () => {
      const initial: BirdState = {
        id: "bird_rm",
        x: 50,
        y: 50,
        vx: 15,
        vy: 5,
        angle: 0,
        arcSpeed: 0.1,
        wingFrame: 0,
        flapTimer: 0,
      };

      const stepped = stepBird(initial, 1.0, mapBounds, true);
      assert.equal(stepped.x, 50, "Position must not move under reduced motion");
      assert.equal(stepped.y, 50);
      assert.equal(stepped.wingFrame, 0, "No flap animation under reduced motion");
    });

    it("isSpriteInView correctly culls sprites outside camera viewport", () => {
      const view: ViewportBounds = { minX: 0, maxX: 100, minY: 0, maxY: 100 };
      // Inside
      assert.equal(isSpriteInView(50, 50, view, 10), true);
      // Inside margin
      assert.equal(isSpriteInView(105, 50, view, 10), true);
      // Outside
      assert.equal(isSpriteInView(200, 50, view, 10), false);
      assert.equal(isSpriteInView(-50, 50, view, 10), false);
    });

    it("enforces total animated sprites cap at <= 80", () => {
      assert.equal(MAX_ANIMATED_SPRITES, 80);
      const maxWalkers = 24 + 8; // 32
      const maxBirds = 9;
      const maxSmoke = 32;
      const maxSparkles = 6;
      const total = maxWalkers + maxBirds + maxSmoke + maxSparkles;
      assert.ok(total <= MAX_ANIMATED_SPRITES, `Total sprites (${total}) must be <= 80`);
    });
  });
});

