//! Checkpoint verification and conservation unit tests.

use super::*;
use near_sdk::json_types::U128;
use near_sdk::test_utils::{get_logs, VMContextBuilder};
use near_sdk::{testing_env, AccountId, NearToken};
use std::collections::BTreeMap;

const HEX_A: &str = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const HEX_B: &str = "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210";
const HEX_C: &str = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const HEX_D: &str = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

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

fn setup_city(contract: &mut AfterHours) {
    set_caller("operator.testnet");

    // Register players for storage
    register_account(contract, "bob.testnet");
    register_account(contract, "carol.testnet");
    register_account(contract, "dan.testnet");

    set_caller("operator.testnet");

    // Register arc with caps
    let mut prod_caps = BTreeMap::new();
    prod_caps.insert("bread".to_string(), U128(100));
    let mut cons_caps = BTreeMap::new();
    cons_caps.insert("bread".to_string(), U128(100));
    let mut source_caps = BTreeMap::new();
    source_caps.insert("bread".to_string(), U128(20));
    let mut sink_caps = BTreeMap::new();
    sink_caps.insert("bread".to_string(), U128(1000));
    contract.register_arc(
        "arc_test".to_string(),
        prod_caps,
        cons_caps,
        source_caps,
        sink_caps,
        U128(200),
        U128(200),
    );

    // Create city
    let mut totals = BTreeMap::new();
    totals.insert("bread".to_string(), U128(500));
    contract.create_city(
        "city_test".to_string(),
        "arc_test".to_string(),
        "server_1".to_string(),
        acc("alice.testnet"),
        HEX_A.to_string(),
        HEX_B.to_string(),
        None,
        totals,
        U128(1000),
    );
}

fn valid_base_checkpoint() -> Checkpoint {
    let mut items = BTreeMap::new();
    items.insert(
        "bread".to_string(),
        ItemFlow {
            produced: U128(50),
            consumed_recipe: U128(10),
            consumed_pop: U128(10),
            sourced: U128(5),
            sunk: U128(2),
            trade_to_players: U128(20),
            trade_from_players: U128(10),
        },
    );

    let coin = CoinFlow {
        sourced: U128(100),
        sunk: U128(20),
        trade_to_players: U128(50),
        trade_from_players: U128(30),
    };

    let player_deltas = vec![
        PlayerDelta {
            account: acc("bob.testnet"),
            token_id: "bread".to_string(),
            delta_in: U128(20),
            delta_out: U128(10),
        },
        PlayerDelta {
            account: acc("bob.testnet"),
            token_id: "coin".to_string(),
            delta_in: U128(50),
            delta_out: U128(30),
        },
    ];

    Checkpoint {
        city_id: "city_test".to_string(),
        from_step: 0,
        to_step: 1,
        new_state_root: HEX_C.to_string(),
        new_city_root: HEX_D.to_string(),
        stage: 0,
        items,
        coin,
        player_deltas,
        executed_order_ids: vec!["ord_1".to_string()],
    }
}

#[test]
fn checkpoint_happy_path_updates_city_and_ledger() {
    set_caller("alice.testnet");
    let mut contract = AfterHours::new(acc("operator.testnet"));
    setup_city(&mut contract);

    set_caller("operator.testnet");
    let cp = valid_base_checkpoint();
    contract.submit_checkpoint(cp);

    // Verify city state updated
    let city = contract.get_city("city_test".to_string()).unwrap();
    assert_eq!(city.step, 1);
    assert_eq!(city.stage, 0);
    assert_eq!(city.state_root, HEX_C);
    assert_eq!(city.city_root, HEX_D);

    // Conservation calculation for bread:
    // old = 500
    // + produced (50) + sourced (5) + trade_from_players (10) = 565
    // - consumed_recipe (10) - consumed_pop (10) - sunk (2) - trade_to_players (20) = 42
    // new = 565 - 42 = 523
    assert_eq!(city.totals_items.get("bread"), Some(&U128(523)));

    // Coin calculation:
    // old = 1000
    // + sourced (100) + trade_from_players (30) = 1130
    // - sunk (20) - trade_to_players (50) = 70
    // new = 1130 - 70 = 1060
    assert_eq!(city.total_coin, U128(1060));

    // Verify player balances updated (bob received 20, burned 10 => balance 10)
    assert_eq!(contract.mt_balance_of(acc("bob.testnet"), "bread".to_string()), U128(10));
    assert_eq!(contract.mt_balance_of(acc("bob.testnet"), "coin".to_string()), U128(20));

    // Verify NEP-245 supply tracking
    assert_eq!(contract.mt_supply("bread".to_string()), Some(U128(10)));
    assert_eq!(contract.mt_supply("coin".to_string()), Some(U128(20)));

    // Verify executed order recorded
    assert!(contract.get_executed("city_test".to_string(), "ord_1".to_string()));

    // Verify checkpoint event emitted
    let logs = get_logs();
    assert!(logs.iter().any(|l| l.contains("\"event\":\"checkpoint\"") && l.contains("city_test")));
}

#[test]
#[should_panic(expected = "CONSERVATION_UNDERFLOW")]
fn checkpoint_violating_conservation_rejected() {
    set_caller("alice.testnet");
    let mut contract = AfterHours::new(acc("operator.testnet"));
    setup_city(&mut contract);

    set_caller("operator.testnet");
    let mut cp = valid_base_checkpoint();
    // Total additions: 500 initial + 50 produced + 5 sourced + 10 trade_from = 565.
    // Deductions with trade_to_players 600: 20 consumed + 2 sunk + 600 trade_to = 622 > 565.
    cp.items.get_mut("bread").unwrap().trade_to_players = U128(600);
    cp.player_deltas[0].delta_in = U128(600);
    contract.submit_checkpoint(cp);
}

#[test]
#[should_panic(expected = "WRONG_FROM_STEP")]
fn checkpoint_wrong_from_step_rejected() {
    set_caller("alice.testnet");
    let mut contract = AfterHours::new(acc("operator.testnet"));
    setup_city(&mut contract);

    set_caller("operator.testnet");
    let mut cp = valid_base_checkpoint();
    cp.from_step = 1; // skips step 0
    cp.to_step = 2;
    contract.submit_checkpoint(cp);
}

#[test]
#[should_panic(expected = "UNAUTHORIZED_OPERATOR")]
fn non_operator_cannot_checkpoint() {
    set_caller("alice.testnet");
    let mut contract = AfterHours::new(acc("operator.testnet"));
    setup_city(&mut contract);

    set_caller("stranger.testnet");
    let cp = valid_base_checkpoint();
    contract.submit_checkpoint(cp);
}

#[test]
#[should_panic(expected = "ORDER_ALREADY_EXECUTED")]
fn order_executed_once() {
    set_caller("alice.testnet");
    let mut contract = AfterHours::new(acc("operator.testnet"));
    setup_city(&mut contract);

    set_caller("operator.testnet");
    let cp1 = valid_base_checkpoint();
    contract.submit_checkpoint(cp1);

    // Second checkpoint re-executing ord_1
    let mut cp2 = valid_base_checkpoint();
    cp2.from_step = 1;
    cp2.to_step = 2;
    contract.submit_checkpoint(cp2);
}

#[test]
#[should_panic(expected = "PLAYER_DELTA_MISMATCH")]
fn checkpoint_player_delta_mismatch_rejected() {
    set_caller("alice.testnet");
    let mut contract = AfterHours::new(acc("operator.testnet"));
    setup_city(&mut contract);

    set_caller("operator.testnet");
    let mut cp = valid_base_checkpoint();
    // Mismatch: flow declares trade_to_players 20, but player delta gives 999
    cp.player_deltas[0].delta_in = U128(999);
    contract.submit_checkpoint(cp);
}

#[test]
#[should_panic(expected = "NEGATIVE_PLAYER_BALANCE")]
fn checkpoint_negative_player_balance_rejected() {
    set_caller("alice.testnet");
    let mut contract = AfterHours::new(acc("operator.testnet"));
    setup_city(&mut contract);

    set_caller("operator.testnet");
    let mut cp = valid_base_checkpoint();
    // Player has 0 initial balance, delta_in 10, delta_out 50 => balance would be -40
    cp.items.get_mut("bread").unwrap().trade_to_players = U128(10);
    cp.items.get_mut("bread").unwrap().trade_from_players = U128(50);
    cp.player_deltas[0].delta_in = U128(10);
    cp.player_deltas[0].delta_out = U128(50);
    contract.submit_checkpoint(cp);
}

#[test]
#[should_panic(expected = "TOO_MANY_STEPS")]
fn checkpoint_too_many_steps_rejected() {
    set_caller("alice.testnet");
    let mut contract = AfterHours::new(acc("operator.testnet"));
    setup_city(&mut contract);

    set_caller("operator.testnet");
    let mut cp = valid_base_checkpoint();
    // MAX_STEPS_PER_CHECKPOINT is 40; 41 steps should be rejected
    cp.to_step = 41;
    contract.submit_checkpoint(cp);
}

#[test]
#[should_panic(expected = "STAGE_REGRESSION")]
fn checkpoint_stage_regression_rejected() {
    set_caller("alice.testnet");
    let mut contract = AfterHours::new(acc("operator.testnet"));
    setup_city(&mut contract);

    // Advance city to stage 1 manually or via checkpoint
    set_caller("operator.testnet");
    let mut cp1 = valid_base_checkpoint();
    cp1.stage = 1;
    contract.submit_checkpoint(cp1);

    // Next checkpoint regresses to stage 0
    let mut cp2 = valid_base_checkpoint();
    cp2.from_step = 1;
    cp2.to_step = 2;
    cp2.stage = 0;
    contract.submit_checkpoint(cp2);
}

#[test]
#[should_panic(expected = "PRODUCE_CAP_EXCEEDED")]
fn checkpoint_cap_exceeded_rejected() {
    set_caller("alice.testnet");
    let mut contract = AfterHours::new(acc("operator.testnet"));
    setup_city(&mut contract);

    set_caller("operator.testnet");
    let mut cp = valid_base_checkpoint();
    // Cap is 100 per step; steps = 1; produced = 101 => cap exceeded
    cp.items.get_mut("bread").unwrap().produced = U128(101);
    contract.submit_checkpoint(cp);
}

#[test]
#[should_panic(expected = "SOURCE_CAP_EXCEEDED")]
fn checkpoint_sourced_over_cap_rejected() {
    set_caller("alice.testnet");
    let mut contract = AfterHours::new(acc("operator.testnet"));
    setup_city(&mut contract);

    set_caller("operator.testnet");
    let mut cp = valid_base_checkpoint();
    // Cap is 20 per step; steps = 1; sourced = 21 => SOURCE_CAP_EXCEEDED
    cp.items.get_mut("bread").unwrap().sourced = U128(21);
    contract.submit_checkpoint(cp);
}

#[test]
#[should_panic(expected = "SINK_CAP_EXCEEDED")]
fn checkpoint_sunk_over_cap_rejected() {
    set_caller("alice.testnet");
    let mut contract = AfterHours::new(acc("operator.testnet"));
    setup_city(&mut contract);

    set_caller("operator.testnet");
    let mut cp = valid_base_checkpoint();
    // Cap is 1000 per step; steps = 1; sunk = 1001 => SINK_CAP_EXCEEDED
    cp.items.get_mut("bread").unwrap().sunk = U128(1001);
    contract.submit_checkpoint(cp);
}

#[test]
#[should_panic(expected = "COIN_SOURCE_CAP_EXCEEDED")]
fn checkpoint_coin_sourced_over_cap_rejected() {
    set_caller("alice.testnet");
    let mut contract = AfterHours::new(acc("operator.testnet"));
    setup_city(&mut contract);

    set_caller("operator.testnet");
    let mut cp = valid_base_checkpoint();
    // Coin source cap is 200 per step; steps = 1; coin.sourced = 201 => COIN_SOURCE_CAP_EXCEEDED
    cp.coin.sourced = U128(201);
    contract.submit_checkpoint(cp);
}

#[test]
#[should_panic(expected = "COIN_SINK_CAP_EXCEEDED")]
fn checkpoint_coin_sunk_over_cap_rejected() {
    set_caller("alice.testnet");
    let mut contract = AfterHours::new(acc("operator.testnet"));
    setup_city(&mut contract);

    set_caller("operator.testnet");
    let mut cp = valid_base_checkpoint();
    // Coin sink cap is 200 per step; steps = 1; coin.sunk = 201 => COIN_SINK_CAP_EXCEEDED
    cp.coin.sunk = U128(201);
    contract.submit_checkpoint(cp);
}

#[test]
fn checkpoint_sourced_within_cap_accepted() {
    set_caller("alice.testnet");
    let mut contract = AfterHours::new(acc("operator.testnet"));
    setup_city(&mut contract);

    set_caller("operator.testnet");
    let mut cp = valid_base_checkpoint();
    // Exactly at cap: sourced = 20, sunk = 20
    cp.items.get_mut("bread").unwrap().sourced = U128(20);
    cp.items.get_mut("bread").unwrap().sunk = U128(20);
    cp.coin.sourced = U128(200);
    cp.coin.sunk = U128(200);
    contract.submit_checkpoint(cp);

    let city = contract.get_city("city_test".to_string()).unwrap();
    assert_eq!(city.step, 1);
}

#[test]
fn checkpoint_rejected_preserves_state() {
    set_caller("alice.testnet");
    let mut contract = AfterHours::new(acc("operator.testnet"));
    setup_city(&mut contract);

    let initial_city = contract.get_city("city_test".to_string()).unwrap();
    let initial_bob_bread = contract.mt_balance_of(acc("bob.testnet"), "bread".to_string());
    let initial_bob_coin = contract.mt_balance_of(acc("bob.testnet"), "coin".to_string());
    assert!(!contract.get_executed("city_test".to_string(), "ord_1".to_string()));

    set_caller("operator.testnet");
    let mut bad_cp = valid_base_checkpoint();
    bad_cp.items.get_mut("bread").unwrap().sourced = U128(9999);

    let res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        contract.submit_checkpoint(bad_cp);
    }));
    assert!(res.is_err());

    let final_city = contract.get_city("city_test".to_string()).unwrap();
    assert_eq!(initial_city, final_city);
    assert_eq!(contract.mt_balance_of(acc("bob.testnet"), "bread".to_string()), initial_bob_bread);
    assert_eq!(contract.mt_balance_of(acc("bob.testnet"), "coin".to_string()), initial_bob_coin);
    assert!(!contract.get_executed("city_test".to_string(), "ord_1".to_string()));
}

#[test]
#[should_panic(expected = "PLAYER_NOT_REGISTERED")]
fn checkpoint_unregistered_player_rejected() {
    set_caller("alice.testnet");
    let mut contract = AfterHours::new(acc("operator.testnet"));
    setup_city(&mut contract);

    set_caller("operator.testnet");
    let mut cp = valid_base_checkpoint();
    // Eve is unregistered, delta_in > 0
    cp.player_deltas.push(PlayerDelta {
        account: acc("eve.testnet"),
        token_id: "bread".to_string(),
        delta_in: U128(5),
        delta_out: U128(0),
    });
    // Adjust trade_to_players to match sum
    cp.items.get_mut("bread").unwrap().trade_to_players = U128(25);
    contract.submit_checkpoint(cp);
}

#[test]
fn seeded_property_loop_conserves_all_flows() {
    set_caller("alice.testnet");
    let mut contract = AfterHours::new(acc("operator.testnet"));
    setup_city(&mut contract);

    let players = [acc("bob.testnet"), acc("carol.testnet"), acc("dan.testnet")];

    let mut cur_step: u64 = 0;
    let mut total_produced: u128 = 0;
    let mut total_sourced: u128 = 0;
    let mut total_consumed: u128 = 0;
    let mut total_sunk: u128 = 0;

    let initial_city_bread: u128 = 500;
    let initial_city_coin: u128 = 1000;
    let mut total_coin_sourced: u128 = 0;
    let mut total_coin_sunk: u128 = 0;

    // Simple LCG PRNG for deterministic test
    let mut seed: u64 = 0xabcdef1234567890;
    let next_rand = |s: &mut u64| -> u64 {
        *s = s.wrapping_mul(6364136223846793005).wrapping_add(1);
        *s
    };

    for i in 0..200 {
        set_caller("operator.testnet");
        let r = next_rand(&mut seed) as u128;
        let steps_advance = (1 + (r % 5)) as u64; // 1 to 5 steps
        let next_step = cur_step + steps_advance;

        // Produce up to cap (100 * steps_advance)
        let prod = (r >> 8) % (100 * steps_advance as u128 + 1);
        let src = (r >> 16) % (20 * steps_advance as u128 + 1);
        let cons_rec = (r >> 24) % 10;
        let cons_pop = (r >> 32) % 10;

        // Total city available before player trades
        let city_record = contract.get_city("city_test".to_string()).unwrap();
        let cur_city_bal = city_record.totals_items.get("bread").unwrap().0;
        let additions = prod + src;
        let max_sunk = (cur_city_bal + additions).min(20 * steps_advance as u128);
        let sunk = if max_sunk > 0 { (r >> 40) % (max_sunk + 1) } else { 0 };
        let city_deductions = cons_rec + cons_pop + sunk;

        // Coin flows within caps (200 * steps_advance)
        let cur_city_coin = city_record.total_coin.0;
        let coin_src = (r >> 20) % (50 * steps_advance as u128 + 1);
        let max_coin_sunk = (cur_city_coin + coin_src).min(50 * steps_advance as u128);
        let coin_sunk = if max_coin_sunk > 0 { (r >> 28) % (max_coin_sunk + 1) } else { 0 };

        total_coin_sourced += coin_src;
        total_coin_sunk += coin_sunk;

        // Player trades
        let p_idx = (((r >> 48) % 3) as usize).min(2);
        let player = players[p_idx].clone();
        let p_bal = contract.mt_balance_of(player.clone(), "bread".to_string()).0;

        // Can trade to player up to (cur_city_bal + additions - city_deductions)
        let max_to_player = if cur_city_bal + additions > city_deductions {
            (cur_city_bal + additions - city_deductions).min(20)
        } else {
            0
        };
        let trade_to_p = if max_to_player > 0 { (r >> 52) % (max_to_player + 1) } else { 0 };

        // Player gives up up to p_bal
        let trade_from_p = if p_bal > 0 { (r >> 56) % (p_bal.min(20) + 1) } else { 0 };

        total_produced += prod;
        total_sourced += src;
        total_consumed += cons_rec + cons_pop;
        total_sunk += sunk;

        let mut items = BTreeMap::new();
        items.insert(
            "bread".to_string(),
            ItemFlow {
                produced: U128(prod),
                consumed_recipe: U128(cons_rec),
                consumed_pop: U128(cons_pop),
                sourced: U128(src),
                sunk: U128(sunk),
                trade_to_players: U128(trade_to_p),
                trade_from_players: U128(trade_from_p),
            },
        );

        let coin = CoinFlow {
            sourced: U128(coin_src),
            sunk: U128(coin_sunk),
            trade_to_players: U128(0),
            trade_from_players: U128(0),
        };

        let player_deltas = if trade_to_p > 0 || trade_from_p > 0 {
            vec![PlayerDelta {
                account: player,
                token_id: "bread".to_string(),
                delta_in: U128(trade_to_p),
                delta_out: U128(trade_from_p),
            }]
        } else {
            vec![]
        };

        let cp = Checkpoint {
            city_id: "city_test".to_string(),
            from_step: cur_step,
            to_step: next_step,
            new_state_root: format!("{:064x}", cur_step + 1),
            new_city_root: format!("{:064x}", cur_step + 2),
            stage: 0,
            items,
            coin,
            player_deltas,
            executed_order_ids: vec![format!("loop_ord_{i}")],
        };

        contract.submit_checkpoint(cp);
        cur_step = next_step;
    }

    // Invariant check after 200 random valid checkpoints:
    // city_total + sum(player balances) == initial + total produced + sourced - consumed - sunk
    let city_record = contract.get_city("city_test".to_string()).unwrap();
    let final_city_bread = city_record.totals_items.get("bread").unwrap().0;
    let sum_player_bread: u128 = players
        .iter()
        .map(|p| contract.mt_balance_of(p.clone(), "bread".to_string()).0)
        .sum();

    let total_in_world = final_city_bread + sum_player_bread;
    let expected_in_world = initial_city_bread + total_produced + total_sourced - total_consumed - total_sunk;

    assert_eq!(
        total_in_world, expected_in_world,
        "Invariant violated: total in world ({}) != expected ({})",
        total_in_world, expected_in_world
    );

    let final_city_coin = city_record.total_coin.0;
    let expected_in_world_coin = initial_city_coin + total_coin_sourced - total_coin_sunk;
    assert_eq!(
        final_city_coin, expected_in_world_coin,
        "Coin invariant violated: final ({}) != expected ({})",
        final_city_coin, expected_in_world_coin
    );
}

#[test]
#[should_panic(expected = "TOO_MANY_ITEMS")]
fn test_checkpoint_too_many_items_rejected() {
    let mut contract = AfterHours::new(acc("operator.testnet"));
    setup_city(&mut contract);

    let mut items = BTreeMap::new();
    for i in 0..33 {
        items.insert(
            format!("item_{i}"),
            ItemFlow {
                produced: U128(0),
                consumed_recipe: U128(0),
                consumed_pop: U128(0),
                sourced: U128(0),
                sunk: U128(0),
                trade_to_players: U128(0),
                trade_from_players: U128(0),
            },
        );
    }
    let cp = Checkpoint {
        city_id: "city_test".to_string(),
        from_step: 0,
        to_step: 10,
        new_state_root: HEX_C.to_string(),
        new_city_root: HEX_D.to_string(),
        stage: 0,
        items,
        coin: CoinFlow {
            sourced: U128(0),
            sunk: U128(0),
            trade_to_players: U128(0),
            trade_from_players: U128(0),
        },
        player_deltas: vec![],
        executed_order_ids: vec![],
    };
    contract.submit_checkpoint(cp);
}

#[test]
#[should_panic(expected = "UNREGISTERED_ITEM")]
fn test_checkpoint_unregistered_item_rejected() {
    let mut contract = AfterHours::new(acc("operator.testnet"));
    setup_city(&mut contract);

    let mut items = BTreeMap::new();
    items.insert(
        "unregistered_potion".to_string(),
        ItemFlow {
            produced: U128(0),
            consumed_recipe: U128(0),
            consumed_pop: U128(0),
            sourced: U128(0),
            sunk: U128(0),
            trade_to_players: U128(0),
            trade_from_players: U128(0),
        },
    );
    let cp = Checkpoint {
        city_id: "city_test".to_string(),
        from_step: 0,
        to_step: 10,
        new_state_root: HEX_C.to_string(),
        new_city_root: HEX_D.to_string(),
        stage: 0,
        items,
        coin: CoinFlow {
            sourced: U128(0),
            sunk: U128(0),
            trade_to_players: U128(0),
            trade_from_players: U128(0),
        },
        player_deltas: vec![],
        executed_order_ids: vec![],
    };
    contract.submit_checkpoint(cp);
}

#[test]
#[should_panic(expected = "TRADE_TO_PLAYERS_EXCEEDS_SINK_CAP")]
fn test_checkpoint_trade_to_players_exceeds_sink_cap_rejected() {
    let mut contract = AfterHours::new(acc("operator.testnet"));
    setup_city(&mut contract);

    // Sink cap for bread is 1000 per step. For 10 steps, max is 10000.
    // Try trade_to_players = 10001.
    let mut items = BTreeMap::new();
    items.insert(
        "bread".to_string(),
        ItemFlow {
            produced: U128(0),
            consumed_recipe: U128(0),
            consumed_pop: U128(0),
            sourced: U128(0),
            sunk: U128(0),
            trade_to_players: U128(10_001),
            trade_from_players: U128(0),
        },
    );
    let cp = Checkpoint {
        city_id: "city_test".to_string(),
        from_step: 0,
        to_step: 10,
        new_state_root: HEX_C.to_string(),
        new_city_root: HEX_D.to_string(),
        stage: 0,
        items,
        coin: CoinFlow {
            sourced: U128(0),
            sunk: U128(0),
            trade_to_players: U128(0),
            trade_from_players: U128(0),
        },
        player_deltas: vec![PlayerDelta {
            account: acc("bob.testnet"),
            token_id: "bread".to_string(),
            delta_in: U128(10_001),
            delta_out: U128(0),
        }],
        executed_order_ids: vec![],
    };
    contract.submit_checkpoint(cp);
}

#[test]
#[should_panic(expected = "TOO_MANY_PLAYER_DELTAS")]
fn test_checkpoint_too_many_player_deltas_rejected() {
    let mut contract = AfterHours::new(acc("operator.testnet"));
    setup_city(&mut contract);

    // 41 deltas should be rejected (limit lowered to 40)
    let mut player_deltas = Vec::new();
    for _ in 0..41 {
        player_deltas.push(PlayerDelta {
            account: acc("bob.testnet"),
            token_id: "bread".to_string(),
            delta_in: U128(0),
            delta_out: U128(0),
        });
    }

    let cp = Checkpoint {
        city_id: "city_test".to_string(),
        from_step: 0,
        to_step: 10,
        new_state_root: HEX_C.to_string(),
        new_city_root: HEX_D.to_string(),
        stage: 0,
        items: BTreeMap::new(),
        coin: CoinFlow {
            sourced: U128(0),
            sunk: U128(0),
            trade_to_players: U128(0),
            trade_from_players: U128(0),
        },
        player_deltas,
        executed_order_ids: vec![],
    };
    contract.submit_checkpoint(cp);
}
