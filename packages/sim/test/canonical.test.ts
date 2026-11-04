import test from "node:test";
import assert from "node:assert/strict";
import { canonicalJson } from "../src/canonical.ts";

test("canonicalJson rejects invalid types directly", () => {
  const rejected = [
    undefined,
    42,
    -10,
    3.14,
    NaN,
    Infinity,
    -Infinity,
    () => {},
    Symbol("sym"),
    new Map(),
    new Set(),
    new Date(),
  ];

  for (const item of rejected) {
    assert.throws(
      () => canonicalJson(item),
      `Expected canonicalJson to throw for ${String(item)}`
    );
  }
});

test("canonicalJson rejects invalid types inside objects and arrays", () => {
  assert.throws(() => canonicalJson({ valid: "ok", num: 42 }));
  assert.throws(() => canonicalJson({ undef: undefined }));
  assert.throws(() => canonicalJson({ fn: () => {} }));
  assert.throws(() => canonicalJson({ map: new Map() }));
  assert.throws(() => canonicalJson({ set: new Set() }));
  assert.throws(() => canonicalJson([10n, 42]));
  assert.throws(() => canonicalJson([undefined]));
  assert.throws(() => canonicalJson([() => {}]));
});

test("canonicalJson serializes primitives correctly", () => {
  assert.equal(canonicalJson(null), "null");
  assert.equal(canonicalJson(true), "true");
  assert.equal(canonicalJson(false), "false");
  assert.equal(canonicalJson("hello"), '"hello"');
  assert.equal(canonicalJson(""), '""');
  assert.equal(canonicalJson("héllo 🦊"), '"héllo 🦊"');
  assert.equal(canonicalJson(1200n), '"1200"');
  assert.equal(canonicalJson(0n), '"0"');
  assert.equal(canonicalJson(-42n), '"-42"');
});

test("canonicalJson preserves array order", () => {
  assert.equal(
    canonicalJson([1n, 2n, "three", null, true]),
    '["1","2","three",null,true]'
  );
  assert.equal(
    canonicalJson([2n, 1n]),
    '["2","1"]'
  );
});

test("canonicalJson sorts object keys by UTF-8 byte order", () => {
  const obj1 = { b: 2n, a: 1n };
  const obj2 = { a: 1n, b: 2n };
  assert.equal(canonicalJson(obj1), '{"a":"1","b":"2"}');
  assert.equal(canonicalJson(obj2), '{"a":"1","b":"2"}');
  assert.equal(canonicalJson(obj1), canonicalJson(obj2));

  const multiKey = { z: "last", a: "first", m: "mid", aa: "second" };
  assert.equal(
    canonicalJson(multiKey),
    '{"a":"first","aa":"second","m":"mid","z":"last"}'
  );
});

test("canonicalJson handles nested objects and arrays", () => {
  const nested = {
    z: { b: 2n, a: 1n },
    a: [null, { y: 1n, x: 2n }, true],
  };
  const expected = '{"a":[null,{"x":"2","y":"1"},true],"z":{"a":"1","b":"2"}}';
  assert.equal(canonicalJson(nested), expected);
});

test("property-based: key order independence across random permutations", () => {
  const keys = ["alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta", "theta"];
  const baseEntries: [string, bigint][] = keys.map((k, idx) => [k, BigInt(idx * 10)]);

  for (let seed = 0; seed < 20; seed++) {
    // Deterministic simple shuffle for the test
    const shuffled = [...baseEntries].sort((a, b) => {
      const hA = (a[0].charCodeAt(0) * 31 + seed) % 7;
      const hB = (b[0].charCodeAt(0) * 31 + seed) % 7;
      return hA - hB;
    });
    const obj: Record<string, bigint> = {};
    for (const [k, v] of shuffled) {
      obj[k] = v;
    }
    const serialized = canonicalJson(obj);
    const expected =
      '{"alpha":"0","beta":"10","delta":"30","epsilon":"40","eta":"60","gamma":"20","theta":"70","zeta":"50"}';
    assert.equal(serialized, expected);
  }
});
