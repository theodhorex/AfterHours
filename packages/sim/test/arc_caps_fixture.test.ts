import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parseArc } from "../src/arc.ts";
import { arcCaps, type ArcCapsResult } from "../src/checkpoint.ts";

const root = process.cwd();

function sortKeys<T>(obj: T): T {
  if (Array.isArray(obj)) {
    return obj.map(sortKeys) as unknown as T;
  } else if (obj !== null && typeof obj === "object") {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      sorted[key] = sortKeys((obj as Record<string, unknown>)[key]);
    }
    return sorted as T;
  }
  return obj;
}

test("arc_caps_fixture: disk fixture is up to date with fresh in-process generation", () => {
  const fixturePath = join(root, "data/fixtures/arc_caps.json");
  const onDiskJson = readFileSync(fixturePath, "utf-8");
  const parsedDisk = JSON.parse(onDiskJson);

  const arcFiles = readdirSync(join(root, "data/arcs"))
    .filter((f) => f.endsWith(".json"))
    .sort();

  const arcsObj: Record<string, ArcCapsResult> = {};
  for (const file of arcFiles) {
    const raw = JSON.parse(readFileSync(join(root, "data/arcs", file), "utf-8"));
    const arc = parseArc(raw);
    arcsObj[arc.id] = arcCaps(arc);
  }

  const freshlyGenerated = JSON.stringify(sortKeys({ arcs: arcsObj }), null, 2) + "\n";
  assert.equal(onDiskJson, freshlyGenerated, "data/fixtures/arc_caps.json is out of date");

  // Asserts all four arcs are present
  const expectedArcs = ["cave_hold", "dino_vale", "elf_grove", "goblin_warrens"];
  const actualArcs = Object.keys(parsedDisk.arcs).sort();
  assert.deepEqual(actualArcs, expectedArcs);

  // Asserts every cap is a non-negative decimal string
  const decimalRegex = /^\d+$/;
  for (const arcId of expectedArcs) {
    const caps = parsedDisk.arcs[arcId] as ArcCapsResult;
    assert.ok(caps, `missing caps for ${arcId}`);
    assert.equal(caps.arc_id, arcId);

    assert.match(caps.coin_source_cap_per_step, decimalRegex, `${arcId} invalid coin_source_cap_per_step`);
    assert.match(caps.coin_sink_cap_per_step, decimalRegex, `${arcId} invalid coin_sink_cap_per_step`);

    const maps = [
      { name: "produce_cap_per_step", map: caps.produce_cap_per_step },
      { name: "consume_cap_per_step", map: caps.consume_cap_per_step },
      { name: "source_cap_per_step", map: caps.source_cap_per_step },
      { name: "sink_cap_per_step", map: caps.sink_cap_per_step },
    ];

    for (const { name, map } of maps) {
      assert.ok(map && typeof map === "object", `${arcId} missing map ${name}`);
      const itemKeys = Object.keys(map);
      assert.ok(itemKeys.length > 0, `${arcId} ${name} is empty`);
      for (const item of itemKeys) {
        assert.match(map[item], decimalRegex, `${arcId} ${name}[${item}] is not non-negative decimal`);
      }
    }
  }
});
