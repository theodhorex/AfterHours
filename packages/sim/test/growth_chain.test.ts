import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArc } from "../src/arc.ts";
import { genesis } from "../src/genesis.ts";
import { parsePricingRules } from "../src/pricing.ts";
import { parseGrowthRules } from "../src/growth.ts";
import { step } from "../src/step.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");

test("two-stage chain: second entrant of middle recipe survives 100 steps when upstream supply and downstream demand exist", () => {
  const chainArc = parseArc({
    id: "chain_test",
    name: "Chain Test Arc",
    server: "test",
    version: 1,
    items: [
      { id: "grain", base_price: 10, tier: "raw" },
      { id: "flour", base_price: 25, tier: "refined" },
      { id: "bread", base_price: 50, tier: "staple" },
    ],
    sectors: [
      { idx: 0, kind: "food", name: "Food" },
      { idx: 1, kind: "ore", name: "Ore" },
      { idx: 2, kind: "forge", name: "Forge" },
      { idx: 3, kind: "alchemy", name: "Alchemy" },
      { idx: 4, kind: "harbor", name: "Harbor" },
      { idx: 5, kind: "tower", name: "Tower" },
    ],
    recipes: [
      { id: "grain_farm", sector: 0, inputs: {}, outputs: { grain: 4 }, wage: 10, max_per_run_per_business: 35 },
      { id: "wind_mill", sector: 0, inputs: { grain: 2 }, outputs: { flour: 1 }, wage: 10, max_per_run_per_business: 35 },
      { id: "hearth_baker", sector: 0, inputs: { flour: 1 }, outputs: { bread: 1 }, wage: 10, max_per_run_per_business: 35 },
    ],
    citizens: {
      start_population: 100,
      needs: [{ item: "bread", per_capita_milli: 1000, satisfaction_weight: 10000 }],
    },
    stages: [
      { id: "stage_0", min_population: 0, max_businesses_per_sector: 10 },
    ],
    events: [],
    genesis: {
      coin_per_business: 1500,
      coin_citizens: 20000,
      starting_businesses: {
        grain_farm: 1,
        wind_mill: 1,
        hearth_baker: 2,
      },
    },
  });

  const pricing = parsePricingRules(fs.readFileSync(path.join(ROOT, "data/pricing.rules.json"), "utf8"));
  const growth = parseGrowthRules(JSON.parse(fs.readFileSync(path.join(ROOT, "data/growth.rules.json"), "utf8")));

  let st = genesis(chainArc, "city-chain-test", "demo");
  let secondMillOpened = false;
  let secondMillOpenedStep = -1;
  let secondMillClosed = false;

  for (let s = 1; s <= 120; s++) {
    const res = step(st, { arc: chainArc, pricing, growth });
    st = res.state;

    for (const e of res.events) {
      if (e.event === "business_opened" && e.business === "wind_mill-1") {
        secondMillOpened = true;
        secondMillOpenedStep = s;
      }
      if (e.event === "business_closed" && e.business === "wind_mill-1") {
        secondMillClosed = true;
      }
    }
  }

  assert.equal(secondMillOpened, true, "wind_mill-1 should have opened");
  assert.equal(secondMillClosed, false, "wind_mill-1 should survive and not close within 100 steps");
  assert.ok(st.step - secondMillOpenedStep >= 100, "wind_mill-1 was observed for at least 100 steps");
});

test("data capacity: elf_grove grain capacity covers 2 mills * grain per run", () => {
  const elfGroveRaw = JSON.parse(fs.readFileSync(path.join(ROOT, "data/arcs/elf_grove.json"), "utf8"));
  const forager = elfGroveRaw.recipes.find((r: { id: string }) => r.id === "forager");
  const mill = elfGroveRaw.recipes.find((r: { id: string }) => r.id === "wind_mill");

  assert.ok(forager, "forager recipe exists");
  assert.ok(mill, "wind_mill recipe exists");

  const grainPerForagerRun = BigInt(forager.outputs.grain ?? 0);
  const foragerMaxRuns = BigInt(forager.max_per_run_per_business);
  const foragerCapacity = grainPerForagerRun * foragerMaxRuns;

  const millGrainPerRun = BigInt(mill.inputs.grain ?? 0);
  const millMaxRuns = BigInt(mill.max_per_run_per_business);
  const twoMillsRequired = 2n * millGrainPerRun * millMaxRuns;

  assert.ok(
    foragerCapacity >= twoMillsRequired,
    `forager capacity (${foragerCapacity}) must cover 2 mills requirement (${twoMillsRequired})`
  );
});
