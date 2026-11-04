#!/usr/bin/env python3
"""
Generate independent test vectors for Merkle roots per docs/data-contract.md section 9.
Uses ONLY Python standard library (hashlib and json), independent of TypeScript.
"""

import hashlib
import json
import os

def canonical_json(val):
    return json.dumps(val, sort_keys=True, separators=(',', ':'), ensure_ascii=False)

def leaf_hash(val) -> str:
    c = canonical_json(val)
    return hashlib.sha256(c.encode('utf-8')).hexdigest()

def node_hash(hex_hashes: list[str]) -> str:
    raw_cat = b''.join(bytes.fromhex(h) for h in hex_hashes)
    return hashlib.sha256(raw_cat).hexdigest()

def main():
    state = {
        "city_id": "vector_haven",
        "arc_id": "cave_hold",
        "step": "0",
        "world_seed": "vector_seed_999",
        "stage": "0",
        "sectors": [
            {
                "idx": "0",
                "kind": "food",
                "owner": None,
                "arc_origin": "cave_hold",
                "businesses": [
                    {
                        "id": "bakery-0",
                        "recipe": "bakery",
                        "open": True,
                        "coin": "300",
                        "inventory": {"bread": "10"},
                        "insolvent_steps": "0"
                    },
                    {
                        "id": "farm-0",
                        "recipe": "farm",
                        "open": True,
                        "coin": "250",
                        "inventory": {},
                        "insolvent_steps": "0"
                    }
                ],
                "rules": []
            },
            {
                "idx": "1",
                "kind": "ore",
                "owner": None,
                "arc_origin": "cave_hold",
                "businesses": [
                    {
                        "id": "mine-0",
                        "recipe": "mine",
                        "open": True,
                        "coin": "300",
                        "inventory": {"ore": "5"},
                        "insolvent_steps": "0"
                    }
                ],
                "rules": []
            },
            {
                "idx": "2",
                "kind": "forge",
                "owner": None,
                "arc_origin": "cave_hold",
                "businesses": [],
                "rules": []
            },
            {
                "idx": "3",
                "kind": "alchemy",
                "owner": None,
                "arc_origin": "cave_hold",
                "businesses": [],
                "rules": []
            },
            {
                "idx": "4",
                "kind": "harbor",
                "owner": "lord_aldric",
                "arc_origin": "cave_hold",
                "businesses": [
                    {
                        "id": "fisher-0",
                        "recipe": "fisher",
                        "open": False,
                        "coin": "100",
                        "inventory": {"fish": "20"},
                        "insolvent_steps": "1"
                    }
                ],
                "rules": []
            },
            {
                "idx": "5",
                "kind": "tower",
                "owner": None,
                "arc_origin": "cave_hold",
                "businesses": [],
                "rules": []
            }
        ],
        "citizens": {
            "population": "220",
            "satisfaction_bps": "8000",
            "purse": "2200"
        },
        "market": {
            "price": {
                "bread": "13",
                "fish": "10",
                "ore": "12"
            },
            "demand_ema": {
                "bread": "0",
                "fish": "0",
                "ore": "0"
            }
        },
        "treasury": "0",
        "totals": {
            "items": {
                "bread": "10",
                "fish": "20",
                "ore": "5"
            },
            "coin": "3150"
        }
    }

    # Merkle root computation per section 9
    sector_roots = []
    businesses_roots = []

    for sector in state["sectors"]:
        # business_leaf = leaf(Business)
        sorted_b = sorted(sector["businesses"], key=lambda b: b["id"])
        b_leaves = [leaf_hash(b) for b in sorted_b]
        b_root = node_hash(b_leaves)
        businesses_roots.append(b_root)

        # sector_leaf = leaf({idx, kind, owner, arc_origin, rules, businesses_root})
        s_leaf_obj = {
            "idx": sector["idx"],
            "kind": sector["kind"],
            "owner": sector["owner"],
            "arc_origin": sector["arc_origin"],
            "rules": sector["rules"],
            "businesses_root": b_root
        }
        sector_roots.append(leaf_hash(s_leaf_obj))

    # city_core = leaf({city_id, arc_id, step, stage, citizens, market, treasury, totals})
    city_core = leaf_hash({
        "city_id": state["city_id"],
        "arc_id": state["arc_id"],
        "step": state["step"],
        "stage": state["stage"],
        "citizens": state["citizens"],
        "market": state["market"],
        "treasury": state["treasury"],
        "totals": state["totals"]
    })

    # city_root = H(sector_root_0, ..., sector_root_5, city_core)
    city_root = node_hash(sector_roots + [city_core])

    output = {
        "state": state,
        "businesses_roots": businesses_roots,
        "sector_roots": sector_roots,
        "city_core": city_core,
        "city_root": city_root
    }

    out_path = os.path.join(os.path.dirname(__file__), "..", "data", "fixtures", "root_vectors.json")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    print(f"Wrote root vectors to {out_path}")
    print(f"City root: {city_root}")

if __name__ == "__main__":
    main()
