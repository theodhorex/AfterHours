#!/usr/bin/env python3
"""
Generate independent test vectors for leaf and node SHA-256 hashing.
Uses ONLY Python standard library (hashlib and json), independent of TypeScript.
"""

import hashlib
import json
import os

def canonical_json(val):
    return json.dumps(val, sort_keys=True, separators=(',', ':'), ensure_ascii=False)

def leaf_hash(val) -> tuple[str, str]:
    c = canonical_json(val)
    digest = hashlib.sha256(c.encode('utf-8')).hexdigest()
    return c, digest

def node_hash(hex_hashes: list[str]) -> str:
    raw_cat = b''.join(bytes.fromhex(h) for h in hex_hashes)
    return hashlib.sha256(raw_cat).hexdigest()

def main():
    cases = []

    # 1. Simple string
    c, h = leaf_hash("hello world")
    cases.append({
        "name": "simple_string",
        "type": "leaf",
        "input": "hello world",
        "canonical": c,
        "hash": h
    })

    # 2. Unicode string with emojis and non-ascii
    c, h = leaf_hash("AfterHours ⚔️ 🏰 룬")
    cases.append({
        "name": "unicode_string",
        "type": "leaf",
        "input": "AfterHours ⚔️ 🏰 룬",
        "canonical": c,
        "hash": h
    })

    # 3. Null primitive
    c, h = leaf_hash(None)
    cases.append({
        "name": "null_value",
        "type": "leaf",
        "input": None,
        "canonical": c,
        "hash": h
    })

    # 4. Boolean primitive
    c, h = leaf_hash(True)
    cases.append({
        "name": "boolean_true",
        "type": "leaf",
        "input": True,
        "canonical": c,
        "hash": h
    })

    # 5. Empty object
    c, h = leaf_hash({})
    cases.append({
        "name": "empty_object",
        "type": "leaf",
        "input": {},
        "canonical": c,
        "hash": h
    })

    # 6. Object with bigint-as-string
    c, h = leaf_hash({"coin": "1200", "step": "0"})
    cases.append({
        "name": "object_bigint_strings",
        "type": "leaf",
        "input": {"coin": "1200", "step": "0"},
        "canonical": c,
        "hash": h
    })

    # 7. Object with unsorted keys and multiple types
    c, h = leaf_hash({"z": "last", "a": "1", "m": "middle", "b": None})
    cases.append({
        "name": "unsorted_keys_object",
        "type": "leaf",
        "input": {"z": "last", "a": "1", "m": "middle", "b": None},
        "canonical": c,
        "hash": h
    })

    # 8. Empty array
    c, h = leaf_hash([])
    cases.append({
        "name": "empty_array",
        "type": "leaf",
        "input": [],
        "canonical": c,
        "hash": h
    })

    # 9. Simple array keeping order
    c, h = leaf_hash(["1", "2", "3", "test", None, False])
    cases.append({
        "name": "array_preserved_order",
        "type": "leaf",
        "input": ["1", "2", "3", "test", None, False],
        "canonical": c,
        "hash": h
    })

    # 10. Nested object with array and bigint strings
    c, h = leaf_hash({
        "citizens": {"population": "220", "purse": "2200"},
        "tags": ["camp", "hold"]
    })
    cases.append({
        "name": "nested_object_with_array",
        "type": "leaf",
        "input": {
            "citizens": {"population": "220", "purse": "2200"},
            "tags": ["camp", "hold"]
        },
        "canonical": c,
        "hash": h
    })

    # 11. Complex city state slice
    c, h = leaf_hash({
        "city_id": "cave_hold",
        "stage": "0",
        "treasury": "5000",
        "sectors": [
            {"idx": "0", "kind": "food"},
            {"idx": "1", "kind": "ore"}
        ]
    })
    cases.append({
        "name": "city_state_slice",
        "type": "leaf",
        "input": {
            "city_id": "cave_hold",
            "stage": "0",
            "treasury": "5000",
            "sectors": [
                {"idx": "0", "kind": "food"},
                {"idx": "1", "kind": "ore"}
            ]
        },
        "canonical": c,
        "hash": h
    })

    # 12. Node hash of 1 leaf
    leaf_6_h = cases[5]["hash"]
    h_node1 = node_hash([leaf_6_h])
    cases.append({
        "name": "node_1_leaf",
        "type": "node",
        "input_hashes": [leaf_6_h],
        "hash": h_node1
    })

    # 13. Node hash of 2 leaves
    leaf_7_h = cases[6]["hash"]
    h_node2 = node_hash([leaf_6_h, leaf_7_h])
    cases.append({
        "name": "node_2_leaves",
        "type": "node",
        "input_hashes": [leaf_6_h, leaf_7_h],
        "hash": h_node2
    })

    # 14. Node hash of 3 leaves
    leaf_1_h = cases[0]["hash"]
    leaf_2_h = cases[1]["hash"]
    leaf_10_h = cases[9]["hash"]
    h_node3 = node_hash([leaf_1_h, leaf_2_h, leaf_10_h])
    cases.append({
        "name": "node_3_leaves",
        "type": "node",
        "input_hashes": [leaf_1_h, leaf_2_h, leaf_10_h],
        "hash": h_node3
    })

    out_path = os.path.join(os.path.dirname(__file__), "..", "data", "fixtures", "hash_vectors.json")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(cases, f, indent=2, ensure_ascii=False)
    print(f"Wrote {len(cases)} vectors to {out_path}")

if __name__ == "__main__":
    main()
