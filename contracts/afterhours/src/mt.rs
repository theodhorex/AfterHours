//! Minimal NEP-245 Multi-Token implementation for AfterHours.
//!
//! Note: `mt_transfer_call`, approvals, and metadata are intentionally NOT implemented
//! (honest limit). Only core multi-token transfers, batch transfers, balances,
//! token enumeration, and supply tracking are implemented.

use crate::{AfterHours, AfterHoursExt};
use near_sdk::json_types::U128;
use near_sdk::{env, near, require, AccountId};

pub(crate) fn validate_receiver_id(account_id: &AccountId) {
    let s = account_id.as_str();
    require!(
        s.len() >= 2
            && s.len() <= 64
            && s.bytes().all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || matches!(b, b'.' | b'_' | b'-'))
            && AccountId::validate(s).is_ok(),
        "INVALID_RECEIVER_ID"
    );
}

impl AfterHours {
    pub(crate) fn internal_balance_of(&self, account_id: &AccountId, token_id: &str) -> u128 {
        self.balances
            .get(&(account_id.clone(), token_id.to_string()))
            .copied()
            .unwrap_or(0)
    }

    #[allow(dead_code)]
    pub(crate) fn mint_internal(&mut self, account_id: &AccountId, token_id: &str, amount: u128) {
        if amount == 0 {
            return;
        }
        let cur = self.internal_balance_of(account_id, token_id);
        let new_bal = cur.checked_add(amount).expect("BALANCE_OVERFLOW");
        self.balances
            .insert((account_id.clone(), token_id.to_string()), new_bal);

        let cur_supply = self.supply.get(token_id).copied().unwrap_or(0);
        let new_supply = cur_supply.checked_add(amount).expect("SUPPLY_OVERFLOW");
        self.supply.insert(token_id.to_string(), new_supply);

        if cur == 0 {
            let mut list = self.tokens_for_owner.get(account_id).cloned().unwrap_or_default();
            if !list.iter().any(|t| t == token_id) {
                list.push(token_id.to_string());
                self.tokens_for_owner.insert(account_id.clone(), list);
            }
        }

        crate::emit(
            "mt_mint",
            serde_json::json!({
                "account_id": account_id,
                "token_id": token_id,
                "amount": amount.to_string(),
            }),
        );
    }

    #[allow(dead_code)]
    pub(crate) fn burn_internal(&mut self, account_id: &AccountId, token_id: &str, amount: u128) {
        if amount == 0 {
            return;
        }
        let cur = self.internal_balance_of(account_id, token_id);
        let new_bal = cur.checked_sub(amount).expect("INSUFFICIENT_BALANCE");
        self.balances
            .insert((account_id.clone(), token_id.to_string()), new_bal);

        let cur_supply = self.supply.get(token_id).copied().expect("NO_SUPPLY");
        let new_supply = cur_supply.checked_sub(amount).expect("SUPPLY_UNDERFLOW");
        self.supply.insert(token_id.to_string(), new_supply);

        if new_bal == 0 {
            if let Some(mut list) = self.tokens_for_owner.get(account_id).cloned() {
                list.retain(|t| t != token_id);
                self.tokens_for_owner.insert(account_id.clone(), list);
            }
        }

        crate::emit(
            "mt_burn",
            serde_json::json!({
                "account_id": account_id,
                "token_id": token_id,
                "amount": amount.to_string(),
            }),
        );
    }
}

#[near]
impl AfterHours {
    /// Transfers `amount` of `token_id` to `receiver_id`. Requires exactly 1 yoctoNEAR.
    #[payable]
    pub fn mt_transfer(
        &mut self,
        receiver_id: AccountId,
        token_id: String,
        amount: U128,
        approval: Option<u64>,
        memo: Option<String>,
    ) {
        let _ = approval; // Approvals not implemented
        require!(
            env::attached_deposit().as_yoctonear() == 1,
            "REQUIRES_EXACTLY_1_YOCTO"
        );
        let sender_id = env::predecessor_account_id();
        require!(sender_id != receiver_id, "SELF_TRANSFER");
        require!(amount.0 > 0, "ZERO_AMOUNT");
        validate_receiver_id(&receiver_id);

        let sender_bal = self.internal_balance_of(&sender_id, &token_id);
        require!(sender_bal >= amount.0, "INSUFFICIENT_BALANCE");
        let new_sender_bal = sender_bal.checked_sub(amount.0).expect("UNDERFLOW");
        self.balances
            .insert((sender_id.clone(), token_id.clone()), new_sender_bal);

        let receiver_bal = self.internal_balance_of(&receiver_id, &token_id);
        let new_receiver_bal = receiver_bal.checked_add(amount.0).expect("OVERFLOW");
        self.balances
            .insert((receiver_id.clone(), token_id.clone()), new_receiver_bal);

        if new_sender_bal == 0 {
            if let Some(mut list) = self.tokens_for_owner.get(&sender_id).cloned() {
                list.retain(|t| t != &token_id);
                self.tokens_for_owner.insert(sender_id.clone(), list);
            }
        }
        if receiver_bal == 0 {
            let mut list = self
                .tokens_for_owner
                .get(&receiver_id)
                .cloned()
                .unwrap_or_default();
            if !list.iter().any(|t| t == &token_id) {
                list.push(token_id.clone());
                self.tokens_for_owner.insert(receiver_id.clone(), list);
            }
        }

        // Emit standard NEP-297 afterhours event
        crate::emit(
            "mt_transfer",
            serde_json::json!({
                "sender_id": sender_id,
                "receiver_id": receiver_id,
                "token_ids": [token_id],
                "amounts": [amount.0.to_string()],
                "memo": memo,
            }),
        );

        // Emit standard NEP-245 mt_transfer event shape
        let nep245_event = serde_json::json!({
            "standard": "nep245",
            "version": "1.0.0",
            "event": "mt_transfer",
            "data": [{
                "authorized_id": null,
                "old_owner_id": sender_id,
                "new_owner_id": receiver_id,
                "token_ids": [token_id],
                "amounts": [amount.0.to_string()],
                "memo": memo,
            }]
        });
        env::log_str(&format!("EVENT_JSON:{nep245_event}"));
    }

    /// Batch transfer multiple tokens to `receiver_id`. Requires exactly 1 yoctoNEAR.
    #[payable]
    pub fn mt_batch_transfer(
        &mut self,
        receiver_id: AccountId,
        token_ids: Vec<String>,
        amounts: Vec<U128>,
        approvals: Option<Vec<Option<u64>>>,
        memo: Option<String>,
    ) {
        require!(
            env::attached_deposit().as_yoctonear() == 1,
            "REQUIRES_EXACTLY_1_YOCTO"
        );
        let sender_id = env::predecessor_account_id();
        require!(sender_id != receiver_id, "SELF_TRANSFER");
        validate_receiver_id(&receiver_id);
        require!(token_ids.len() == amounts.len(), "MISMATCHED_LENGTHS");
        if let Some(ref apps) = approvals {
            require!(apps.len() == token_ids.len(), "MISMATCHED_LENGTHS");
        }
        for a in &amounts {
            require!(a.0 > 0, "ZERO_AMOUNT");
        }

        for (token_id, amount) in token_ids.iter().zip(amounts.iter()) {
            let sender_bal = self.internal_balance_of(&sender_id, token_id);
            require!(sender_bal >= amount.0, "INSUFFICIENT_BALANCE");
            let new_sender_bal = sender_bal.checked_sub(amount.0).expect("UNDERFLOW");
            self.balances
                .insert((sender_id.clone(), token_id.clone()), new_sender_bal);

            let receiver_bal = self.internal_balance_of(&receiver_id, token_id);
            let new_receiver_bal = receiver_bal.checked_add(amount.0).expect("OVERFLOW");
            self.balances
                .insert((receiver_id.clone(), token_id.clone()), new_receiver_bal);

            if new_sender_bal == 0 {
                if let Some(mut list) = self.tokens_for_owner.get(&sender_id).cloned() {
                    list.retain(|t| t != token_id);
                    self.tokens_for_owner.insert(sender_id.clone(), list);
                }
            }
            if receiver_bal == 0 {
                let mut list = self
                    .tokens_for_owner
                    .get(&receiver_id)
                    .cloned()
                    .unwrap_or_default();
                if !list.iter().any(|t| t == token_id) {
                    list.push(token_id.clone());
                    self.tokens_for_owner.insert(receiver_id.clone(), list);
                }
            }
        }

        let amounts_str: Vec<String> = amounts.iter().map(|a| a.0.to_string()).collect();

        // Emit standard NEP-297 afterhours event
        crate::emit(
            "mt_batch_transfer",
            serde_json::json!({
                "sender_id": sender_id,
                "receiver_id": receiver_id,
                "token_ids": token_ids,
                "amounts": amounts_str,
                "memo": memo,
            }),
        );

        // Emit standard NEP-245 mt_transfer event shape
        let nep245_event = serde_json::json!({
            "standard": "nep245",
            "version": "1.0.0",
            "event": "mt_transfer",
            "data": [{
                "authorized_id": null,
                "old_owner_id": sender_id,
                "new_owner_id": receiver_id,
                "token_ids": token_ids,
                "amounts": amounts_str,
                "memo": memo,
            }]
        });
        env::log_str(&format!("EVENT_JSON:{nep245_event}"));
    }

    /// View balance of a single token for an account.
    pub fn mt_balance_of(&self, account_id: AccountId, token_id: String) -> U128 {
        U128(self.internal_balance_of(&account_id, &token_id))
    }

    /// View balances of multiple tokens for an account.
    pub fn mt_batch_balance_of(
        &self,
        account_id: AccountId,
        token_ids: Vec<String>,
    ) -> Vec<U128> {
        token_ids
            .into_iter()
            .map(|t| U128(self.internal_balance_of(&account_id, &t)))
            .collect()
    }

    /// View total circulating supply of a token. Returns None if never minted.
    pub fn mt_supply(&self, token_id: String) -> Option<U128> {
        self.supply.get(&token_id).copied().map(U128)
    }

    /// View token IDs held by owner, bounded to maximum limit of 100.
    pub fn mt_tokens_for_owner(
        &self,
        account_id: AccountId,
        from_index: Option<u64>,
        limit: Option<u64>,
    ) -> Vec<String> {
        let limit = limit.unwrap_or(100).min(100) as usize;
        let start = from_index.unwrap_or(0) as usize;
        let tokens = self
            .tokens_for_owner
            .get(&account_id)
            .cloned()
            .unwrap_or_default();
        tokens.into_iter().skip(start).take(limit).collect()
    }
}
