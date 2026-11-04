//! AfterHours smart contract: city registry, NEP-245 multi-token, and checkpoint verification.

use near_sdk::store::{LookupMap, LookupSet};
use near_sdk::{env, near, require, AccountId, PanicOnDefault};

pub mod constants {
    use near_sdk::NearToken;
    pub const MAX_STEPS_PER_CHECKPOINT: u64 = 40;
    pub const MAX_ORDER_IDS_PER_CHECKPOINT: usize = 256;
    pub const MAX_STAGE: u8 = 4;
    pub const STORAGE_DEPOSIT_MIN: NearToken = NearToken::from_yoctonear(10_000_000_000_000_000_000_000);
}

pub mod checkpoint;
pub mod city;
pub mod mt;

pub use checkpoint::{ArcCaps, Checkpoint, CoinFlow, ItemFlow, PlayerDelta};
pub use city::CityRecord;
pub use mt::{StorageBalance, StorageBalanceBounds};

const EVENT_STANDARD: &str = "afterhours";
const EVENT_VERSION: &str = "1.0.0";

pub(crate) fn emit(event: &str, data: serde_json::Value) {
    let e = serde_json::json!({
        "standard": EVENT_STANDARD,
        "version": EVENT_VERSION,
        "event": event,
        "data": [data],
    });
    env::log_str(&format!("EVENT_JSON:{e}"));
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct AfterHours {
    pub owner: AccountId,
    pub operator: AccountId,
    pub balances: LookupMap<(AccountId, String), u128>,
    pub supply: LookupMap<String, u128>,
    pub tokens_for_owner: LookupMap<AccountId, Vec<String>>,
    pub cities: LookupMap<String, CityRecord>,
    pub arcs: LookupMap<String, ArcCaps>,
    pub executed_orders: LookupSet<String>,
    pub registered_accounts: LookupSet<AccountId>,
}

#[near]
impl AfterHours {
    #[init]
    pub fn new(operator: AccountId) -> Self {
        let owner = env::predecessor_account_id();
        Self {
            owner,
            operator,
            balances: LookupMap::new(b"b"),
            supply: LookupMap::new(b"s"),
            tokens_for_owner: LookupMap::new(b"t"),
            cities: LookupMap::new(b"c"),
            arcs: LookupMap::new(b"a"),
            executed_orders: LookupSet::new(b"e"),
            registered_accounts: LookupSet::new(b"r"),
        }
    }

    /// Change contract operator. Owner only.
    pub fn set_operator(&mut self, operator: AccountId) {
        require!(env::predecessor_account_id() == self.owner, "UNAUTHORIZED_OWNER");
        let old_operator = self.operator.clone();
        self.operator = operator.clone();
        emit("set_operator", serde_json::json!({
            "old_operator": old_operator,
            "new_operator": operator,
        }));
    }

    /// View current operator.
    pub fn get_operator(&self) -> AccountId {
        self.operator.clone()
    }

    /// View current contract owner.
    pub fn get_owner(&self) -> AccountId {
        self.owner.clone()
    }
}

#[cfg(test)]
mod tests;
#[cfg(test)]
mod checkpoint_tests;
