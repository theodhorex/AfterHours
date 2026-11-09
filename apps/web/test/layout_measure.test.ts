import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateTerrain } from "../src/lib/iso/terrain.ts";
import { layoutCity, getStageIndex } from "../src/lib/iso/layout.ts";
import { createWorld, advanceWorld } from "../src/lib/sim-adapter.ts";
import { stateToCityView } from "../src/lib/sim-view.ts";
import { buildRoadGraph } from "../src/lib/iso/life-paths.ts";

export interface DensityMetrics {
  arcId: string;
  year: number;
  step: number;
  stageId: string;
  stageIndex: number;
  roadCount: number;
  landCount: number;
  roadSharePct: number;
  connectedComponents: number;
  housesPerRoad: number;
  fractionHousesNearRoad: number;
}

export function computeLayoutMetrics(arcId: string, year: number, seed = "goblin_seed_0", size = 48): DensityMetrics {
  const terrain = generateTerrain(seed, arcId, size);
  let landCount = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const t = terrain.tiles[y][x];
      if (t !== "water" && t !== "rock") {
        landCount++;
      }
    }
  }

  const targetStep = year * 4;
  let world = createWorld(arcId, seed);
  if (targetStep > 0) {
    world = advanceWorld(world, targetStep);
  }

  const view = stateToCityView(world.state, world.arc, world.pricing);
  const layout = layoutCity(terrain, view);
  const roadMap = new Map<string, { x: number; y: number }>();
  for (const r of layout.roads) {
    roadMap.set(`${r.x},${r.y}`, { x: r.x, y: r.y });
  }

  // Count connected components via BFS
  const visited = new Set<string>();
  let connectedComponents = 0;
  for (const key of roadMap.keys()) {
    if (visited.has(key)) continue;
    connectedComponents++;
    const queue = [key];
    visited.add(key);
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
        if (roadMap.has(n) && !visited.has(n)) {
          visited.add(n);
          queue.push(n);
        }
      }
    }
  }

  // Check houses near road (within 2 tiles)
  let housesNearRoad = 0;
  for (const h of layout.houses) {
    let near = false;
    for (let dy = -2; dy <= 2 && !near; dy++) {
      for (let dx = -2; dx <= 2 && !near; dx++) {
        if (roadMap.has(`${h.tileX + dx},${h.tileY + dy}`)) {
          near = true;
        }
      }
    }
    if (near) housesNearRoad++;
  }

  const roadCount = layout.roads.length;
  const roadSharePct = (roadCount / landCount) * 100;
  const housesPerRoad = roadCount > 0 ? layout.houses.length / roadCount : 0;
  const fractionHousesNearRoad = layout.houses.length > 0 ? housesNearRoad / layout.houses.length : 1.0;

  return {
    arcId,
    year,
    step: targetStep,
    stageId: view.stage_id,
    stageIndex: getStageIndex(view.stage_id),
    roadCount,
    landCount,
    roadSharePct,
    connectedComponents,
    housesPerRoad,
    fractionHousesNearRoad,
  };
}

describe("L1 Road Density Measure Test (Item 1 & 3)", () => {
  const arcs = ["goblin_warrens", "cave_hold", "dino_vale", "elf_grove"];
  const years = [0, 5, 25, 100, 250];

  it("measures and prints metrics across all 4 arcs and 5 sampled years", () => {
    const results: DensityMetrics[] = [];
    for (const arc of arcs) {
      for (const yr of years) {
        const m = computeLayoutMetrics(arc, yr);
        results.push(m);
        // Print readable metric line
        console.log(
          `[MEASURE] arc=${m.arcId.padEnd(14)} yr=${String(m.year).padStart(3)} ` +
          `roads=${String(m.roadCount).padStart(3)} land=${m.landCount} ` +
          `share=${m.roadSharePct.toFixed(1).padStart(5)}% ` +
          `comps=${m.connectedComponents} houses/road=${m.housesPerRoad.toFixed(3)} ` +
          `nearRoad=${(m.fractionHousesNearRoad * 100).toFixed(0)}%`
        );
      }
    }
    assert.equal(results.length, 20);
  });
});
