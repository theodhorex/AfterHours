import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { leaf, node, toHex, fromHex } from "../src/hash.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.resolve(__dirname, "../../../data/fixtures/hash_vectors.json");
const vectors = JSON.parse(fs.readFileSync(fixturePath, "utf-8"));

test("hash vectors: leaf hashes match Python-generated vectors", () => {
  const leafVectors = vectors.filter((v: { type: string }) => v.type === "leaf");
  assert.ok(leafVectors.length >= 10, "Expected at least 10 leaf vectors");

  for (const v of leafVectors) {
    const digest = leaf(v.input);
    const hex = toHex(digest);
    assert.equal(
      hex,
      v.hash,
      `Leaf hash mismatch for case '${v.name}'. Expected ${v.hash}, got ${hex}`
    );
  }
});

test("hash vectors: node hashes match Python-generated vectors", () => {
  const nodeVectors = vectors.filter((v: { type: string }) => v.type === "node");
  assert.ok(nodeVectors.length >= 3, "Expected at least 3 node vectors (1, 2, 3 leaves)");

  for (const v of nodeVectors) {
    const inputDigests = v.input_hashes.map((h: string) => fromHex(h));
    const digest = node(...inputDigests);
    const hex = toHex(digest);
    assert.equal(
      hex,
      v.hash,
      `Node hash mismatch for case '${v.name}'. Expected ${v.hash}, got ${hex}`
    );
  }
});

test("toHex and fromHex roundtrip and validate input", () => {
  const raw = new Uint8Array([0, 1, 2, 15, 16, 255]);
  const hex = toHex(raw);
  assert.equal(hex, "0001020f10ff");
  const recovered = fromHex(hex);
  assert.deepEqual(recovered, raw);

  // Odd length
  assert.throws(() => fromHex("123"), /even length/i);
  // Non-hex character
  assert.throws(() => fromHex("12zz"), /hex/i);
});
