import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArc } from "../src/arc.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const caveHoldPath = path.resolve(__dirname, "../../../data/arcs/cave_hold.json");
const goblinWarrensPath = path.resolve(__dirname, "../../../data/arcs/goblin_warrens.json");

test("parseArc successfully parses cave_hold.json", () => {
  const raw = JSON.parse(fs.readFileSync(caveHoldPath, "utf-8"));
  const arc = parseArc(raw);

  assert.equal(arc.id, "cave_hold");
  assert.equal(arc.sectors.length, 6);
  assert.equal(typeof arc.items[0].base_price, "bigint");
  assert.ok(arc.items[0].base_price > 0n);
  assert.equal(typeof arc.recipes[0].wage, "bigint");
  assert.equal(arc.recipes[0].wage, BigInt(raw.recipes[0].wage)); // parsed value equals the file value (not a tuning constant)
  assert.equal(typeof arc.citizens.start_population, "bigint");
  assert.equal(arc.citizens.start_population, BigInt(raw.citizens.start_population));
  assert.equal(arc.stages[0].min_population, 0n);
  assert.equal(typeof arc.events[0].weight, "bigint");
  assert.equal(typeof arc.genesis.coin_citizens, "bigint");
});

test("parseArc successfully parses goblin_warrens.json", () => {
  const raw = JSON.parse(fs.readFileSync(goblinWarrensPath, "utf-8"));
  const arc = parseArc(raw);

  assert.equal(arc.id, "goblin_warrens");
  assert.equal(arc.sectors.length, 6);
  assert.equal(typeof arc.items[0].base_price, "bigint");
  assert.ok(arc.items[0].base_price > 0n);
  assert.equal(arc.citizens.start_population, BigInt(raw.citizens.start_population));
  assert.equal(arc.stages[0].min_population, 0n);
});

test("parseArc throws on invalid sector count or sector indices", () => {
  const raw = JSON.parse(fs.readFileSync(caveHoldPath, "utf-8"));

  // Only 5 sectors
  const badSectorsCount = { ...raw, sectors: raw.sectors.slice(0, 5) };
  assert.throws(
    () => parseArc(badSectorsCount),
    (err: Error) => err.message.includes("sectors")
  );

  // Sector index out of 0..5
  const badSectorIdx = {
    ...raw,
    sectors: raw.sectors.map((s: { idx: number }, i: number) =>
      i === 5 ? { ...s, idx: 9 } : s
    ),
  };
  assert.throws(
    () => parseArc(badSectorIdx),
    (err: Error) => err.message.includes("sectors")
  );
});

test("parseArc throws on recipe sector out of bounds", () => {
  const raw = JSON.parse(fs.readFileSync(caveHoldPath, "utf-8"));
  const bad = {
    ...raw,
    recipes: [{ ...raw.recipes[0], sector: 6 }, ...raw.recipes.slice(1)],
  };
  assert.throws(
    () => parseArc(bad),
    (err: Error) => err.message.includes("recipe.sector")
  );
});

test("parseArc throws on unreferenced item in recipes, needs, or alt", () => {
  const raw = JSON.parse(fs.readFileSync(caveHoldPath, "utf-8"));

  // In recipe inputs
  const badRecipeInput = {
    ...raw,
    recipes: [
      { ...raw.recipes[0], inputs: { nonexistent_item: 2 } },
      ...raw.recipes.slice(1),
    ],
  };
  assert.throws(
    () => parseArc(badRecipeInput),
    (err: Error) => err.message.includes("recipe.inputs")
  );

  // In recipe outputs
  const badRecipeOutput = {
    ...raw,
    recipes: [
      { ...raw.recipes[0], outputs: { phantom_gold: 1 } },
      ...raw.recipes.slice(1),
    ],
  };
  assert.throws(
    () => parseArc(badRecipeOutput),
    (err: Error) => err.message.includes("recipe.outputs")
  );

  // In citizens need
  const badNeed = {
    ...raw,
    citizens: {
      ...raw.citizens,
      needs: [
        { ...raw.citizens.needs[0], item: "unknown_food" },
        ...raw.citizens.needs.slice(1),
      ],
    },
  };
  assert.throws(
    () => parseArc(badNeed),
    (err: Error) => err.message.includes("citizens.needs")
  );

  // In citizens need alt
  const badAlt = {
    ...raw,
    citizens: {
      ...raw.citizens,
      needs: [
        { ...raw.citizens.needs[0], alt: ["ghost_fish"] },
        ...raw.citizens.needs.slice(1),
      ],
    },
  };
  assert.throws(
    () => parseArc(badAlt),
    (err: Error) => err.message.includes("citizens.needs.alt")
  );
});

test("parseArc throws on non-positive base_price, wage, max_per_run_per_business, or counts", () => {
  const raw = JSON.parse(fs.readFileSync(caveHoldPath, "utf-8"));

  // Zero base_price
  const badBasePrice = {
    ...raw,
    items: [{ ...raw.items[0], base_price: 0 }, ...raw.items.slice(1)],
  };
  assert.throws(
    () => parseArc(badBasePrice),
    (err: Error) => err.message.includes("item.base_price")
  );

  // Zero wage
  const badWage = {
    ...raw,
    recipes: [{ ...raw.recipes[0], wage: 0 }, ...raw.recipes.slice(1)],
  };
  assert.throws(
    () => parseArc(badWage),
    (err: Error) => err.message.includes("recipe.wage")
  );

  // Zero max_per_run_per_business
  const badMax = {
    ...raw,
    recipes: [
      { ...raw.recipes[0], max_per_run_per_business: 0 },
      ...raw.recipes.slice(1),
    ],
  };
  assert.throws(
    () => parseArc(badMax),
    (err: Error) => err.message.includes("recipe.max_per_run_per_business")
  );

  // Zero recipe output count
  const badOutputCount = {
    ...raw,
    recipes: [
      { ...raw.recipes[0], outputs: { grain: 0 } },
      ...raw.recipes.slice(1),
    ],
  };
  assert.throws(
    () => parseArc(badOutputCount),
    (err: Error) => err.message.includes("recipe.outputs")
  );
});

test("parseArc throws on starting_businesses keys not being recipe ids", () => {
  const raw = JSON.parse(fs.readFileSync(caveHoldPath, "utf-8"));
  const bad = {
    ...raw,
    genesis: {
      ...raw.genesis,
      starting_businesses: { non_existent_recipe: 1 },
    },
  };
  assert.throws(
    () => parseArc(bad),
    (err: Error) => err.message.includes("genesis.starting_businesses")
  );
});

test("parseArc throws on invalid stages (first not 0 or not ordered)", () => {
  const raw = JSON.parse(fs.readFileSync(caveHoldPath, "utf-8"));

  // First stage min_population != 0
  const badFirstStage = {
    ...raw,
    stages: [{ ...raw.stages[0], min_population: 100 }, ...raw.stages.slice(1)],
  };
  assert.throws(
    () => parseArc(badFirstStage),
    (err: Error) => err.message.includes("stages")
  );

  // Stages out of order
  const badOrder = {
    ...raw,
    stages: [raw.stages[0], raw.stages[2], raw.stages[1], ...raw.stages.slice(3)],
  };
  assert.throws(
    () => parseArc(badOrder),
    (err: Error) => err.message.includes("stages")
  );
});

test("parseArc throws on non-positive event weight or duration_steps", () => {
  const raw = JSON.parse(fs.readFileSync(caveHoldPath, "utf-8"));

  const badWeight = {
    ...raw,
    events: [{ ...raw.events[0], weight: 0 }, ...raw.events.slice(1)],
  };
  assert.throws(
    () => parseArc(badWeight),
    (err: Error) => err.message.includes("events.weight")
  );

  const badDuration = {
    ...raw,
    events: [{ ...raw.events[0], duration_steps: -1 }, ...raw.events.slice(1)],
  };
  assert.throws(
    () => parseArc(badDuration),
    (err: Error) => err.message.includes("events.duration_steps")
  );
});
