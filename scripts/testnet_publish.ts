/**
 * Publish a demo city to NEAR testnet through the near CLI (no npm dependencies).
 * Usage: node scripts/testnet_publish.ts <contractId> [--arc goblin_warrens] [--seed demo]
 * Needs: `pnpm demo:mock` run first (writes demo/checkpoints.json), and the operator key of
 * <contractId> in the legacy keychain (~/.near-credentials/testnet). TESTNET ONLY.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { parseArc } from "../packages/sim/src/arc.ts";
import { genesis } from "../packages/sim/src/genesis.ts";
import { arcCaps } from "../packages/sim/src/checkpoint.ts";
import { cityRoot, genesisPrevRoot } from "../packages/sim/src/roots.ts";

const root = process.cwd();
const args = process.argv.slice(2);
const contract = args[0];
if (!contract || !contract.endsWith(".testnet")) {
  console.error("usage: node scripts/testnet_publish.ts <contract>.testnet [--arc id] [--seed s]");
  process.exit(2);
}
const opt = (name: string, def: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : def;
};
const arcId = opt("--arc", "goblin_warrens");
const seed = opt("--seed", "demo");
const cityId = `city-${arcId}`;

function call(method: string, payload: unknown, label: string): string {
  const r = spawnSync("near", [
    "contract", "call-function", "as-transaction", contract, method,
    "json-args", JSON.stringify(payload),
    "prepaid-gas", "100 Tgas", "attached-deposit", "0 NEAR",
    "sign-as", contract, "network-config", "testnet", "sign-with-legacy-keychain", "send",
  ], { encoding: "utf-8" });
  const out = (r.stdout ?? "") + (r.stderr ?? "");
  const tx = /Transaction ID: (\S+)/.exec(out)?.[1] ?? "";
  const ok = r.status === 0 && !/Failed|panicked|Smart contract panicked/i.test(out);
  console.log(`${ok ? "OK  " : "FAIL"} ${label}${tx ? ` tx ${tx}` : ""}`);
  if (!ok) {
    console.log(out.split("\n").filter((l) => /panick|Error|error/i.test(l)).slice(0, 5).join("\n"));
    process.exit(1);
  }
  return tx;
}

const arc = parseArc(JSON.parse(readFileSync(join(root, "data/arcs", `${arcId}.json`), "utf-8")));
const g = genesis(arc, cityId, seed);
const txs: Record<string, string> = {};

const view = spawnSync("near", ["contract", "call-function", "as-read-only", contract, "get_arc",
  "json-args", JSON.stringify({ arc_id: arcId }), "network-config", "testnet", "now"], { encoding: "utf-8" });
if (!/produce_cap_per_step/.test((view.stdout ?? "") + (view.stderr ?? ""))) {
  txs.register_arc = call("register_arc", arcCaps(arc), `register_arc ${arcId}`);
} else console.log(`SKIP register_arc ${arcId} (already registered)`);

const totals: Record<string, string> = {};
for (const [k, v] of Object.entries(g.totals.items)) totals[k] = v.toString();
txs.create_city = call("create_city", {
  city_id: cityId, arc_id: arcId, server_id: "eldmark", owner: contract,
  state_root: genesisPrevRoot(cityId, seed), city_root: cityRoot(g),
  parent_root: null, totals_items: totals, total_coin: g.totals.coin.toString(),
}, `create_city ${cityId}`);

const cps = JSON.parse(readFileSync(join(root, "demo/checkpoints.json"), "utf-8"));
cps.forEach((cp: { from_step: number; to_step: number }, i: number) => {
  txs[`checkpoint_${i + 1}`] = call("submit_checkpoint", { cp }, `submit_checkpoint ${cp.from_step}..${cp.to_step}`);
});

const out = { network: "testnet", contract, city_id: cityId, arc_id: arcId, seed, txs };
writeFileSync(join(root, "demo/testnet.json"), JSON.stringify(out, null, 2) + "\n");
console.log(`\nWrote demo/testnet.json. Verify: node packages/verify/cli.ts (see README) against get_city_root.`);
