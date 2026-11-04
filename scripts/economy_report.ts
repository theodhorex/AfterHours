/**
 * Economy report script running 400 steps on each arc.
 * Prints population, satisfaction_bps, purse, treasury, total business coin,
 * count of businesses with zero production, and price relative to base (bps).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArc } from "../packages/sim/src/arc.ts";
import { genesis } from "../packages/sim/src/genesis.ts";
import { parsePricingRules } from "../packages/sim/src/pricing.ts";
import { step } from "../packages/sim/src/step.ts";

const pricingJson = readFileSync(join(process.cwd(), "data/pricing.rules.json"), "utf-8");
const pricing = parsePricingRules(pricingJson);

const arcs = [
  parseArc(JSON.parse(readFileSync(join(process.cwd(), "data/arcs/goblin_warrens.json"), "utf-8"))),
  parseArc(JSON.parse(readFileSync(join(process.cwd(), "data/arcs/cave_hold.json"), "utf-8"))),
];

for (const arc of arcs) {
  console.log(`\n======================================================`);
  console.log(`Arc: ${arc.name} (${arc.id})`);
  console.log(`======================================================`);

  let state = genesis(arc, `city-${arc.id}`, "seed-report");
  const totalBusinesses = state.sectors.reduce((acc, s) => acc + s.businesses.length, 0);

  // Print header
  console.log(
    `Step | Pop | Sat(bps) | Purse | Treas | BizCoin | 0-Prod | Item Prices vs Base (bps)`
  );
  console.log(`-----+-----+----------+-------+-------+---------+--------+-----------------------------------`);

  let lastZeroProdCount = 0;

  for (let s = 1; s <= 400; s++) {
    const res = step(state, { arc, pricing });
    state = res.state;

    if (s % 40 === 0) {
      const producingBizIds = new Set(
        res.events.filter((e) => e.event === "produced").map((e) => e.business_id as string)
      );
      lastZeroProdCount = totalBusinesses - producingBizIds.size;

      let bizCoin = 0n;
      for (const sec of state.sectors) {
        for (const b of sec.businesses) {
          bizCoin += b.coin;
        }
      }

      const priceRels = arc.items
        .map((it) => {
          const p = state.market.price[it.id];
          const relBps = (p * 10000n) / it.base_price;
          return `${it.id}:${relBps}`;
        })
        .join(" ");

      const stepStr = s.toString().padStart(4);
      const popStr = state.citizens.population.toString().padStart(3);
      const satStr = state.citizens.satisfaction_bps.toString().padStart(8);
      const purseStr = state.citizens.purse.toString().padStart(5);
      const treasStr = state.treasury.toString().padStart(5);
      const bizCoinStr = bizCoin.toString().padStart(7);
      const zeroProdStr = lastZeroProdCount.toString().padStart(6);

      console.log(
        `${stepStr} | ${popStr} | ${satStr} | ${purseStr} | ${treasStr} | ${bizCoinStr} | ${zeroProdStr} | ${priceRels}`
      );
    }
  }
}
