import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canCreatePromoterSale,
  canManageConsignment,
  canManageImports,
  canManageProducts,
  canManagePurchases,
  canManageStock,
  canManageTransfer,
  canViewLocationStock,
  canViewReports,
  stockLocationScopeForUser,
} from "./permissions";

describe("central permission policy", () => {
  it("limits product and import setup to admin and manager", () => {
    assert.equal(canManageProducts("ADMIN"), true);
    assert.equal(canManageProducts("MANAGER"), true);
    assert.equal(canManageProducts("STAFF"), false);
    assert.equal(canManageImports("SUPERVISOR"), false);
    assert.equal(canManageImports("VIEWER"), false);
  });

  it("allows stock operations for HQ roles but not viewer or promoter", () => {
    assert.equal(canManageStock("ADMIN"), true);
    assert.equal(canManageStock("MANAGER"), true);
    assert.equal(canManageStock("STAFF"), true);
    assert.equal(canManageStock("VIEWER"), false);
    assert.equal(canManageStock("PROMOTER"), false);
  });

  it("keeps promoter stock views inside assigned and temporary locations", () => {
    const user = {
      role: "PROMOTER",
      defaultLocationId: "loc-a",
      supervisedLocationIds: [],
      temporaryLocationIds: ["loc-b"],
    } as const;

    assert.equal(canViewLocationStock(user, "loc-a"), true);
    assert.equal(canViewLocationStock(user, "loc-b"), true);
    assert.equal(canViewLocationStock(user, "loc-c"), false);
    assert.equal(canViewLocationStock(user, undefined), false);
    assert.deepEqual(stockLocationScopeForUser(user), ["loc-a", "loc-b"]);
  });

  it("keeps supervisor stock and transfer work inside supervised locations", () => {
    const user = {
      role: "SUPERVISOR",
      defaultLocationId: null,
      supervisedLocationIds: ["loc-a"],
      temporaryLocationIds: [],
    } as const;

    assert.equal(canViewLocationStock(user, "loc-a"), true);
    assert.equal(canViewLocationStock(user, "loc-b"), false);
    assert.equal(
      canManageTransfer(user, { fromLocationId: "loc-a", toLocationId: "loc-b" }),
      true,
    );
    assert.equal(
      canManageTransfer(user, { fromLocationId: "loc-b", toLocationId: "loc-c" }),
      false,
    );
    assert.deepEqual(stockLocationScopeForUser(user), ["loc-a"]);
  });

  it("limits promoter sales to allowed locations", () => {
    assert.equal(canCreatePromoterSale({ role: "PROMOTER" }, "loc-a", ["loc-a"]), true);
    assert.equal(canCreatePromoterSale({ role: "PROMOTER" }, "loc-b", ["loc-a"]), false);
    assert.equal(canCreatePromoterSale({ role: "STAFF" }, "loc-a", ["loc-a"]), false);
  });

  it("separates purchases, consignment, and reports", () => {
    assert.equal(canManagePurchases("MANAGER"), true);
    assert.equal(canManagePurchases("SUPERVISOR"), false);
    assert.equal(canManageConsignment("ADMIN"), true);
    assert.equal(canManageConsignment("STAFF"), false);
    assert.equal(canViewReports("VIEWER"), true);
    assert.equal(canViewReports("PROMOTER"), false);
  });
});
