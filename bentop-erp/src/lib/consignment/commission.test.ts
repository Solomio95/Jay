import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  calculateCommission,
  DEFAULT_COMMISSION_TIERS,
} from "./commission";

describe("calculateCommission", () => {
  it("uses Super Best Buy for RM 49.90", () => {
    const result = calculateCommission({ actualUnitPrice: 49.9 });

    assert.equal(result.tierName, "Super Best Buy");
    assert.equal(result.source, "tier");
  });

  it("uses Best Buy for RM 50.00", () => {
    const result = calculateCommission({ actualUnitPrice: 50 });

    assert.equal(result.tierName, "Best Buy");
    assert.equal(result.source, "tier");
  });

  it("rounds RM 49.995 to cents before selecting the tier", () => {
    const result = calculateCommission({ actualUnitPrice: 49.995 });

    assert.equal(result.tierName, "Best Buy");
    assert.equal(result.grossAmount, 50);
  });

  it("uses Best Buy for RM 109.00", () => {
    const result = calculateCommission({ actualUnitPrice: 109 });

    assert.equal(result.tierName, "Best Buy");
    assert.equal(result.source, "tier");
  });

  it("uses Normal for RM 110.00", () => {
    const result = calculateCommission({ actualUnitPrice: 110 });

    assert.equal(result.tierName, "Normal");
    assert.equal(result.source, "tier");
  });

  it("rounds RM 109.999 to cents before selecting the tier", () => {
    const result = calculateCommission({ actualUnitPrice: 109.999 });

    assert.equal(result.tierName, "Normal");
    assert.equal(result.grossAmount, 110);
  });

  it("uses Super Best Buy for a discounted RM 48 actual unit price", () => {
    const result = calculateCommission({ actualUnitPrice: 48 });

    assert.equal(result.tierName, "Super Best Buy");
    assert.equal(result.source, "tier");
  });

  it("uses an override instead of the price tier", () => {
    const result = calculateCommission({
      actualUnitPrice: 48,
      override: {
        tierName: "Partner Promo",
        commissionRate: 12.5,
      },
    });

    assert.equal(result.tierName, "Partner Promo");
    assert.equal(result.commissionRate, 12.5);
    assert.equal(result.source, "override");
  });

  it("calculates gross, commission, and net for 3 units at RM 50 and 25%", () => {
    const bestBuyTier = DEFAULT_COMMISSION_TIERS.find(
      (tier) => tier.name === "Best Buy",
    );

    assert.equal(bestBuyTier?.commissionRate, 25);

    const result = calculateCommission({
      actualUnitPrice: 50,
      quantitySold: 3,
    });

    assert.deepEqual(
      {
        tierName: result.tierName,
        commissionRate: result.commissionRate,
        source: result.source,
        grossAmount: result.grossAmount,
        commissionAmount: result.commissionAmount,
        netAmount: result.netAmount,
      },
      {
        tierName: "Best Buy",
        commissionRate: 25,
        source: "tier",
        grossAmount: 150,
        commissionAmount: 37.5,
        netAmount: 112.5,
      },
    );
  });
});
