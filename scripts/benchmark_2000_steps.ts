/**
 * Performance benchmark: 2000 steps of simulation with Merkle roots.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArc } from "../packages/sim/src/arc.ts";
import { genesis } from "../packages/sim/src/genesis.ts";
import { parsePricingRules } from "../packages/sim/src/pricing.ts";
import { runSteps } from "../packages/sim/src/run.ts";

const pricingJson = readFileSync(join(process.cwd(), "data/pricing.rules.json"), "utf-8");
const pricing = parsePricingRules(pricingJson);

const goblinArcJson = readFileSync(join(process.cwd(), "data/arcs/goblin_warrens.json"), "utf-8");
const goblinArc = parseArc(JSON.parse(goblinArcJson));

const state0 = genesis(goblinArc, "city-perf", "seed-perf");

console.log("Running 2000 steps on goblin_warrens...");
const t0 = performance.now();
const { state: finalState, roots } = runSteps(state0, 2000, { arc: goblinArc, pricing });
const t1 = performance.now();

const durationMs = t1 - t0;
console.log(`Completed 2000 steps in ${durationMs.toFixed(2)} ms (${(durationMs / 1000).toFixed(3)} s)`);
console.log(`Final step: ${finalState.step}, total roots generated: ${roots.length}`);
