//! Checkpoint verification, arc cap registration, and flow conservation for AfterHours.
//!
//! # Accounting Model
//! The contract maintains a dual-ledger conservation model:
//! 1. City Totals (`CityRecord.totals_items` and `CityRecord.total_coin`):
//!    Represents all resources circulating inside the simulated city (businesses, citizen purses, treasury).
//! 2. Player Multi-Token Ledger (NEP-245 `balances` and `supply`):
//!    Represents external player balances held in player accounts.
//!
//! When players trade with the city:
//! - Items/coin given up by players (`delta_out`) transfer into the city (`trade_from_players`),
//!   burning NEP-245 player supply and increasing city totals.
//! - Items/coin received by players (`delta_in`) transfer out of the city (`trade_to_players`),
//!   minting NEP-245 player supply and decreasing city totals.
//!
//! # Honest Limit
//! The smart contract verifies arithmetic conservation, step continuity, stage progression,
//! order execution deduplication, and production/consumption caps. It does NOT replay the full
//! simulation. Full execution validity is proven by clients replaying the deterministic simulation
//! against the committed Merkle state roots.

use crate::{AfterHours, AfterHoursExt};
use near_sdk::json_types::U128;
use near_sdk::{env, near, require};
use std::collections::BTreeMap;

pub(crate) fn validate_id(id: &str, err_msg: &str) {
    require!(
        !id.is_empty()
            && id.len() <= 64
            && id.bytes().all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || matches!(b, b'.' | b'_' | b'-')),
        err_msg
    );
}

#[near(serializers=[borsh, json])]
#[derive(Clone, Debug, PartialEq)]
pub struct ArcCaps {
    pub arc_id: String,
    pub produce_cap_per_step: BTreeMap<String, U128>,
    pub consume_cap_per_step: BTreeMap<String, U128>,
}

#[near(serializers=[borsh, json])]
#[derive(Clone, Debug, PartialEq)]
pub struct ItemFlow {
    pub produced: U128,
    pub consumed_recipe: U128,
    pub consumed_pop: U128,
    pub sourced: U128,
    pub sunk: U128,
    pub trade_to_players: U128,
    pub trade_from_players: U128,
}

#[near(serializers=[borsh, json])]
#[derive(Clone, Debug, PartialEq)]
pub struct CoinFlow {
    pub sourced: U128,
    pub sunk: U128,
    pub trade_to_players: U128,
    pub trade_from_players: U128,
}

#[near(serializers=[borsh, json])]
#[derive(Clone, Debug, PartialEq)]
pub struct PlayerDelta {
    pub account: near_sdk::AccountId,
    pub token_id: String,
    pub delta_in: U128,
    pub delta_out: U128,
}

#[near(serializers=[borsh, json])]
#[derive(Clone, Debug, PartialEq)]
pub struct Checkpoint {
    pub city_id: String,
    pub from_step: u64,
    pub to_step: u64,
    pub new_state_root: String,
    pub new_city_root: String,
    pub stage: u8,
    pub items: BTreeMap<String, ItemFlow>,
    pub coin: CoinFlow,
    pub player_deltas: Vec<PlayerDelta>,
    pub executed_order_ids: Vec<String>,
}

#[near]
impl AfterHours {
    /// Register production and consumption caps for an arc. Operator only.
    pub fn register_arc(
        &mut self,
        arc_id: String,
        produce_cap_per_step: BTreeMap<String, U128>,
        consume_cap_per_step: BTreeMap<String, U128>,
    ) {
        require!(
            env::predecessor_account_id() == self.operator,
            "UNAUTHORIZED_OPERATOR"
        );
        validate_id(&arc_id, "INVALID_ARC_ID");
        require!(!self.arcs.contains_key(&arc_id), "DUPLICATE_ARC_ID");

        require!(produce_cap_per_step.len() <= 32, "TOO_MANY_ITEMS");
        require!(consume_cap_per_step.len() <= 32, "TOO_MANY_ITEMS");

        for item_id in produce_cap_per_step.keys() {
            validate_id(item_id, "INVALID_ITEM_ID");
        }
        for item_id in consume_cap_per_step.keys() {
            validate_id(item_id, "INVALID_ITEM_ID");
        }

        let caps = ArcCaps {
            arc_id: arc_id.clone(),
            produce_cap_per_step: produce_cap_per_step.clone(),
            consume_cap_per_step: consume_cap_per_step.clone(),
        };
        self.arcs.insert(arc_id.clone(), caps);

        crate::emit(
            "arc_registered",
            serde_json::json!({
                "arc_id": arc_id,
                "produce_cap_per_step": produce_cap_per_step,
                "consume_cap_per_step": consume_cap_per_step,
            }),
        );
    }

    /// View registered arc caps by arc_id.
    pub fn get_arc(&self, arc_id: String) -> Option<ArcCaps> {
        self.arcs.get(&arc_id).cloned()
    }

    /// Submit a verified simulation checkpoint. Operator only.
    pub fn submit_checkpoint(&mut self, cp: Checkpoint) {
        // 1. Authorization & step continuity
        require!(
            env::predecessor_account_id() == self.operator,
            "UNAUTHORIZED_OPERATOR"
        );
        let mut city = self.cities.get(&cp.city_id).cloned().expect("CITY_NOT_FOUND");
        require!(cp.from_step == city.step, "WRONG_FROM_STEP");
        require!(cp.to_step > cp.from_step, "INVALID_TO_STEP");
        let steps = cp.to_step.checked_sub(cp.from_step).expect("STEPS_UNDERFLOW");
        require!(
            steps <= crate::constants::MAX_STEPS_PER_CHECKPOINT,
            "TOO_MANY_STEPS"
        );

        // 2. Stage progression
        require!(cp.stage >= city.stage, "STAGE_REGRESSION");
        require!(cp.stage <= crate::constants::MAX_STAGE, "STAGE_EXCEEDS_MAX");

        // 3. Roots validity
        require!(
            crate::city::is_valid_hex_64(&cp.new_state_root),
            "INVALID_STATE_ROOT"
        );
        require!(
            crate::city::is_valid_hex_64(&cp.new_city_root),
            "INVALID_CITY_ROOT"
        );

        // 4. Executed order IDs bounds and deduplication
        require!(
            cp.executed_order_ids.len() <= crate::constants::MAX_ORDER_IDS_PER_CHECKPOINT,
            "TOO_MANY_ORDERS"
        );
        let mut seen_orders = std::collections::BTreeSet::new();
        for order_id in &cp.executed_order_ids {
            require!(!order_id.is_empty() && order_id.len() <= 64, "INVALID_ORDER_ID");
            require!(seen_orders.insert(order_id.clone()), "DUPLICATE_ORDER_ID");
            let key = format!("{}:{}", cp.city_id, order_id);
            require!(!self.executed_orders.contains(&key), "ORDER_ALREADY_EXECUTED");
        }

        // 5. Arc production and consumption caps
        let arc = self.arcs.get(&city.arc_id).expect("ARC_NOT_FOUND");
        let steps_u128 = steps as u128;
        for (item_id, flow) in &cp.items {
            validate_id(item_id, "INVALID_ITEM_ID");
            let prod_cap = arc.produce_cap_per_step.get(item_id).map(|u| u.0).unwrap_or(0);
            let cons_cap = arc.consume_cap_per_step.get(item_id).map(|u| u.0).unwrap_or(0);

            let max_produced = prod_cap.checked_mul(steps_u128).expect("CAP_OVERFLOW");
            require!(flow.produced.0 <= max_produced, "PRODUCE_CAP_EXCEEDED");

            let total_consumed = flow
                .consumed_recipe
                .0
                .checked_add(flow.consumed_pop.0)
                .expect("CONSUMED_OVERFLOW");
            let max_consumed = cons_cap.checked_mul(steps_u128).expect("CAP_OVERFLOW");
            require!(total_consumed <= max_consumed, "CONSUME_CAP_EXCEEDED");
        }

        // 6. Conservation per item and coin
        let mut new_totals_items = city.totals_items.clone();
        for (item_id, flow) in &cp.items {
            let old_total = city.totals_items.get(item_id).copied().unwrap_or(U128(0)).0;
            let mut additions = old_total;
            additions = additions.checked_add(flow.produced.0).expect("ADDITION_OVERFLOW");
            additions = additions.checked_add(flow.sourced.0).expect("ADDITION_OVERFLOW");
            additions = additions.checked_add(flow.trade_from_players.0).expect("ADDITION_OVERFLOW");

            let mut deductions = flow.consumed_recipe.0;
            deductions = deductions.checked_add(flow.consumed_pop.0).expect("DEDUCTION_OVERFLOW");
            deductions = deductions.checked_add(flow.sunk.0).expect("DEDUCTION_OVERFLOW");
            deductions = deductions.checked_add(flow.trade_to_players.0).expect("DEDUCTION_OVERFLOW");

            require!(additions >= deductions, "CONSERVATION_UNDERFLOW");
            let new_total = additions.checked_sub(deductions).expect("CONSERVATION_UNDERFLOW");
            new_totals_items.insert(item_id.clone(), U128(new_total));
        }

        // Coin conservation:
        let old_coin = city.total_coin.0;
        let mut coin_additions = old_coin;
        coin_additions = coin_additions.checked_add(cp.coin.sourced.0).expect("COIN_ADDITION_OVERFLOW");
        coin_additions = coin_additions.checked_add(cp.coin.trade_from_players.0).expect("COIN_ADDITION_OVERFLOW");

        let mut coin_deductions = cp.coin.sunk.0;
        coin_deductions = coin_deductions.checked_add(cp.coin.trade_to_players.0).expect("COIN_DEDUCTION_OVERFLOW");

        require!(coin_additions >= coin_deductions, "CONSERVATION_UNDERFLOW");
        let new_total_coin = coin_additions.checked_sub(coin_deductions).expect("CONSERVATION_UNDERFLOW");

        // 7. Player deltas validation
        require!(
            cp.player_deltas.len() <= 256,
            "TOO_MANY_PLAYER_DELTAS"
        );

        let mut delta_sums: BTreeMap<String, (u128, u128)> = BTreeMap::new();
        let mut player_tentative_balances: BTreeMap<(near_sdk::AccountId, String), u128> = BTreeMap::new();

        for pd in &cp.player_deltas {
            crate::mt::validate_receiver_id(&pd.account);
            if pd.token_id != "coin" {
                validate_id(&pd.token_id, "INVALID_TOKEN_ID");
            }

            // Accumulate token sums
            let entry = delta_sums.entry(pd.token_id.clone()).or_insert((0, 0));
            entry.0 = entry.0.checked_add(pd.delta_in.0).expect("DELTA_IN_OVERFLOW");
            entry.1 = entry.1.checked_add(pd.delta_out.0).expect("DELTA_OUT_OVERFLOW");

            // Track per-player balance safely
            let key = (pd.account.clone(), pd.token_id.clone());
            let current_bal = player_tentative_balances
                .get(&key)
                .copied()
                .unwrap_or_else(|| self.internal_balance_of(&pd.account, &pd.token_id));

            let after_in = current_bal.checked_add(pd.delta_in.0).expect("BALANCE_OVERFLOW");
            require!(after_in >= pd.delta_out.0, "NEGATIVE_PLAYER_BALANCE");
            let after_out = after_in.checked_sub(pd.delta_out.0).expect("BALANCE_UNDERFLOW");
            player_tentative_balances.insert(key, after_out);
        }

        // Match token trade sums against declared flows
        for (item_id, flow) in &cp.items {
            let (sum_in, sum_out) = delta_sums.remove(item_id).unwrap_or((0, 0));
            require!(
                sum_in == flow.trade_to_players.0 && sum_out == flow.trade_from_players.0,
                "PLAYER_DELTA_MISMATCH"
            );
        }

        let (coin_sum_in, coin_sum_out) = delta_sums.remove("coin").unwrap_or((0, 0));
        require!(
            coin_sum_in == cp.coin.trade_to_players.0 && coin_sum_out == cp.coin.trade_from_players.0,
            "PLAYER_DELTA_MISMATCH"
        );

        // Ensure no stray token deltas
        require!(delta_sums.is_empty(), "PLAYER_DELTA_MISMATCH");

        // 8. Commit mutations
        city.step = cp.to_step;
        city.stage = cp.stage;
        city.state_root = cp.new_state_root.clone();
        city.city_root = cp.new_city_root.clone();
        city.totals_items = new_totals_items.clone();
        city.total_coin = U128(new_total_coin);

        self.cities.insert(cp.city_id.clone(), city);

        for order_id in cp.executed_order_ids {
            let key = format!("{}:{}", cp.city_id, order_id);
            self.executed_orders.insert(key);
        }

        for pd in cp.player_deltas {
            if pd.delta_in.0 > 0 {
                self.mint_internal(&pd.account, &pd.token_id, pd.delta_in.0);
            }
            if pd.delta_out.0 > 0 {
                self.burn_internal(&pd.account, &pd.token_id, pd.delta_out.0);
            }
        }

        crate::emit(
            "checkpoint",
            serde_json::json!({
                "city_id": cp.city_id,
                "from_step": cp.from_step,
                "to_step": cp.to_step,
                "state_root": cp.new_state_root,
                "city_root": cp.new_city_root,
                "stage": cp.stage,
                "total_coin": new_total_coin.to_string(),
                "totals_items": new_totals_items,
            }),
        );
    }

    /// View whether an order ID has already been executed for a city.
    pub fn get_executed(&self, city_id: String, order_id: String) -> bool {
        self.executed_orders.contains(&format!("{city_id}:{order_id}"))
    }
}
