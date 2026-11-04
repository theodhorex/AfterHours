import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArc } from "../src/arc.ts";
import { genesis } from "../src/genesis.ts";
import { parsePricingRules } from "../src/pricing.ts";
import { parseGrowthRules } from "../src/growth.ts";
import { step } from "../src/step.ts";
import type { CityState } from "../src/types.ts";

const pricingJson = readFileSync(join(process.cwd(), "data/pricing.rules.json"), "utf-8");
const pricing = parsePricingRules(pricingJson);
const growthJson = readFileSync(join(process.cwd(), "data/growth.rules.json"), "utf-8");
const growth = parseGrowthRules(growthJson);
const goblinArcJson = readFileSync(join(process.cwd(), "data/arcs/goblin_warrens.json"), "utf-8");
const goblinArc = parseArc(JSON.parse(goblinArcJson));

test("closure: a business with full stock and no buyers is not closed", () => {
  const s0 = genesis(goblinArc, "city-test-stock-cap-closure", "seed-sc1");
  // Prevent entrepreneur entry from confounding the test
  const noEntry = { ...growth, entry_price_premium_bps: 1000000000n };

  // Find tinker across all sectors
  const tinker = s0.sectors.flatMap((sec) => sec.businesses).find((b) => b.recipe === "tinker")!;
  const recipe = goblinArc.recipes.find((r) => r.id === "tinker")!;
  const cap = BigInt(growth.stock_cap_runs) * recipe.max_per_run_per_business * recipe.outputs["gadget"];
  tinker.inventory["gadget"] = cap;
  tinker.inventory["scrap"] = 20n;
  tinker.inventory["crystal"] = 20n;
  tinker.coin = 1000n;

  // Make sure citizens cannot buy gadgets so stock remains capped and no runs occur
  s0.citizens.purse = 0n;

  let curr: CityState = s0;
  // Run for more than idle_close_steps (50 steps)
  for (let s = 1; s <= 50; s++) {
    const res = step(curr, { arc: goblinArc, pricing, growth: noEntry });
    curr = res.state;
  }

  const tinkerAfter = curr.sectors.flatMap((sec) => sec.businesses).find((b) => b.id === tinker.id)!;
  assert.equal(tinkerAfter.open, true, "Business with full stock must not close");
  assert.equal(tinkerAfter.insolvent_steps, 0, "Business with full stock must not accumulate insolvent steps");
});

test("closure: a truly insolvent business (cannot pay wage) closes after idle_close_steps", () => {
  const s0 = genesis(goblinArc, "city-test-truly-insolvent", "seed-sc2");
  // Isolate top-up so purse cannot bail out the insolvent business
  const noEntryNoTopup = { ...growth, entry_price_premium_bps: 1000000000n, topup_floor_bps: 0n };

  // Make tinker truly insolvent: 0 coin, no inventory, cannot afford wage
  const tinker = s0.sectors.flatMap((sec) => sec.businesses).find((b) => b.recipe === "tinker")!;
  tinker.inventory = {};
  tinker.coin = 0n;

  let curr: CityState = s0;
  for (let s = 1; s < growth.idle_close_steps; s++) {
    const res = step(curr, { arc: goblinArc, pricing, growth: noEntryNoTopup });
    curr = res.state;
    const t = curr.sectors.flatMap((sec) => sec.businesses).find((b) => b.id === tinker.id)!;
    assert.equal(t.open, true, `Insolvent business remains open before step ${growth.idle_close_steps}`);
  }

  const resClose = step(curr, { arc: goblinArc, pricing, growth: noEntryNoTopup });
  const tFinal = resClose.state.sectors.flatMap((sec) => sec.businesses).find((b) => b.id === tinker.id)!;
  assert.equal(tFinal.open, false, "Truly insolvent business must close after idle_close_steps");
  assert.ok(
    resClose.events.some((e) => e.event === "business_closed" && e.business_id === tinker.id),
    "business_closed event must be emitted"
  );
});

test("closure: stock too near the cap to fit one more run counts as capped, not idle", () => {
  const dinoArc = parseArc(JSON.parse(readFileSync(join(process.cwd(), "data/arcs/dino_vale.json"), "utf-8")));
  const s0 = genesis(dinoArc, "city-test-near-cap", "seed-sc3");
  const noEntry = { ...growth, entry_price_premium_bps: 1000000000n };
  const fishery = s0.sectors.flatMap((sec) => sec.businesses).find((b) => b.recipe === "fishery")!;
  const recipe = dinoArc.recipes.find((r) => r.id === "fishery")!;
  const perRun = recipe.outputs["fish"];
  const cap = BigInt(growth.stock_cap_runs) * recipe.max_per_run_per_business * perRun;
  // Room is one unit short of a whole run (perRun = 3): production already yields 0 runs here.
  fishery.inventory["fish"] = cap - 1n;
  fishery.coin = 1000n;
  s0.citizens.purse = 0n;

  let curr: CityState = s0;
  for (let s = 1; s <= growth.idle_close_steps + 5; s++) {
    curr = step(curr, { arc: dinoArc, pricing, growth: noEntry }).state;
  }
  const after = curr.sectors.flatMap((sec) => sec.businesses).find((b) => b.id === fishery.id)!;
  assert.equal(after.open, true, "Business that cannot fit another run must not close");
  assert.equal(after.insolvent_steps, 0);
});
