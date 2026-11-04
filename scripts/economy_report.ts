/**
 * Economy report: runs every arc in data/arcs for 2000 steps (500 years) and prints a row every 200 steps.
 * Usage: node scripts/economy_report.ts [arc_id ...]
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

const wanted = process.argv.slice(2);
const files = readdirSync(join(root, "data/arcs")).filter((f) => f.endsWith(".json")).sort();
const arcs = files
  .map((f) => parseArc(read(`data/arcs/${f}`)))
  .filter((a) => wanted.length === 0 || wanted.includes(a.id));

const STEPS = 2000;
const EVERY = 200;
for (const arc of arcs) {
  console.log(`\n=== ${arc.name} (${arc.id}) ===`);
  console.log("step | year | stage            | pop  | sat(bps) | open/closed | opened | total coin");
  let state = genesis(arc, `city-${arc.id}`, "seed-report");
  let opened = 0;
  for (let s = 1; s <= STEPS; s++) {
    const res = step(state, { arc, pricing, growth });
    state = res.state;
    opened += res.events.filter((e) => e.event === "business_opened").length;
    if (s % EVERY === 0) {
      let open = 0, closed = 0, coin = state.citizens.purse + state.treasury;
      for (const sec of state.sectors) for (const b of sec.businesses) { if (b.open) open++; else closed++; coin += b.coin; }
      console.log(
        `${String(s).padStart(4)} | ${String(Math.floor(s / 4)).padStart(4)} | ${arc.stages[state.stage].id.padEnd(16)} | ${String(state.citizens.population).padStart(4)} | ${String(state.citizens.satisfaction_bps).padStart(8)} | ${String(open).padStart(4)}/${String(closed).padEnd(6)} | ${String(opened).padStart(6)} | ${coin}`,
      );
    }
  }
}
