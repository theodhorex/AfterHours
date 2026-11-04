/**
 * Economy report: runs arcs in data/arcs for 2000 steps and prints
 * stage reached, population min/max/final, open/total businesses, satisfaction, bankruptcies.
 * Usage: node scripts/economy_report.ts [--seed <seed>] [--steps <n>] [arc_id ...]
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parseArc } from "../packages/sim/src/arc.ts";
import { genesis } from "../packages/sim/src/genesis.ts";
import { parsePricingRules } from "../packages/sim/src/pricing.ts";
import { parseGrowthRules } from "../packages/sim/src/growth.ts";
import { step } from "../packages/sim/src/step.ts";

const root = process.cwd();
const read = (p: string): unknown => JSON.parse(readFileSync(join(root, p), "utf-8"));
const pricing = parsePricingRules(readFileSync(join(root, "data/pricing.rules.json"), "utf-8"));
const growth = parseGrowthRules(read("data/growth.rules.json"));

const args = process.argv.slice(2);
let seed = "demo";
let steps = 2000;
const wanted: string[] = [];

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--seed" && i + 1 < args.length) {
    seed = args[++i];
  } else if (args[i] === "--steps" && i + 1 < args.length) {
    steps = parseInt(args[++i], 10);
  } else if (!args[i].startsWith("--")) {
    wanted.push(args[i]);
  }
}

const files = readdirSync(join(root, "data/arcs")).filter((f) => f.endsWith(".json")).sort();
const arcs = files
  .map((f) => parseArc(read(`data/arcs/${f}`)))
  .filter((a) => wanted.length === 0 || wanted.includes(a.id));

const EVERY = 200;
interface ArcSummary {
  id: string;
  name: string;
  stageName: string;
  stageIndex: number;
  minPop: bigint;
  maxPop: bigint;
  finalPop: bigint;
  openBiz: number;
  totalBiz: number;
  satBps: bigint;
  bankruptcies: number;
}

const summaries: ArcSummary[] = [];

for (const arc of arcs) {
  console.log(`\n=== ${arc.name} (${arc.id}) [seed: ${seed}, steps: ${steps}] ===`);
  console.log("step | year | stage            | pop  | sat(bps) | open/closed | opened | total coin");
  let state = genesis(arc, `city-${arc.id}`, seed);
  let opened = 0;
  let bankruptcies = 0;
  let minPop = state.citizens.population;
  let maxPop = state.citizens.population;

  for (let s = 1; s <= steps; s++) {
    const res = step(state, { arc, pricing, growth });
    state = res.state;
    const pop = state.citizens.population;
    if (pop < minPop) minPop = pop;
    if (pop > maxPop) maxPop = pop;

    for (const e of res.events) {
      if (e.event === "business_opened") opened++;
      if (e.event === "business_closed") bankruptcies++;
    }

    if (s % EVERY === 0 || s === steps) {
      let open = 0, closed = 0, coin = state.citizens.purse + state.treasury;
      for (const sec of state.sectors) for (const b of sec.businesses) { if (b.open) open++; else closed++; coin += b.coin; }
      console.log(
        `${String(s).padStart(4)} | ${String(Math.floor(s / 4)).padStart(4)} | ${arc.stages[state.stage].id.padEnd(16)} | ${String(state.citizens.population).padStart(4)} | ${String(state.citizens.satisfaction_bps).padStart(8)} | ${String(open).padStart(4)}/${String(closed).padEnd(6)} | ${String(opened).padStart(6)} | ${coin}`,
      );
    }
  }

  let finalOpen = 0, finalClosed = 0;
  for (const sec of state.sectors) {
    for (const b of sec.businesses) {
      if (b.open) finalOpen++;
      else finalClosed++;
    }
  }

  summaries.push({
    id: arc.id,
    name: arc.name,
    stageName: arc.stages[state.stage].id,
    stageIndex: state.stage,
    minPop,
    maxPop,
    finalPop: state.citizens.population,
    openBiz: finalOpen,
    totalBiz: finalOpen + finalClosed,
    satBps: state.citizens.satisfaction_bps,
    bankruptcies,
  });
}

console.log("\n### Summary Table (seed: " + seed + ", steps: " + steps + ")");
console.log("| Arc | Stage reached | Pop (min/max/final) | Open/Total | Satisfaction | Bankruptcies |");
console.log("|---|---|---|---|---|---|");
for (const s of summaries) {
  const satPct = (Number(s.satBps) / 100).toFixed(1) + "%";
  console.log(
    `| ${s.name} | ${s.stageName} (${s.stageIndex}) | ${s.minPop} / ${s.maxPop} / ${s.finalPop} | ${s.openBiz}/${s.totalBiz} | ${satPct} (${s.satBps} bps) | ${s.bankruptcies} |`,
  );
}
