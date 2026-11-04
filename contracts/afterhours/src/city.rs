//! City registry for AfterHours.
//!
//! Stores CityRecord entries created by the operator, validating IDs, roots, and totals.

use crate::{AfterHours, AfterHoursExt};
use near_sdk::json_types::U128;
use near_sdk::{env, near, require, AccountId};
use std::collections::BTreeMap;

#[near(serializers=[borsh, json])]
#[derive(Clone, Debug, PartialEq)]
pub struct CityRecord {
    pub city_id: String,
    pub arc_id: String,
    pub server_id: String,
    pub owner: AccountId,
    pub step: u64,
    pub stage: u8,
    pub state_root: String,
    pub city_root: String,
    pub parent_root: Option<String>,
    pub totals_items: BTreeMap<String, U128>,
    pub total_coin: U128,
}

pub(crate) fn is_valid_hex_64(s: &str) -> bool {
    s.len() == 64 && s.chars().all(|c| c.is_ascii_hexdigit())
}

pub(crate) fn validate_city_id(id: &str) {
    require!(
        !id.is_empty()
            && id.len() <= 64
            && id.bytes().all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || matches!(b, b'.' | b'_' | b'-')),
        "INVALID_CITY_ID"
    );
}

#[near]
impl AfterHours {
    /// Register a new city. Operator only.
    #[allow(clippy::too_many_arguments)]
    pub fn create_city(
        &mut self,
        city_id: String,
        arc_id: String,
        server_id: String,
        owner: AccountId,
        state_root: String,
        city_root: String,
        parent_root: Option<String>,
        totals_items: BTreeMap<String, U128>,
        total_coin: U128,
    ) {
        require!(
            env::predecessor_account_id() == self.operator,
            "UNAUTHORIZED_OPERATOR"
        );
        validate_city_id(&city_id);
        require!(!self.cities.contains_key(&city_id), "DUPLICATE_CITY_ID");
        crate::mt::validate_receiver_id(&owner);

        require!(is_valid_hex_64(&state_root), "INVALID_STATE_ROOT");
        require!(is_valid_hex_64(&city_root), "INVALID_CITY_ROOT");
        if let Some(ref pr) = parent_root {
            require!(is_valid_hex_64(pr), "INVALID_PARENT_ROOT");
        }

        require!(totals_items.len() <= 32, "TOO_MANY_TOTALS_ITEMS");

        let record = CityRecord {
            city_id: city_id.clone(),
            arc_id: arc_id.clone(),
            server_id: server_id.clone(),
            owner: owner.clone(),
            step: 0,
            stage: 0,
            state_root: state_root.clone(),
            city_root: city_root.clone(),
            parent_root: parent_root.clone(),
            totals_items: totals_items.clone(),
            total_coin,
        };

        self.cities.insert(city_id.clone(), record);

        crate::emit(
            "city_created",
            serde_json::json!({
                "city_id": city_id,
                "arc_id": arc_id,
                "server_id": server_id,
                "owner": owner,
                "state_root": state_root,
                "city_root": city_root,
                "parent_root": parent_root,
                "total_coin": total_coin.0.to_string(),
            }),
        );
    }

    /// View city record by city_id.
    pub fn get_city(&self, city_id: String) -> Option<CityRecord> {
        self.cities.get(&city_id).cloned()
    }

    /// View city_root by city_id.
    pub fn get_city_root(&self, city_id: String) -> Option<String> {
        self.cities.get(&city_id).map(|c| c.city_root.clone())
    }
}
