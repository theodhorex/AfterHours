//! Unit tests for city market and escrow.

use super::*;
use near_sdk::json_types::U128;
use near_sdk::test_utils::{get_logs, VMContextBuilder};
use near_sdk::{testing_env, AccountId, NearToken};
use std::collections::BTreeMap;

const HEX_A: &str = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const HEX_B: &str = "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210";

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

fn setup_test_city(contract: &mut AfterHours, city_id: &str, owner: &str) {
    set_caller("operator.testnet");

    // Register arc
    let mut produce = BTreeMap::new();
    produce.insert("bread".to_string(), U128(10));
    let mut consume = BTreeMap::new();
    consume.insert("bread".to_string(), U128(10));
    let mut source = BTreeMap::new();
    source.insert("bread".to_string(), U128(5));
    let mut sink = BTreeMap::new();
    sink.insert("bread".to_string(), U128(5));
    contract.register_arc(
        "arc_1".to_string(),
        produce,
        consume,
        source,
        sink,
        U128(100),
        U128(100),
    );

    // Create city
    let mut totals = BTreeMap::new();
    totals.insert("bread".to_string(), U128(50));
    contract.create_city(
        city_id.to_string(),
        "arc_1".to_string(),
        "server_1".to_string(),
        acc(owner),
        HEX_A.to_string(),
        HEX_B.to_string(),
        None,
        totals,
        U128(1000),
    );
}

#[test]
fn test_owner_can_list_city() {
    set_caller("operator.testnet");
    let mut contract = AfterHours::new(acc("operator.testnet"));
    setup_test_city(&mut contract, "neo-tokyo", "alice.testnet");

    set_caller("alice.testnet");
    contract.list_city("neo-tokyo".to_string(), U128(1_000_000_000_000_000_000_000_000));

    let listing = contract.get_listing("neo-tokyo".to_string()).expect("listing should exist");
    assert_eq!(listing.city_id, "neo-tokyo");
    assert_eq!(listing.seller, acc("alice.testnet"));
    assert_eq!(listing.price_yocto, U128(1_000_000_000_000_000_000_000_000));

    let logs = get_logs();
    assert!(logs.iter().any(|l| l.contains("\"event\":\"city_listed\"") && l.contains("neo-tokyo")));
}

#[test]
#[should_panic(expected = "NOT_CITY_OWNER")]
fn test_non_owner_list_rejected() {
    set_caller("operator.testnet");
    let mut contract = AfterHours::new(acc("operator.testnet"));
    setup_test_city(&mut contract, "neo-tokyo", "alice.testnet");

    set_caller("bob.testnet");
    contract.list_city("neo-tokyo".to_string(), U128(1_000_000_000_000_000_000_000_000));
}

#[test]
#[should_panic(expected = "ALREADY_LISTED")]
fn test_duplicate_listing_rejected() {
    set_caller("operator.testnet");
    let mut contract = AfterHours::new(acc("operator.testnet"));
    setup_test_city(&mut contract, "neo-tokyo", "alice.testnet");

    set_caller("alice.testnet");
    contract.list_city("neo-tokyo".to_string(), U128(1_000_000_000_000_000_000_000_000));
    contract.list_city("neo-tokyo".to_string(), U128(2_000_000_000_000_000_000_000_000));
}

#[test]
#[should_panic(expected = "NOT_SELLER")]
fn test_cancel_by_stranger_rejected() {
    set_caller("operator.testnet");
    let mut contract = AfterHours::new(acc("operator.testnet"));
    setup_test_city(&mut contract, "neo-tokyo", "alice.testnet");

    set_caller("alice.testnet");
    contract.list_city("neo-tokyo".to_string(), U128(1_000_000_000_000_000_000_000_000));

    set_caller("stranger.testnet");
    contract.cancel_listing("neo-tokyo".to_string());
}

#[test]
#[should_panic(expected = "INVALID_PRICE")]
fn test_price_zero_rejected() {
    set_caller("operator.testnet");
    let mut contract = AfterHours::new(acc("operator.testnet"));
    setup_test_city(&mut contract, "neo-tokyo", "alice.testnet");

    set_caller("alice.testnet");
    contract.list_city("neo-tokyo".to_string(), U128(0));
}

#[test]
fn test_owner_can_cancel_listing() {
    set_caller("operator.testnet");
    let mut contract = AfterHours::new(acc("operator.testnet"));
    setup_test_city(&mut contract, "neo-tokyo", "alice.testnet");

    set_caller("alice.testnet");
    contract.list_city("neo-tokyo".to_string(), U128(1_000_000_000_000_000_000_000_000));
    assert!(contract.get_listing("neo-tokyo".to_string()).is_some());

    contract.cancel_listing("neo-tokyo".to_string());
    assert!(contract.get_listing("neo-tokyo".to_string()).is_none());

    let logs = get_logs();
    assert!(logs.iter().any(|l| l.contains("\"event\":\"listing_cancelled\"") && l.contains("neo-tokyo")));
}

#[test]
#[should_panic(expected = "NO_LISTING")]
fn test_cancel_non_existent_listing_rejected() {
    set_caller("operator.testnet");
    let mut contract = AfterHours::new(acc("operator.testnet"));
    setup_test_city(&mut contract, "neo-tokyo", "alice.testnet");

    set_caller("alice.testnet");
    contract.cancel_listing("neo-tokyo".to_string());
}

#[test]
fn test_listing_escrow_and_buy_flow() {
    use near_sdk::test_utils::get_created_receipts;

    set_caller("operator.testnet");
    let mut contract = AfterHours::new(acc("operator.testnet"));
    setup_test_city(&mut contract, "neo-tokyo", "alice.testnet");

    // Alice lists city for 5 NEAR
    set_caller("alice.testnet");
    contract.list_city("neo-tokyo".to_string(), U128(5_000_000_000_000_000_000_000_000));

    // Bob buys city with 5 NEAR
    set_caller_with_deposit("bob.testnet", 5_000_000_000_000_000_000_000_000);
    contract.buy_city("neo-tokyo".to_string());

    // Owner changed
    let city = contract.get_city("neo-tokyo".to_string()).expect("city must exist");
    assert_eq!(city.owner, acc("bob.testnet"));

    // Listing gone
    assert!(contract.get_listing("neo-tokyo".to_string()).is_none());

    // Event emitted
    let logs = get_logs();
    assert!(logs.iter().any(|l| l.contains("\"event\":\"city_sold\"") && l.contains("bob.testnet")));

    // Payout receipt sent to Alice
    let receipts = get_created_receipts();
    let seller_receipt = receipts
        .iter()
        .find(|r| r.receiver_id == acc("alice.testnet"))
        .expect("seller payout receipt not found");
    let payout_action = seller_receipt.actions.iter().find(|a| {
        matches!(a, near_sdk::mock::MockAction::Transfer { deposit, .. } if deposit.as_yoctonear() == 5_000_000_000_000_000_000_000_000)
    });
    assert!(payout_action.is_some(), "Expected 5 NEAR payout to seller");
}

#[test]
#[should_panic(expected = "NO_LISTING")]
fn test_second_buy_fails_no_listing() {
    set_caller("operator.testnet");
    let mut contract = AfterHours::new(acc("operator.testnet"));
    setup_test_city(&mut contract, "neo-tokyo", "alice.testnet");

    set_caller("alice.testnet");
    contract.list_city("neo-tokyo".to_string(), U128(5_000_000_000_000_000_000_000_000));

    set_caller_with_deposit("bob.testnet", 5_000_000_000_000_000_000_000_000);
    contract.buy_city("neo-tokyo".to_string());

    // Second buy attempt by carol
    set_caller_with_deposit("carol.testnet", 5_000_000_000_000_000_000_000_000);
    contract.buy_city("neo-tokyo".to_string());
}

#[test]
fn test_buy_underpay_rejected_with_state_unchanged() {
    set_caller("operator.testnet");
    let mut contract = AfterHours::new(acc("operator.testnet"));
    setup_test_city(&mut contract, "neo-tokyo", "alice.testnet");

    set_caller("alice.testnet");
    contract.list_city("neo-tokyo".to_string(), U128(5_000_000_000_000_000_000_000_000));

    // Underpay attempt fails
    let res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        set_caller_with_deposit("bob.testnet", 4_000_000_000_000_000_000_000_000);
        contract.buy_city("neo-tokyo".to_string());
    }));
    assert!(res.is_err());

    // Check state unchanged on original contract instance
    let city = contract.get_city("neo-tokyo".to_string()).expect("city must exist");
    assert_eq!(city.owner, acc("alice.testnet"));
    let listing = contract.get_listing("neo-tokyo".to_string()).expect("listing must still exist");
    assert_eq!(listing.seller, acc("alice.testnet"));
}

#[test]
fn test_buy_excess_refunded() {
    use near_sdk::test_utils::get_created_receipts;

    set_caller("operator.testnet");
    let mut contract = AfterHours::new(acc("operator.testnet"));
    setup_test_city(&mut contract, "neo-tokyo", "alice.testnet");

    set_caller("alice.testnet");
    contract.list_city("neo-tokyo".to_string(), U128(5_000_000_000_000_000_000_000_000));

    // Bob attaches 7 NEAR (excess 2 NEAR)
    set_caller_with_deposit("bob.testnet", 7_000_000_000_000_000_000_000_000);
    contract.buy_city("neo-tokyo".to_string());

    let receipts = get_created_receipts();
    // Seller gets 5 NEAR
    let seller_receipt = receipts
        .iter()
        .find(|r| r.receiver_id == acc("alice.testnet"))
        .expect("seller payout receipt not found");
    assert!(seller_receipt.actions.iter().any(|a| {
        matches!(a, near_sdk::mock::MockAction::Transfer { deposit, .. } if deposit.as_yoctonear() == 5_000_000_000_000_000_000_000_000)
    }));

    // Buyer gets 2 NEAR refund
    let buyer_receipt = receipts
        .iter()
        .find(|r| r.receiver_id == acc("bob.testnet"))
        .expect("buyer refund receipt not found");
    assert!(buyer_receipt.actions.iter().any(|a| {
        matches!(a, near_sdk::mock::MockAction::Transfer { deposit, .. } if deposit.as_yoctonear() == 2_000_000_000_000_000_000_000_000)
    }));
}

#[test]
#[should_panic(expected = "NO_LISTING")]
fn test_cancelled_listing_cannot_be_bought() {
    set_caller("operator.testnet");
    let mut contract = AfterHours::new(acc("operator.testnet"));
    setup_test_city(&mut contract, "neo-tokyo", "alice.testnet");

    set_caller("alice.testnet");
    contract.list_city("neo-tokyo".to_string(), U128(5_000_000_000_000_000_000_000_000));
    contract.cancel_listing("neo-tokyo".to_string());

    set_caller_with_deposit("bob.testnet", 5_000_000_000_000_000_000_000_000);
    contract.buy_city("neo-tokyo".to_string());
}

#[test]
#[should_panic(expected = "NOT_CITY_OWNER")]
fn test_sold_city_cannot_be_listed_by_old_owner() {
    set_caller("operator.testnet");
    let mut contract = AfterHours::new(acc("operator.testnet"));
    setup_test_city(&mut contract, "neo-tokyo", "alice.testnet");

    set_caller("alice.testnet");
    contract.list_city("neo-tokyo".to_string(), U128(5_000_000_000_000_000_000_000_000));

    set_caller_with_deposit("bob.testnet", 5_000_000_000_000_000_000_000_000);
    contract.buy_city("neo-tokyo".to_string());

    // Alice tries to list it again
    set_caller("alice.testnet");
    contract.list_city("neo-tokyo".to_string(), U128(1_000_000_000_000_000_000_000_000));
}

#[test]
#[should_panic(expected = "SELF_PURCHASE")]
fn test_buy_city_self_purchase_rejected() {
    set_caller("operator.testnet");
    let mut contract = AfterHours::new(acc("operator.testnet"));
    setup_test_city(&mut contract, "neo-tokyo", "alice.testnet");

    set_caller("alice.testnet");
    contract.list_city("neo-tokyo".to_string(), U128(5_000_000_000_000_000_000_000_000));

    // Alice tries to buy her own city
    set_caller_with_deposit("alice.testnet", 5_000_000_000_000_000_000_000_000);
    contract.buy_city("neo-tokyo".to_string());
}
