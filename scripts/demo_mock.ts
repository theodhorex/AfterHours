/**
 * Mock demo script for AfterHours gate 1 verification.
 * Runs one city in windows of 40 steps, writes checkpoints to demo/checkpoints.json,
 * and verifies them against a fresh replay.
 *
 * Usage: node scripts/demo_mock.ts [--arc <id>] [--seed <string>] [--steps <number>]
 */

import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArc } from "../packages/sim/src/arc.ts";
import { genesis } from "../packages/sim/src/genesis.ts";
import { parsePricingRules } from "../packages/sim/src/pricing.ts";
import { parseGrowthRules } from "../packages/sim/src/growth.ts";
import { step } from "../packages/sim/src/step.ts";
import { cityRoot, nextStateRoot, eventRoot, genesisPrevRoot } from "../packages/sim/src/roots.ts";
import { buildCheckpoint } from "../packages/sim/src/checkpoint.ts";
import { verifyCheckpoints } from "../packages/verify/src/verify.ts";
import type { Checkpoint } from "../packages/sim/src/checkpoint.ts";
import type { SimEvent } from "../packages/sim/src/types.ts";

const root = process.cwd();
const arcId = "goblin_warrens";
const seed = "demo";
const cityId = `city-${arcId}`;
const totalSteps = 200;
const windowSize = 40;

const arcRaw = JSON.parse(readFileSync(join(root, "data/arcs", `${arcId}.json`), "utf-8"));
const arc = parseArc(arcRaw);
const pricing = parsePricingRules(readFileSync(join(root, "data/pricing.rules.json"), "utf-8"));
const growth = parseGrowthRules(JSON.parse(readFileSync(join(root, "data/growth.rules.json"), "utf-8")));
const ctx = { arc, pricing, growth };

console.log(`=== AfterHours Demo: ${arc.name} (${arc.id}) ===`);
console.log(`Seed: ${seed} | City: ${cityId} | Steps: ${totalSteps} (windows of ${windowSize})\n`);

let currState = genesis(arc, cityId, seed);
let currPrevRoot = genesisPrevRoot(cityId, seed);
const checkpoints: Checkpoint[] = [];
const numWindows = totalSteps / windowSize;

for (let w = 0; w < numWindows; w++) {
  const windowPrevState = currState;
  const windowEvents: SimEvent[] = [];
  let lastStateRoot = currPrevRoot;

  for (let s = 0; s < windowSize; s++) {
    const res = step(currState, ctx);
    currState = res.state;
    windowEvents.push(...res.events);

    const eRoot = eventRoot(res.events);
    const cRoot = cityRoot(currState);
    lastStateRoot = nextStateRoot(currPrevRoot, currState.step, eRoot, cRoot);
    currPrevRoot = lastStateRoot;
  }

  const cp = buildCheckpoint({
    prev: windowPrevState,
    next: currState,
    events: windowEvents,
    stateRoot: lastStateRoot,
  });
  checkpoints.push(cp);

  // Summarize produced totals in this window
  const producedEntries = Object.entries(cp.items)
    .filter(([_, flow]) => flow.produced !== "0")
    .map(([item, flow]) => `${item}: ${flow.produced}`);
  const prodSummary = producedEntries.length > 0 ? producedEntries.join(", ") : "none";

  console.log(
    `Window ${w + 1} (steps ${String(cp.from_step).padStart(3)}..${String(cp.to_step).padStart(3)}): ` +
    `state_root ${cp.new_state_root.slice(0, 12)}... | produced: ${prodSummary}`
  );
}

// Ensure demo/ directory exists and write checkpoints.json
const demoDir = join(root, "demo");
mkdirSync(demoDir, { recursive: true });
const cpPath = join(demoDir, "checkpoints.json");
writeFileSync(cpPath, JSON.stringify(checkpoints, null, 2), "utf-8");
console.log(`\nSaved ${checkpoints.length} checkpoints to demo/checkpoints.json`);

// Replay and verify
console.log("Verifying checkpoints against replay...");
const result = verifyCheckpoints({
  arcId,
  seed,
  cityId,
  checkpoints,
});

for (const line of result.lines) {
  console.log(line);
}
console.log(result.finalLine);

if (!result.success) {
  process.exit(1);
}
