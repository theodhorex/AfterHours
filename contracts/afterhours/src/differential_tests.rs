//! Differential tests: TypeScript vs Rust contracts (T25/T26).
//! Verifies arc caps match data/fixtures/arc_caps.json and checkpoint deserializes without loss.

use super::*;
use near_sdk::json_types::U128;
use near_sdk::test_utils::VMContextBuilder;
use near_sdk::{testing_env, AccountId, NearToken};
use std::collections::BTreeMap;

const ARC_CAPS_FIXTURE_JSON: &str = include_str!("../../../data/fixtures/arc_caps.json");
const CHECKPOINT_SAMPLE_JSON: &str = include_str!("../../../data/fixtures/checkpoint_sample.json");

#[near(serializers=[json])]
struct ArcCapsFixture {
    arcs: BTreeMap<String, ArcCaps>,
}

fn acc(s: &str) -> AccountId {
    s.parse().unwrap()
}

fn ctx(pred: &str) -> VMContextBuilder {
    let mut b = VMContextBuilder::new();
    b.current_account_id(acc("afterhours.testnet"))
        .predecessor_account_id(acc(pred))
        .signer_account_id(acc(pred))
        .attached_deposit(NearToken::from_yoctonear(0));
    b
}

fn set_caller(pred: &str) {
    testing_env!(ctx(pred).build());
}

#[test]
fn test_t25_register_all_arcs_matches_fixture() {
    let fixture: ArcCapsFixture =
        serde_json::from_str(ARC_CAPS_FIXTURE_JSON).expect("failed to deserialize arc_caps.json fixture");

    let expected_arc_ids = ["cave_hold", "dino_vale", "elf_grove", "goblin_warrens"];
    assert_eq!(fixture.arcs.len(), expected_arc_ids.len());

    set_caller("owner.testnet");
    let mut contract = AfterHours::new(acc("operator.testnet"));

    set_caller("operator.testnet");

    for arc_id in expected_arc_ids {
        let caps = fixture
            .arcs
            .get(arc_id)
            .unwrap_or_else(|| panic!("missing arc {arc_id} in fixture"));

        contract.register_arc(
            caps.arc_id.clone(),
            caps.produce_cap_per_step.clone(),
            caps.consume_cap_per_step.clone(),
            caps.source_cap_per_step.clone(),
            caps.sink_cap_per_step.clone(),
            caps.coin_source_cap_per_step,
            caps.coin_sink_cap_per_step,
        );

        let registered = contract
            .get_arc(arc_id.to_string())
            .unwrap_or_else(|| panic!("failed to read back registered arc {arc_id}"));

        // Direct struct equality (BTreeMap and U128 PartialEq)
        assert_eq!(&registered, caps, "registered ArcCaps struct differs from fixture for {arc_id}");

        // Field-by-field assertions for explicit verification
        assert_eq!(registered.arc_id, caps.arc_id);
        assert_eq!(registered.produce_cap_per_step, caps.produce_cap_per_step);
        assert_eq!(registered.consume_cap_per_step, caps.consume_cap_per_step);
        assert_eq!(registered.source_cap_per_step, caps.source_cap_per_step);
        assert_eq!(registered.sink_cap_per_step, caps.sink_cap_per_step);
        assert_eq!(registered.coin_source_cap_per_step, caps.coin_source_cap_per_step);
        assert_eq!(registered.coin_sink_cap_per_step, caps.coin_sink_cap_per_step);

        // Verify U128 numerical values
        for (item, u128_val) in &registered.produce_cap_per_step {
            assert_eq!(caps.produce_cap_per_step.get(item).map(|v| v.0), Some(u128_val.0));
        }
        for (item, u128_val) in &registered.consume_cap_per_step {
            assert_eq!(caps.consume_cap_per_step.get(item).map(|v| v.0), Some(u128_val.0));
        }
        for (item, u128_val) in &registered.source_cap_per_step {
            assert_eq!(caps.source_cap_per_step.get(item).map(|v| v.0), Some(u128_val.0));
        }
        for (item, u128_val) in &registered.sink_cap_per_step {
            assert_eq!(caps.sink_cap_per_step.get(item).map(|v| v.0), Some(u128_val.0));
        }
    }
}

#[test]
#[should_panic(expected = "DUPLICATE_ARC_ID")]
fn test_t25_register_duplicate_arc_panics() {
    let fixture: ArcCapsFixture =
        serde_json::from_str(ARC_CAPS_FIXTURE_JSON).expect("failed to deserialize arc_caps.json fixture");
    let caps = fixture.arcs.get("cave_hold").expect("cave_hold arc required");

    set_caller("owner.testnet");
    let mut contract = AfterHours::new(acc("operator.testnet"));

    set_caller("operator.testnet");

    contract.register_arc(
        caps.arc_id.clone(),
        caps.produce_cap_per_step.clone(),
        caps.consume_cap_per_step.clone(),
        caps.source_cap_per_step.clone(),
        caps.sink_cap_per_step.clone(),
        caps.coin_source_cap_per_step,
        caps.coin_sink_cap_per_step,
    );

    // Registering second time must panic DUPLICATE_ARC_ID
    contract.register_arc(
        caps.arc_id.clone(),
        caps.produce_cap_per_step.clone(),
        caps.consume_cap_per_step.clone(),
        caps.source_cap_per_step.clone(),
        caps.sink_cap_per_step.clone(),
        caps.coin_source_cap_per_step,
        caps.coin_sink_cap_per_step,
    );
}

#[test]
#[should_panic(expected = "UNAUTHORIZED_OPERATOR")]
fn test_t25_register_arc_non_operator_rejected() {
    let fixture: ArcCapsFixture =
        serde_json::from_str(ARC_CAPS_FIXTURE_JSON).expect("failed to deserialize arc_caps.json fixture");
    let caps = fixture.arcs.get("goblin_warrens").expect("goblin_warrens arc required");

    set_caller("owner.testnet");
    let mut contract = AfterHours::new(acc("operator.testnet"));

    // Stranger attempts to register arc
    set_caller("stranger.testnet");
    contract.register_arc(
        caps.arc_id.clone(),
        caps.produce_cap_per_step.clone(),
        caps.consume_cap_per_step.clone(),
        caps.source_cap_per_step.clone(),
        caps.sink_cap_per_step.clone(),
        caps.coin_source_cap_per_step,
        caps.coin_sink_cap_per_step,
    );
}

#[test]
fn test_t26_checkpoint_sample_serde_round_trip() {
    let cp: Checkpoint = serde_json::from_str(CHECKPOINT_SAMPLE_JSON)
        .expect("data/fixtures/checkpoint_sample.json should deserialize cleanly into Checkpoint");

    assert_eq!(cp.city_id, "city-goblin_warrens");
    assert_eq!(cp.from_step, 0);
    assert_eq!(cp.to_step, 40);
    assert_eq!(cp.stage, 0);
    assert!(!cp.items.is_empty());

    // Round-trip through JSON string
    let serialized = serde_json::to_string(&cp).expect("Checkpoint should serialize to JSON");
    let round_trip_cp: Checkpoint = serde_json::from_str(&serialized)
        .expect("Serialized checkpoint should deserialize back to Checkpoint");

    assert_eq!(cp, round_trip_cp, "Round trip Checkpoint must equal original");

    // Value level comparison: verifies TS JSON shape equals Rust struct without data loss
    let orig_value: serde_json::Value =
        serde_json::from_str(CHECKPOINT_SAMPLE_JSON).expect("valid JSON in fixture");
    let serialized_value: serde_json::Value =
        serde_json::to_value(&cp).expect("Checkpoint serializes to Value");

    assert_eq!(orig_value, serialized_value, "Original fixture JSON Value must equal struct JSON Value");
}

#[test]
fn test_t26_checkpoint_with_deltas_and_orders_round_trip() {
    // Checkpoint with non-empty player deltas and executed orders
    let json_with_orders = serde_json::json!({
        "city_id": "city-goblin_warrens",
        "from_step": 40,
        "to_step": 80,
        "new_state_root": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        "new_city_root": "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210",
        "stage": 1,
        "items": {
            "bread": {
                "produced": "100",
                "consumed_recipe": "20",
                "consumed_pop": "30",
                "sourced": "5",
                "sunk": "2",
                "trade_to_players": "15",
                "trade_from_players": "10"
            }
        },
        "coin": {
            "sourced": "50",
            "sunk": "10",
            "trade_to_players": "25",
            "trade_from_players": "15"
        },
        "player_deltas": [
            {
                "account": "alice.testnet",
                "token_id": "bread",
                "delta_in": "15",
                "delta_out": "10"
            },
            {
                "account": "bob.testnet",
                "token_id": "coin",
                "delta_in": "25",
                "delta_out": "15"
            }
        ],
        "executed_order_ids": ["ord_101", "ord_102"]
    });

    let raw_str = serde_json::to_string(&json_with_orders).unwrap();
    let cp: Checkpoint = serde_json::from_str(&raw_str).expect("should deserialize checkpoint with deltas");

    assert_eq!(cp.player_deltas.len(), 2);
    assert_eq!(cp.executed_order_ids, vec!["ord_101".to_string(), "ord_102".to_string()]);
    assert_eq!(cp.player_deltas[0].account, acc("alice.testnet"));
    assert_eq!(cp.player_deltas[0].token_id, "bread");
    assert_eq!(cp.player_deltas[0].delta_in, U128(15));
    assert_eq!(cp.player_deltas[0].delta_out, U128(10));

    let round_val: serde_json::Value = serde_json::to_value(&cp).unwrap();
    assert_eq!(json_with_orders, round_val);
}
