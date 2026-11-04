import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArc } from "../src/arc.ts";
import { genesis } from "../src/genesis.ts";
import { parseGrowthRules, processEntrepreneurEntry } from "../src/growth.ts";
import type { SimEvent } from "../src/types.ts";

const growthJson = readFileSync(join(process.cwd(), "data/growth.rules.json"), "utf-8");
const growth = parseGrowthRules(growthJson);
const goblinArcJson = readFileSync(join(process.cwd(), "data/arcs/goblin_warrens.json"), "utf-8");
const goblinArc = parseArc(JSON.parse(goblinArcJson));

test("entry: with the bakery closed and bread price high, the next entry is a bakery, not an elixir shop", () => {
  const s0 = genesis(goblinArc, "city-test-entry-essential", "seed-ee1");
  s0.stage = 2;
  s0.citizens.purse = 50000n;

  // Close bakery and delete bread inventory so bread (essential need) is unmet
  for (const sec of s0.sectors) {
    for (const b of sec.businesses) {
      delete b.inventory["bread"];
      if (b.recipe === "bakery") {
        b.open = false;
      }
    }
  }

  // Bread price is high (premium above entry_price_premium_bps = 1000)
  // Base price of bread = 36 -> 72 has 100% premium
  s0.market.price["bread"] = 72n;
  // Elixir price is very high, so elixir has a higher margin than bakery
  s0.market.price["elixir"] = 500n;

  const events: SimEvent[] = [];
  processEntrepreneurEntry(s0, goblinArc, growth, events);

  const openedEvents = events.filter((e) => e.event === "business_opened");
  assert.equal(openedEvents.length, 1, "Exactly one business should open");
  assert.equal(
    openedEvents[0].recipe,
    "bakery",
    "Candidate recipe feeding unmet citizen need (bakery) must be preferred over higher-margin non-essential (alchemist)"
  );
});
