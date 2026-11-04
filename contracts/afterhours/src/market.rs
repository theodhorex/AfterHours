//! City market for AfterHours: city listing, cancellation, and escrow purchase.

use crate::{AfterHours, AfterHoursExt};
use near_sdk::json_types::U128;
use near_sdk::{env, near, require, AccountId, NearToken, Promise};

#[near(serializers=[borsh, json])]
#[derive(Clone, Debug, PartialEq)]
pub struct Listing {
    pub city_id: String,
    pub seller: AccountId,
    pub price_yocto: U128,
}

#[near]
impl AfterHours {
    /// Lists an owned city for sale at `price_yocto` NEAR.
    pub fn list_city(&mut self, city_id: String, price_yocto: U128) {
        let caller = env::predecessor_account_id();
        let city = self.cities.get(&city_id).unwrap_or_else(|| env::panic_str("NOT_CITY_OWNER"));
        require!(city.owner == caller, "NOT_CITY_OWNER");
        require!(price_yocto.0 > 0, "INVALID_PRICE");
        require!(!self.listings.contains_key(&city_id), "ALREADY_LISTED");

        let listing = Listing {
            city_id: city_id.clone(),
            seller: caller.clone(),
            price_yocto,
        };
        self.listings.insert(city_id.clone(), listing);

        crate::emit(
            "city_listed",
            serde_json::json!({
                "city_id": city_id,
                "seller": caller,
                "price_yocto": price_yocto.0.to_string(),
            }),
        );
    }

    /// Cancels an existing listing. Seller only.
    pub fn cancel_listing(&mut self, city_id: String) {
        let caller = env::predecessor_account_id();
        let listing = self
            .listings
            .get(&city_id)
            .unwrap_or_else(|| env::panic_str("NO_LISTING"));
        require!(listing.seller == caller, "NOT_SELLER");

        self.listings.remove(&city_id);

        crate::emit(
            "listing_cancelled",
            serde_json::json!({
                "city_id": city_id,
                "seller": caller,
            }),
        );
    }

    /// Views listing for a city, if any.
    pub fn get_listing(&self, city_id: String) -> Option<Listing> {
        self.listings.get(&city_id).cloned()
    }

    /// Buys an active city listing using attached NEAR deposit.
    #[payable]
    pub fn buy_city(&mut self, city_id: String, expected_city_root: String) {
        let listing = self
            .listings
            .get(&city_id)
            .cloned()
            .unwrap_or_else(|| env::panic_str("NO_LISTING"));

        let deposit = env::attached_deposit();
        let price = NearToken::from_yoctonear(listing.price_yocto.0);
        require!(deposit >= price, "INSUFFICIENT_PAYMENT");

        let buyer = env::predecessor_account_id();
        require!(buyer != listing.seller, "SELF_PURCHASE");

        let mut city = self
            .cities
            .get(&city_id)
            .cloned()
            .unwrap_or_else(|| env::panic_str("NO_CITY"));
        require!(city.city_root == expected_city_root, "CITY_ROOT_CHANGED");
        require!(city.owner == listing.seller, "SELLER_NOT_CITY_OWNER");

        // Checks-Effects-Interactions: state changes before external calls
        self.listings.remove(&city_id);

        city.owner = buyer.clone();
        self.cities.insert(city_id.clone(), city);

        crate::emit(
            "city_sold",
            serde_json::json!({
                "city_id": city_id,
                "seller": listing.seller,
                "buyer": buyer,
                "price_yocto": listing.price_yocto.0.to_string(),
            }),
        );

        // Interactions: transfer purchase price to seller and refund excess to buyer with callback
        Promise::new(listing.seller.clone())
            .transfer(price)
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(near_sdk::Gas::from_tgas(5))
                    .on_payout(listing.seller.clone(), price),
            )
            .detach();

        let refund = deposit.saturating_sub(price);
        if refund.as_yoctonear() > 0 {
            Promise::new(buyer.clone())
                .transfer(refund)
                .then(
                    Self::ext(env::current_account_id())
                        .with_static_gas(near_sdk::Gas::from_tgas(5))
                        .on_payout(buyer.clone(), refund),
                )
                .detach();
        }
    }

    /// Callback for purchase payout or refund transfer. Records claimable balance on failure.
    #[private]
    pub fn on_payout(
        &mut self,
        account_id: AccountId,
        amount: NearToken,
        #[callback_result] result: Result<(), near_sdk::PromiseError>,
    ) {
        if result.is_err() {
            let cur = self
                .claimable
                .get(&account_id)
                .copied()
                .unwrap_or(NearToken::from_yoctonear(0));
            let new_amount = NearToken::from_yoctonear(
                cur.as_yoctonear().saturating_add(amount.as_yoctonear()),
            );
            self.claimable.insert(account_id.clone(), new_amount);
            crate::emit(
                "payout_failed",
                serde_json::json!({
                    "account_id": account_id,
                    "amount": amount.as_yoctonear().to_string(),
                }),
            );
        }
    }

    /// Withdraw accumulated claimable balance from failed payouts or refunds.
    pub fn withdraw_claimable(&mut self) -> Promise {
        let caller = env::predecessor_account_id();
        let amount = self
            .claimable
            .get(&caller)
            .copied()
            .unwrap_or(NearToken::from_yoctonear(0));
        require!(amount.as_yoctonear() > 0, "NO_CLAIMABLE_BALANCE");
        self.claimable.remove(&caller);

        crate::emit(
            "claimable_withdrawn",
            serde_json::json!({
                "account_id": caller,
                "amount": amount.as_yoctonear().to_string(),
            }),
        );

        Promise::new(caller).transfer(amount)
    }

    /// View claimable balance for an account in yoctoNEAR.
    pub fn get_claimable(&self, account_id: AccountId) -> U128 {
        U128(
            self.claimable
                .get(&account_id)
                .map(|t| t.as_yoctonear())
                .unwrap_or(0),
        )
    }
}
