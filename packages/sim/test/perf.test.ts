import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArc } from "../src/arc.ts";
import { genesis } from "../src/genesis.ts";
import { parsePricingRules } from "../src/pricing.ts";
import { runSteps } from "../src/run.ts";

test("performance: 2000 steps runs well under 10 seconds", () => {
  const pricingJson = readFileSync(join(process.cwd(), "data/pricing.rules.json"), "utf-8");
  const pricing = parsePricingRules(pricingJson);
  const goblinArcJson = readFileSync(join(process.cwd(), "data/arcs/goblin_warrens.json"), "utf-8");
  const goblinArc = parseArc(JSON.parse(goblinArcJson));

  const s0 = genesis(goblinArc, "city-perf-test", "seed-perf");

  const t0 = performance.now();
  const { state: sFinal, roots } = runSteps(s0, 2000, { arc: goblinArc, pricing });
  const durationMs = performance.now() - t0;

  console.log(`2000 steps completed in ${durationMs.toFixed(2)} ms`);
  assert.equal(sFinal.step, 2000);
  assert.equal(roots.length, 2000);
  assert.ok(durationMs < 10000, `Duration ${durationMs}ms must be under 10000ms`);
});
