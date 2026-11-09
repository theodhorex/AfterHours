import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  NAV_GROUPS,
  FOOTER_NAV_ITEM,
  isActiveNav,
  filterNavGroups,
  getBreadcrumbs,
} from "../src/lib/atlas-nav.ts";

describe("atlas-nav helpers", () => {
  describe("NAV_GROUPS structure", () => {
    it("contains expected groups with sentence-case labels", () => {
      const labels = NAV_GROUPS.map((g) => g.label);
      assert.deepEqual(labels, ["Overview", "Trade", "Account", "Insights"]);
    });

    it("has all expected navigation items", () => {
      const allItems = NAV_GROUPS.flatMap((g) => g.items);
      const hrefs = allItems.map((i) => i.href);
      assert.ok(hrefs.includes("/atlas"));
      assert.ok(hrefs.includes("/atlas/market"));
      assert.ok(hrefs.includes("/atlas/caravans"));
      assert.ok(hrefs.includes("/atlas/exchange"));
      assert.ok(hrefs.includes("/atlas/cities"));
      assert.ok(hrefs.includes("/atlas/welcome"));
      assert.ok(hrefs.includes("/atlas/leaderboard"));
      assert.ok(hrefs.includes("/atlas/audit"));
    });

    it("has footer item pointing back to landing", () => {
      assert.equal(FOOTER_NAV_ITEM.href, "/");
      assert.equal(FOOTER_NAV_ITEM.label, "Back to landing");
    });
  });

  describe("isActiveNav", () => {
    it("matches exact /atlas without matching sub-routes", () => {
      assert.equal(isActiveNav("/atlas", "/atlas"), true);
      assert.equal(isActiveNav("/atlas/", "/atlas"), true);
      assert.equal(isActiveNav("/atlas/market", "/atlas"), false);
      assert.equal(isActiveNav("/atlas/caravans", "/atlas"), false);
    });

    it("matches sub-routes correctly", () => {
      assert.equal(isActiveNav("/atlas/market", "/atlas/market"), true);
      assert.equal(isActiveNav("/atlas/market/", "/atlas/market"), true);
      assert.equal(isActiveNav("/atlas/market/item-1", "/atlas/market"), true);
      assert.equal(isActiveNav("/atlas/caravans", "/atlas/market"), false);
    });

    it("matches landing route / exactly", () => {
      assert.equal(isActiveNav("/", "/"), true);
      assert.equal(isActiveNav("/atlas", "/"), false);
    });
  });

  describe("filterNavGroups", () => {
    it("hides Welcome when user is authenticated", () => {
      const signedIn = filterNavGroups(NAV_GROUPS, "", true);
      const accountGroupSignedIn = signedIn.find((g) => g.id === "account");
      assert.ok(accountGroupSignedIn);
      const welcomeItem = accountGroupSignedIn.items.find((i) => i.href === "/atlas/welcome");
      assert.equal(welcomeItem, undefined);

      const signedOut = filterNavGroups(NAV_GROUPS, "", false);
      const accountGroupSignedOut = signedOut.find((g) => g.id === "account");
      assert.ok(accountGroupSignedOut);
      const welcomeItemOut = accountGroupSignedOut.items.find((i) => i.href === "/atlas/welcome");
      assert.ok(welcomeItemOut);
    });

    it("filters items by search query case-insensitively", () => {
      const filtered = filterNavGroups(NAV_GROUPS, "caravan", false);
      assert.equal(filtered.length, 1);
      assert.equal(filtered[0].id, "trade");
      assert.equal(filtered[0].items.length, 1);
      assert.equal(filtered[0].items[0].href, "/atlas/caravans");
    });

    it("returns empty groups array if query matches nothing", () => {
      const filtered = filterNavGroups(NAV_GROUPS, "nonexistentpage", false);
      assert.equal(filtered.length, 0);
    });
  });

  describe("getBreadcrumbs", () => {
    it("generates single breadcrumb for /atlas", () => {
      const crumbs = getBreadcrumbs("/atlas");
      assert.deepEqual(crumbs, [
        { label: "Atlas", href: "/atlas", isCurrent: true },
      ]);
    });

    it("generates breadcrumbs for sub-routes", () => {
      const crumbs = getBreadcrumbs("/atlas/market");
      assert.deepEqual(crumbs, [
        { label: "Atlas", href: "/atlas", isCurrent: false },
        { label: "Global market", href: "/atlas/market", isCurrent: true },
      ]);
    });

    it("generates breadcrumbs for deeply nested or unknown sub-routes", () => {
      const crumbs = getBreadcrumbs("/atlas/leaderboard");
      assert.deepEqual(crumbs, [
        { label: "Atlas", href: "/atlas", isCurrent: false },
        { label: "Leaderboard", href: "/atlas/leaderboard", isCurrent: true },
      ]);
    });
  });
});
