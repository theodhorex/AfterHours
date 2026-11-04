/**
 * Publish the four demo cities and their checkpoints to NEAR testnet through the near CLI (no npm deps).
 * Usage: node scripts/testnet_publish.ts <contractId>.testnet [--steps 200] [--seed demo] [--arcs a,b,c]
 * Needs the operator key of <contractId> in the legacy keychain (~/.near-credentials/testnet). TESTNET ONLY.
 * Cities are independent (no caravans), so each one verifies with the single-city replay.
 * Writes demo/testnet.json (the demo/ folder is git-ignored; copy the table into README / notes).
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { genesis } from "../packages/sim/src/genesis.ts";
import { arcCaps } from "../packages/sim/src/checkpoint.ts";
import { cityRoot, genesisPrevRoot } from "../packages/sim/src/roots.ts";
import { runWorld } from "../packages/sim/src/world.ts";
import { loadWorldData } from "../packages/sim/src/world-node.ts";

const root = process.cwd();
const args = process.argv.slice(2);
const contract = args[0];
if (!contract || !contract.endsWith(".testnet")) {
  console.error("usage: node scripts/testnet_publish.ts <contract>.testnet [--steps 200] [--seed demo] [--arcs goblin_warrens,cave_hold,dino_vale,elf_grove]");
  process.exit(2);
}
const opt = (name: string, def: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : def;
};
const seed = opt("--seed", "demo");
const steps = Number(opt("--steps", "200"));
const window = 40;
const arcIds = opt("--arcs", "goblin_warrens,cave_hold,dino_vale,elf_grove").split(",");
const SERVER: Record<string, string> = {
  goblin_warrens: "eldmark",
  cave_hold: "eldmark",
  dino_vale: "tarn",
  elf_grove: "tarn",
};

function near(argv: string[]): { ok: boolean; out: string } {
  const r = spawnSync("near", argv, { encoding: "utf-8" });
  return { ok: r.status === 0, out: (r.stdout ?? "") + (r.stderr ?? "") };
}

function call(method: string, payload: unknown, label: string): string {
  const { ok, out } = near([
    "contract", "call-function", "as-transaction", contract, method,
    "json-args", JSON.stringify(payload),
    "prepaid-gas", "100 Tgas", "attached-deposit", "0 NEAR",
    "sign-as", contract, "network-config", "testnet", "sign-with-legacy-keychain", "send",
  ]);
  const tx = /Transaction ID: (\S+)/.exec(out)?.[1] ?? "";
  const failed = !ok || /Smart contract panicked|Failed/i.test(out);
  console.log(`${failed ? "FAIL" : "OK  "} ${label}${tx ? ` tx ${tx}` : ""}`);
  if (failed) {
    console.log(out.split("\n").filter((l) => /panick|rror/.test(l)).slice(0, 5).join("\n"));
    process.exit(1);
  }
  return tx;
}

function isRegistered(arcId: string): boolean {
  const { out } = near(["contract", "call-function", "as-read-only", contract, "get_arc",
    "json-args", JSON.stringify({ arc_id: arcId }), "network-config", "testnet", "now"]);
  // The CLI echoes the command; only the caps map proves registration.
  return /"produce_cap_per_step"/.test(out.split("Here is your console command")[0]);
}

const data = loadWorldData(join(root, "data"));
const cities = arcIds.map((arcId) => ({ cityId: `city-${arcId}`, arcId, seed }));
const world = runWorld({ cities, steps, window, pricing: data.pricing, growth: data.growth, arcs: data.arcs });

const result: Record<string, unknown> = {};
for (const c of cities) {
  const arc = data.arcs[c.arcId];
  const txs: Record<string, string> = {};
  if (isRegistered(c.arcId)) console.log(`SKIP register_arc ${c.arcId} (already registered)`);
  else txs.register_arc = call("register_arc", arcCaps(arc), `register_arc ${c.arcId}`);

  const g = genesis(arc, c.cityId, seed);
  const totals: Record<string, string> = {};
  for (const [k, v] of Object.entries(g.totals.items)) totals[k] = v.toString();
  txs.create_city = call("create_city", {
    city_id: c.cityId, arc_id: c.arcId, server_id: SERVER[c.arcId] ?? "eldmark", owner: contract,
    state_root: genesisPrevRoot(c.cityId, seed), city_root: cityRoot(g),
    parent_root: null, totals_items: totals, total_coin: g.totals.coin.toString(),
  }, `create_city ${c.cityId}`);

  for (const cp of world.checkpoints[c.cityId]) {
    txs[`checkpoint_${cp.from_step}_${cp.to_step}`] = call("submit_checkpoint", { cp }, `${c.cityId} checkpoint ${cp.from_step}..${cp.to_step}`);
  }
  const last = world.checkpoints[c.cityId].at(-1)!;
  result[c.cityId] = { arc_id: c.arcId, seed, steps, final_state_root: last.new_state_root, txs };
}

mkdirSync(join(root, "demo"), { recursive: true });
writeFileSync(join(root, "demo/testnet.json"), JSON.stringify({ network: "testnet", contract, cities: result }, null, 2) + "\n");
console.log(`\nWrote demo/testnet.json (${cities.length} cities, ${steps} steps). Verify roots with: near contract call-function as-read-only ${contract} get_city json-args '{"city_id":"city-goblin_warrens"}' network-config testnet now`);
