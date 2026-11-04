//! Unit tests for AfterHours contract.
use super::*;
use near_sdk::json_types::U128;
use near_sdk::test_utils::{get_logs, VMContextBuilder};
use near_sdk::{testing_env, AccountId, NearToken};

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

fn set_caller_with_deposit(pred: &str, yocto: u128) {
    testing_env!(ctx(pred).attached_deposit(NearToken::from_yoctonear(yocto)).build());
}

fn register_account(contract: &mut AfterHours, acc_id: &str) {
    set_caller_with_deposit(acc_id, constants::STORAGE_DEPOSIT_MIN.as_yoctonear());
    contract.storage_deposit(None);
}

#[test]
fn test_constants() {
    assert_eq!(constants::MAX_STEPS_PER_CHECKPOINT, 40);
    assert_eq!(constants::MAX_ORDER_IDS_PER_CHECKPOINT, 256);
    assert_eq!(constants::MAX_STAGE, 4);
    assert_eq!(constants::STORAGE_DEPOSIT_MIN.as_yoctonear(), 10_000_000_000_000_000_000_000);
}

#[test]
fn test_init_and_get_operator() {
    set_caller("alice.testnet");
    let contract = AfterHours::new(acc("operator.testnet"));
    assert_eq!(contract.get_operator(), acc("operator.testnet"));
    assert_eq!(contract.owner, acc("alice.testnet"));
}

#[test]
fn test_set_operator_by_owner() {
    set_caller("alice.testnet");
    let mut contract = AfterHours::new(acc("operator.testnet"));

    // Owner changes operator
    contract.set_operator(acc("operator2.testnet"));
    assert_eq!(contract.get_operator(), acc("operator2.testnet"));

    // Verify NEP-297 event
    let logs = get_logs();
    assert!(!logs.is_empty());
    let last_log = logs.last().unwrap();
    assert!(last_log.starts_with("EVENT_JSON:"));
    assert!(last_log.contains("\"standard\":\"afterhours\""));
    assert!(last_log.contains("\"event\":\"set_operator\""));
    assert!(last_log.contains("operator2.testnet"));
}

#[test]
#[should_panic(expected = "UNAUTHORIZED_OWNER")]
fn test_set_operator_unauthorized() {
    set_caller("alice.testnet");
    let mut contract = AfterHours::new(acc("operator.testnet"));

    // Stranger tries to change operator
    set_caller("stranger.testnet");
    contract.set_operator(acc("stranger.testnet"));
}

#[test]
fn test_mt_transfer_happy_path() {
    set_caller("alice.testnet");
    let mut contract = AfterHours::new(acc("operator.testnet"));
    register_account(&mut contract, "bob.testnet");

    contract.mint_internal(&acc("alice.testnet"), "bread", 50);
    contract.mint_internal(&acc("alice.testnet"), "coin", 100);

    set_caller_with_deposit("alice.testnet", 1);
    contract.mt_transfer(
        acc("bob.testnet"),
        "bread".to_string(),
        U128(20),
        None,
        Some("gift".to_string()),
    );

    assert_eq!(contract.mt_balance_of(acc("alice.testnet"), "bread".to_string()), U128(30));
    assert_eq!(contract.mt_balance_of(acc("bob.testnet"), "bread".to_string()), U128(20));

    // Verify events: both afterhours and nep245 mt_transfer
    let logs = get_logs();
    assert!(logs.iter().any(|l| l.contains("\"event\":\"mt_transfer\"") && l.contains("\"standard\":\"afterhours\"")));
    assert!(logs.iter().any(|l| l.contains("\"event\":\"mt_transfer\"") && l.contains("\"standard\":\"nep245\"")));
}

#[test]
#[should_panic(expected = "REQUIRES_EXACTLY_1_YOCTO")]
fn test_mt_transfer_0_yocto_fails() {
    set_caller("alice.testnet");
    let mut contract = AfterHours::new(acc("operator.testnet"));
    contract.mint_internal(&acc("alice.testnet"), "bread", 50);

    set_caller_with_deposit("alice.testnet", 0);
    contract.mt_transfer(acc("bob.testnet"), "bread".to_string(), U128(10), None, None);
}

#[test]
#[should_panic(expected = "REQUIRES_EXACTLY_1_YOCTO")]
fn test_mt_transfer_2_yocto_fails() {
    set_caller("alice.testnet");
    let mut contract = AfterHours::new(acc("operator.testnet"));
    contract.mint_internal(&acc("alice.testnet"), "bread", 50);

    set_caller_with_deposit("alice.testnet", 2);
    contract.mt_transfer(acc("bob.testnet"), "bread".to_string(), U128(10), None, None);
}

#[test]
#[should_panic(expected = "SELF_TRANSFER")]
fn test_mt_transfer_self_fails() {
    set_caller("alice.testnet");
    let mut contract = AfterHours::new(acc("operator.testnet"));
    contract.mint_internal(&acc("alice.testnet"), "bread", 50);

    set_caller_with_deposit("alice.testnet", 1);
    contract.mt_transfer(acc("alice.testnet"), "bread".to_string(), U128(10), None, None);
}

#[test]
#[should_panic(expected = "ZERO_AMOUNT")]
fn test_mt_transfer_zero_fails() {
    set_caller("alice.testnet");
    let mut contract = AfterHours::new(acc("operator.testnet"));
    contract.mint_internal(&acc("alice.testnet"), "bread", 50);

    set_caller_with_deposit("alice.testnet", 1);
    contract.mt_transfer(acc("bob.testnet"), "bread".to_string(), U128(0), None, None);
}

#[test]
#[should_panic(expected = "INSUFFICIENT_BALANCE")]
fn test_mt_transfer_insufficient_fails() {
    set_caller("alice.testnet");
    let mut contract = AfterHours::new(acc("operator.testnet"));
    register_account(&mut contract, "bob.testnet");
    contract.mint_internal(&acc("alice.testnet"), "bread", 50);

    set_caller_with_deposit("alice.testnet", 1);
    contract.mt_transfer(acc("bob.testnet"), "bread".to_string(), U128(51), None, None);
}

#[test]
#[allow(deprecated)]
#[should_panic(expected = "INVALID_RECEIVER_ID")]
fn test_mt_transfer_invalid_receiver_fails() {
    set_caller("alice.testnet");
    let mut contract = AfterHours::new(acc("operator.testnet"));
    contract.mint_internal(&acc("alice.testnet"), "bread", 50);

    set_caller_with_deposit("alice.testnet", 1);
    let invalid_acc = AccountId::new_unvalidated("INVALID_RECEIVER!".to_string());
    contract.mt_transfer(invalid_acc, "bread".to_string(), U128(10), None, None);
}

#[test]
fn test_mt_batch_transfer_happy_path() {
    set_caller("alice.testnet");
    let mut contract = AfterHours::new(acc("operator.testnet"));
    register_account(&mut contract, "bob.testnet");
    contract.mint_internal(&acc("alice.testnet"), "bread", 50);
    contract.mint_internal(&acc("alice.testnet"), "coin", 100);

    set_caller_with_deposit("alice.testnet", 1);
    contract.mt_batch_transfer(
        acc("bob.testnet"),
        vec!["bread".to_string(), "coin".to_string()],
        vec![U128(15), U128(40)],
        None,
        Some("batch gift".to_string()),
    );

    assert_eq!(contract.mt_balance_of(acc("alice.testnet"), "bread".to_string()), U128(35));
    assert_eq!(contract.mt_balance_of(acc("alice.testnet"), "coin".to_string()), U128(60));
    assert_eq!(contract.mt_balance_of(acc("bob.testnet"), "bread".to_string()), U128(15));
    assert_eq!(contract.mt_balance_of(acc("bob.testnet"), "coin".to_string()), U128(40));

    let batch_res = contract.mt_batch_balance_of(acc("bob.testnet"), vec!["bread".to_string(), "coin".to_string()]);
    assert_eq!(batch_res, vec![U128(15), U128(40)]);
}

#[test]
#[should_panic(expected = "MISMATCHED_LENGTHS")]
fn test_mt_batch_transfer_mismatched_lengths() {
    set_caller("alice.testnet");
    let mut contract = AfterHours::new(acc("operator.testnet"));
    register_account(&mut contract, "bob.testnet");
    contract.mint_internal(&acc("alice.testnet"), "bread", 50);

    set_caller_with_deposit("alice.testnet", 1);
    contract.mt_batch_transfer(
        acc("bob.testnet"),
        vec!["bread".to_string(), "coin".to_string()],
        vec![U128(10)],
        None,
        None,
    );
}

#[test]
fn test_mt_views_and_internal_mint_burn() {
    set_caller("alice.testnet");
    let mut contract = AfterHours::new(acc("operator.testnet"));

    assert_eq!(contract.mt_supply("bread".to_string()), None);

    contract.mint_internal(&acc("alice.testnet"), "bread", 100);
    assert_eq!(contract.mt_supply("bread".to_string()), Some(U128(100)));
    assert_eq!(contract.mt_balance_of(acc("alice.testnet"), "bread".to_string()), U128(100));

    let tokens = contract.mt_tokens_for_owner(acc("alice.testnet"), None, None);
    assert_eq!(tokens, vec!["bread".to_string()]);

    contract.mint_internal(&acc("alice.testnet"), "coin", 200);
    let tokens2 = contract.mt_tokens_for_owner(acc("alice.testnet"), None, Some(1));
    assert_eq!(tokens2.len(), 1);

    contract.burn_internal(&acc("alice.testnet"), "bread", 40);
    assert_eq!(contract.mt_supply("bread".to_string()), Some(U128(60)));
    assert_eq!(contract.mt_balance_of(acc("alice.testnet"), "bread".to_string()), U128(60));

    // Burn remaining bread
    contract.burn_internal(&acc("alice.testnet"), "bread", 60);
    assert_eq!(contract.mt_balance_of(acc("alice.testnet"), "bread".to_string()), U128(0));
    let tokens_after = contract.mt_tokens_for_owner(acc("alice.testnet"), None, None);
    assert_eq!(tokens_after, vec!["coin".to_string()]);
}

#[test]
#[should_panic(expected = "RECEIVER_NOT_REGISTERED")]
fn test_mt_transfer_unregistered_receiver_fails() {
    set_caller("alice.testnet");
    let mut contract = AfterHours::new(acc("operator.testnet"));
    contract.mint_internal(&acc("alice.testnet"), "bread", 50);

    set_caller_with_deposit("alice.testnet", 1);
    contract.mt_transfer(acc("unregistered.testnet"), "bread".to_string(), U128(10), None, None);
}

#[test]
#[should_panic(expected = "RECEIVER_NOT_REGISTERED")]
fn test_mt_batch_transfer_unregistered_receiver_fails() {
    set_caller("alice.testnet");
    let mut contract = AfterHours::new(acc("operator.testnet"));
    contract.mint_internal(&acc("alice.testnet"), "bread", 50);

    set_caller_with_deposit("alice.testnet", 1);
    contract.mt_batch_transfer(
        acc("unregistered.testnet"),
        vec!["bread".to_string()],
        vec![U128(10)],
        None,
        None,
    );
}

#[test]
fn test_mt_transfer_registered_receiver_accepted() {
    set_caller("alice.testnet");
    let mut contract = AfterHours::new(acc("operator.testnet"));
    contract.mint_internal(&acc("alice.testnet"), "bread", 50);

    register_account(&mut contract, "bob.testnet");
    assert!(contract.is_registered(&acc("bob.testnet")));

    set_caller_with_deposit("alice.testnet", 1);
    contract.mt_transfer(acc("bob.testnet"), "bread".to_string(), U128(10), None, None);
    assert_eq!(contract.mt_balance_of(acc("bob.testnet"), "bread".to_string()), U128(10));
}

#[test]
#[should_panic(expected = "DEPOSIT_LESS_THAN_MIN")]
fn test_storage_deposit_below_min_rejected() {
    set_caller("bob.testnet");
    let mut contract = AfterHours::new(acc("operator.testnet"));

    set_caller_with_deposit("bob.testnet", 5_000_000_000_000_000_000_000);
    contract.storage_deposit(None);
}

#[test]
fn test_storage_deposit_excess_refunded() {
    use near_sdk::test_utils::get_created_receipts;

    set_caller("alice.testnet");
    let mut contract = AfterHours::new(acc("operator.testnet"));

    set_caller_with_deposit("alice.testnet", 50_000_000_000_000_000_000_000);
    let bal = contract.storage_deposit(Some(acc("bob.testnet")));
    assert_eq!(bal.total, U128(constants::STORAGE_DEPOSIT_MIN.as_yoctonear()));
    assert_eq!(bal.available, U128(0));

    assert!(contract.is_registered(&acc("bob.testnet")));
    assert_eq!(
        contract.storage_balance_of(acc("bob.testnet")),
        Some(StorageBalance {
            total: U128(constants::STORAGE_DEPOSIT_MIN.as_yoctonear()),
            available: U128(0),
        })
    );

    let bounds = contract.storage_balance_bounds();
    assert_eq!(bounds.min, U128(constants::STORAGE_DEPOSIT_MIN.as_yoctonear()));
    assert_eq!(bounds.max, Some(U128(constants::STORAGE_DEPOSIT_MIN.as_yoctonear())));

    let receipts = get_created_receipts();
    assert!(!receipts.is_empty());
    let refund_receipt = receipts.iter().find(|r| r.receiver_id == acc("alice.testnet")).expect("Refund receipt not found");
    let refund_action = refund_receipt.actions.iter().find(|a| matches!(a, near_sdk::mock::MockAction::Transfer { deposit, .. } if deposit.as_yoctonear() == 40_000_000_000_000_000_000_000));
    assert!(refund_action.is_some(), "Expected refund transfer action of 0.04 NEAR");
}

#[test]
fn test_storage_deposit_double_registration_refunds_all() {
    use near_sdk::test_utils::get_created_receipts;

    set_caller("alice.testnet");
    let mut contract = AfterHours::new(acc("operator.testnet"));

    set_caller_with_deposit("bob.testnet", constants::STORAGE_DEPOSIT_MIN.as_yoctonear());
    contract.storage_deposit(None);
    assert!(contract.is_registered(&acc("bob.testnet")));

    set_caller_with_deposit("carol.testnet", 20_000_000_000_000_000_000_000);
    let bal2 = contract.storage_deposit(Some(acc("bob.testnet")));
    assert_eq!(bal2.total, U128(constants::STORAGE_DEPOSIT_MIN.as_yoctonear()));

    let receipts = get_created_receipts();
    let carol_receipt = receipts.iter().find(|r| r.receiver_id == acc("carol.testnet")).expect("Carol refund receipt not found");
    let refund_action = carol_receipt.actions.iter().find(|a| matches!(a, near_sdk::mock::MockAction::Transfer { deposit, .. } if deposit.as_yoctonear() == 20_000_000_000_000_000_000_000));
    assert!(refund_action.is_some(), "Expected full refund of 0.02 NEAR to carol");
}

#[test]
fn test_mt_supply_conservation_random_transfers() {
    set_caller("alice.testnet");
    let mut contract = AfterHours::new(acc("operator.testnet"));

    let accounts = [acc("alice.testnet"), acc("bob.testnet"), acc("carol.testnet")];
    for a in &accounts {
        register_account(&mut contract, a.as_str());
    }
    contract.mint_internal(&accounts[0], "coin", 10_000);
    contract.mint_internal(&accounts[1], "bread", 5_000);

    // Simple LCG PRNG for deterministic test
    let mut seed: u64 = 0xdeadbeef12345678;
    let next_rand = |s: &mut u64| -> u64 {
        *s = s.wrapping_mul(6364136223846793005).wrapping_add(1);
        *s
    };

    for _ in 0..100 {
        let r = next_rand(&mut seed);
        let from_idx = (r % 3) as usize;
        let mut to_idx = ((r >> 8) % 3) as usize;
        if from_idx == to_idx {
            to_idx = (to_idx + 1) % 3;
        }

        let token_id = if (r >> 16) % 2 == 0 { "coin" } else { "bread" };
        let from_bal = contract.mt_balance_of(accounts[from_idx].clone(), token_id.to_string()).0;
        if from_bal > 0 {
            let amount = 1 + ((r >> 24) as u128 % from_bal);
            set_caller_with_deposit(accounts[from_idx].as_str(), 1);
            contract.mt_transfer(
                accounts[to_idx].clone(),
                token_id.to_string(),
                U128(amount),
                None,
                None,
            );

            // Assert conservation
            let sum: u128 = accounts.iter().map(|a| contract.mt_balance_of(a.clone(), token_id.to_string()).0).sum();
            let total_supply = contract.mt_supply(token_id.to_string()).unwrap().0;
            assert_eq!(sum, total_supply);
        }
    }
}

const VALID_HEX64_A: &str = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const VALID_HEX64_B: &str = "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210";

fn create_default_city(contract: &mut AfterHours, city_id: &str) {
    let mut totals = std::collections::BTreeMap::new();
    totals.insert("bread".to_string(), U128(50));
    contract.create_city(
        city_id.to_string(),
        "arc_1".to_string(),
        "server_1".to_string(),
        acc("alice.testnet"),
        VALID_HEX64_A.to_string(),
        VALID_HEX64_B.to_string(),
        None,
        totals,
        U128(1000),
    );
}

#[test]
fn test_create_city_happy_path() {
    set_caller("alice.testnet");
    let mut contract = AfterHours::new(acc("operator.testnet"));

    set_caller("operator.testnet");
    register_default_arc(&mut contract, "arc_1");
    create_default_city(&mut contract, "neo-tokyo_01.a");

    let city = contract.get_city("neo-tokyo_01.a".to_string()).expect("City should exist");
    assert_eq!(city.city_id, "neo-tokyo_01.a");
    assert_eq!(city.arc_id, "arc_1");
    assert_eq!(city.server_id, "server_1");
    assert_eq!(city.owner, acc("alice.testnet"));
    assert_eq!(city.step, 0);
    assert_eq!(city.stage, 0);
    assert_eq!(city.state_root, VALID_HEX64_A);
    assert_eq!(city.city_root, VALID_HEX64_B);
    assert_eq!(city.parent_root, None);
    assert_eq!(city.total_coin, U128(1000));
    assert_eq!(city.totals_items.get("bread"), Some(&U128(50)));

    assert_eq!(contract.get_city_root("neo-tokyo_01.a".to_string()), Some(VALID_HEX64_B.to_string()));

    // Verify event
    let logs = get_logs();
    assert!(logs.iter().any(|l| l.contains("\"event\":\"city_created\"") && l.contains("neo-tokyo_01.a")));
}

#[test]
#[should_panic(expected = "UNAUTHORIZED_OPERATOR")]
fn test_create_city_operator_only_fails() {
    set_caller("alice.testnet");
    let mut contract = AfterHours::new(acc("operator.testnet"));

    // Stranger tries to create city
    set_caller("stranger.testnet");
    create_default_city(&mut contract, "city-1");
}

#[test]
#[should_panic(expected = "DUPLICATE_CITY_ID")]
fn test_create_city_duplicate_id_fails() {
    set_caller("alice.testnet");
    let mut contract = AfterHours::new(acc("operator.testnet"));

    set_caller("operator.testnet");
    register_default_arc(&mut contract, "arc_1");
    create_default_city(&mut contract, "city-1");
    create_default_city(&mut contract, "city-1");
}

#[test]
#[should_panic(expected = "INVALID_CITY_ID")]
fn test_create_city_id_too_long_fails() {
    set_caller("alice.testnet");
    let mut contract = AfterHours::new(acc("operator.testnet"));

    set_caller("operator.testnet");
    register_default_arc(&mut contract, "arc_1");
    let long_id = "a".repeat(65);
    create_default_city(&mut contract, &long_id);
}

#[test]
#[should_panic(expected = "INVALID_CITY_ID")]
fn test_create_city_id_invalid_chars_fails() {
    set_caller("alice.testnet");
    let mut contract = AfterHours::new(acc("operator.testnet"));

    set_caller("operator.testnet");
    register_default_arc(&mut contract, "arc_1");
    create_default_city(&mut contract, "City_UpperCase!");
}

#[test]
#[should_panic(expected = "INVALID_CITY_ID")]
fn test_create_city_id_empty_fails() {
    set_caller("alice.testnet");
    let mut contract = AfterHours::new(acc("operator.testnet"));

    set_caller("operator.testnet");
    register_default_arc(&mut contract, "arc_1");
    create_default_city(&mut contract, "");
}

#[test]
#[should_panic(expected = "INVALID_STATE_ROOT")]
fn test_create_city_state_root_length_fails() {
    set_caller("alice.testnet");
    let mut contract = AfterHours::new(acc("operator.testnet"));

    set_caller("operator.testnet");
    register_default_arc(&mut contract, "arc_1");
    let totals = std::collections::BTreeMap::new();
    contract.create_city(
        "city-1".to_string(),
        "arc_1".to_string(),
        "server_1".to_string(),
        acc("alice.testnet"),
        "012345".to_string(), // short root
        VALID_HEX64_B.to_string(),
        None,
        totals,
        U128(100),
    );
}

#[test]
#[should_panic(expected = "INVALID_STATE_ROOT")]
fn test_create_city_state_root_non_hex_fails() {
    set_caller("alice.testnet");
    let mut contract = AfterHours::new(acc("operator.testnet"));

    set_caller("operator.testnet");
    register_default_arc(&mut contract, "arc_1");
    let bad_hex = "z".repeat(64);
    let totals = std::collections::BTreeMap::new();
    contract.create_city(
        "city-1".to_string(),
        "arc_1".to_string(),
        "server_1".to_string(),
        acc("alice.testnet"),
        bad_hex,
        VALID_HEX64_B.to_string(),
        None,
        totals,
        U128(100),
    );
}

#[test]
#[should_panic(expected = "INVALID_CITY_ROOT")]
fn test_create_city_city_root_length_fails() {
    set_caller("alice.testnet");
    let mut contract = AfterHours::new(acc("operator.testnet"));

    set_caller("operator.testnet");
    register_default_arc(&mut contract, "arc_1");
    let totals = std::collections::BTreeMap::new();
    contract.create_city(
        "city-1".to_string(),
        "arc_1".to_string(),
        "server_1".to_string(),
        acc("alice.testnet"),
        VALID_HEX64_A.to_string(),
        "abcdef".to_string(), // short root
        None,
        totals,
        U128(100),
    );
}

#[test]
#[should_panic(expected = "INVALID_CITY_ROOT")]
fn test_create_city_city_root_non_hex_fails() {
    set_caller("alice.testnet");
    let mut contract = AfterHours::new(acc("operator.testnet"));

    set_caller("operator.testnet");
    register_default_arc(&mut contract, "arc_1");
    let bad_hex = "x".repeat(64);
    let totals = std::collections::BTreeMap::new();
    contract.create_city(
        "city-1".to_string(),
        "arc_1".to_string(),
        "server_1".to_string(),
        acc("alice.testnet"),
        VALID_HEX64_A.to_string(),
        bad_hex,
        None,
        totals,
        U128(100),
    );
}

#[test]
#[should_panic(expected = "INVALID_PARENT_ROOT")]
fn test_create_city_parent_root_invalid_fails() {
    set_caller("alice.testnet");
    let mut contract = AfterHours::new(acc("operator.testnet"));

    set_caller("operator.testnet");
    register_default_arc(&mut contract, "arc_1");
    let totals = std::collections::BTreeMap::new();
    contract.create_city(
        "city-1".to_string(),
        "arc_1".to_string(),
        "server_1".to_string(),
        acc("alice.testnet"),
        VALID_HEX64_A.to_string(),
        VALID_HEX64_B.to_string(),
        Some("not-64-hex".to_string()),
        totals,
        U128(100),
    );
}

#[test]
#[should_panic(expected = "TOO_MANY_TOTALS_ITEMS")]
fn test_create_city_too_many_totals_items_fails() {
    set_caller("alice.testnet");
    let mut contract = AfterHours::new(acc("operator.testnet"));

    set_caller("operator.testnet");
    register_default_arc(&mut contract, "arc_1");
    let mut totals = std::collections::BTreeMap::new();
    for i in 0..33 {
        totals.insert(format!("item_{i}"), U128(1));
    }
    contract.create_city(
        "city-1".to_string(),
        "arc_1".to_string(),
        "server_1".to_string(),
        acc("alice.testnet"),
        VALID_HEX64_A.to_string(),
        VALID_HEX64_B.to_string(),
        None,
        totals,
        U128(100),
    );
}

fn register_default_arc(contract: &mut AfterHours, arc_id: &str) {
    let mut produce = std::collections::BTreeMap::new();
    produce.insert("bread".to_string(), U128(10));
    let mut consume = std::collections::BTreeMap::new();
    consume.insert("bread".to_string(), U128(10));
    let mut source = std::collections::BTreeMap::new();
    source.insert("bread".to_string(), U128(5));
    let mut sink = std::collections::BTreeMap::new();
    sink.insert("bread".to_string(), U128(5));
    contract.register_arc(
        arc_id.to_string(),
        produce,
        consume,
        source,
        sink,
        U128(100),
        U128(100),
    );
}

#[test]
fn test_register_arc_happy_path() {
    set_caller("alice.testnet");
    let mut contract = AfterHours::new(acc("operator.testnet"));

    set_caller("operator.testnet");
    register_default_arc(&mut contract, "arc_1");

    let arc = contract.get_arc("arc_1".to_string()).expect("Arc should exist");
    assert_eq!(arc.arc_id, "arc_1");
    assert_eq!(arc.produce_cap_per_step.get("bread"), Some(&U128(10)));
    assert_eq!(arc.consume_cap_per_step.get("bread"), Some(&U128(10)));
    assert_eq!(arc.source_cap_per_step.get("bread"), Some(&U128(5)));
    assert_eq!(arc.sink_cap_per_step.get("bread"), Some(&U128(5)));
    assert_eq!(arc.coin_source_cap_per_step, U128(100));
    assert_eq!(arc.coin_sink_cap_per_step, U128(100));

    let logs = get_logs();
    assert!(logs.iter().any(|l| l.contains("\"event\":\"arc_registered\"") && l.contains("arc_1")));
}

#[test]
#[should_panic(expected = "UNAUTHORIZED_OPERATOR")]
fn test_register_arc_unauthorized() {
    set_caller("alice.testnet");
    let mut contract = AfterHours::new(acc("operator.testnet"));

    set_caller("stranger.testnet");
    register_default_arc(&mut contract, "arc_1");
}

#[test]
#[should_panic(expected = "DUPLICATE_ARC_ID")]
fn test_register_arc_duplicate_fails() {
    set_caller("alice.testnet");
    let mut contract = AfterHours::new(acc("operator.testnet"));

    set_caller("operator.testnet");
    register_default_arc(&mut contract, "arc_1");
    register_default_arc(&mut contract, "arc_1");
}

#[test]
#[should_panic(expected = "INVALID_ARC_ID")]
fn test_register_arc_invalid_id_fails() {
    set_caller("alice.testnet");
    let mut contract = AfterHours::new(acc("operator.testnet"));

    set_caller("operator.testnet");
    register_default_arc(&mut contract, "Invalid_Arc_ID!");
}

#[test]
#[should_panic(expected = "INVALID_ITEM_ID")]
fn test_register_arc_invalid_item_id_fails() {
    set_caller("alice.testnet");
    let mut contract = AfterHours::new(acc("operator.testnet"));

    set_caller("operator.testnet");
    let mut produce = std::collections::BTreeMap::new();
    produce.insert("BAD_ITEM!".to_string(), U128(10));
    let consume = std::collections::BTreeMap::new();
    let source = std::collections::BTreeMap::new();
    let sink = std::collections::BTreeMap::new();
    contract.register_arc(
        "arc_1".to_string(),
        produce,
        consume,
        source,
        sink,
        U128(0),
        U128(0),
    );
}

#[test]
#[should_panic(expected = "TOO_MANY_ITEMS")]
fn test_register_arc_too_many_items_fails() {
    set_caller("alice.testnet");
    let mut contract = AfterHours::new(acc("operator.testnet"));

    set_caller("operator.testnet");
    let mut produce = std::collections::BTreeMap::new();
    for i in 0..33 {
        produce.insert(format!("item_{i}"), U128(1));
    }
    let consume = std::collections::BTreeMap::new();
    let source = std::collections::BTreeMap::new();
    let sink = std::collections::BTreeMap::new();
    contract.register_arc(
        "arc_1".to_string(),
        produce,
        consume,
        source,
        sink,
        U128(0),
        U128(0),
    );
}

#[test]
#[should_panic(expected = "UNREGISTERED_ARC")]
fn test_create_city_unregistered_arc_fails() {
    set_caller("alice.testnet");
    let mut contract = AfterHours::new(acc("operator.testnet"));

    set_caller("operator.testnet");
    create_default_city(&mut contract, "city-1");
}


fn create_city_with(contract: &mut AfterHours, arc_id: &str, server_id: &str, item_key: &str) {
    let mut totals = std::collections::BTreeMap::new();
    totals.insert(item_key.to_string(), U128(1));
    contract.create_city(
        "city-x".to_string(),
        arc_id.to_string(),
        server_id.to_string(),
        acc("alice.testnet"),
        VALID_HEX64_A.to_string(),
        VALID_HEX64_B.to_string(),
        None,
        totals,
        U128(1),
    );
}

#[test]
#[should_panic(expected = "INVALID_ARC_ID")]
fn test_create_city_invalid_arc_id_fails() {
    set_caller("alice.testnet");
    let mut contract = AfterHours::new(acc("operator.testnet"));
    set_caller("operator.testnet");
    create_city_with(&mut contract, "Bad Arc!", "server_1", "bread");
}

#[test]
#[should_panic(expected = "INVALID_SERVER_ID")]
fn test_create_city_invalid_server_id_fails() {
    set_caller("alice.testnet");
    let mut contract = AfterHours::new(acc("operator.testnet"));
    set_caller("operator.testnet");
    register_default_arc(&mut contract, "arc_1");
    create_city_with(&mut contract, "arc_1", &"s".repeat(65), "bread");
}

#[test]
#[should_panic(expected = "INVALID_ITEM_ID")]
fn test_create_city_invalid_totals_item_key_fails() {
    set_caller("alice.testnet");
    let mut contract = AfterHours::new(acc("operator.testnet"));
    set_caller("operator.testnet");
    register_default_arc(&mut contract, "arc_1");
    create_city_with(&mut contract, "arc_1", "server_1", "Bad Item");
}
