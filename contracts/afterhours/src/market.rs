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
    pub fn buy_city(&mut self, city_id: String) {
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

        // Checks-Effects-Interactions: state changes before external calls
        self.listings.remove(&city_id);

        let mut city = self
            .cities
            .get(&city_id)
            .cloned()
            .unwrap_or_else(|| env::panic_str("NO_CITY"));
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

        // Interactions: transfer purchase price to seller and refund excess to buyer
        Promise::new(listing.seller).transfer(price).detach();

        let refund = deposit.saturating_sub(price);
        if refund.as_yoctonear() > 0 {
            Promise::new(buyer).transfer(refund).detach();
        }
    }
}
