import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  calculatePromoterSaleLinePrices,
  calculatePromotionUnitPrices,
} from "./promotions";

describe("calculatePromotionUnitPrices", () => {
  it("applies 2 for RM100 as RM50 per item for the same SKU", () => {
    const result = calculatePromotionUnitPrices({
      ruleMode: "SAME_SKU",
      bundleQuantity: 2,
      bundlePrice: 100,
      items: [
        {
          productVariantId: "sku-a",
          productId: "parent-a",
          quantity: 2,
          normalUnitPrice: 59.9,
        },
      ],
    });

    assert.deepEqual(
      result.map((item) => item.effectiveUnitPrice),
      [50, 50],
    );
  });

  it("applies mix-and-match pricing across selected variants", () => {
    const result = calculatePromotionUnitPrices({
      ruleMode: "MIX_AND_MATCH",
      bundleQuantity: 2,
      bundlePrice: 100,
      items: [
        {
          productVariantId: "sku-a",
          productId: "parent-a",
          quantity: 1,
          normalUnitPrice: 59.9,
        },
        {
          productVariantId: "sku-b",
          productId: "parent-b",
          quantity: 1,
          normalUnitPrice: 69.9,
        },
      ],
    });

    assert.deepEqual(
      result.map((item) => item.effectiveUnitPrice),
      [50, 50],
    );
  });

  it("keeps leftover same-SKU units at normal price", () => {
    const result = calculatePromotionUnitPrices({
      ruleMode: "SAME_SKU",
      bundleQuantity: 2,
      bundlePrice: 100,
      items: [
        {
          productVariantId: "sku-a",
          productId: "parent-a",
          quantity: 3,
          normalUnitPrice: 59.9,
        },
      ],
    });

    assert.deepEqual(
      result.map((item) => item.effectiveUnitPrice),
      [50, 50, 59.9],
    );
  });

  it("rounds bundle unit prices to cents", () => {
    const result = calculatePromotionUnitPrices({
      ruleMode: "MIX_AND_MATCH",
      bundleQuantity: 3,
      bundlePrice: 100,
      items: [
        {
          productVariantId: "sku-a",
          productId: "parent-a",
          quantity: 3,
          normalUnitPrice: 49.9,
        },
      ],
    });

    assert.deepEqual(
      result.map((item) => item.effectiveUnitPrice),
      [33.33, 33.33, 33.33],
    );
  });
});

describe("calculatePromoterSaleLinePrices", () => {
  it("uses the HQ selling price when no promotion applies", () => {
    const result = calculatePromoterSaleLinePrices({
      items: [
        {
          productVariantId: "sku-a",
          productId: "parent-a",
          quantity: 1,
          sellingPriceMyr: 59.9,
        },
      ],
      promotions: [],
    });

    assert.deepEqual(result, [
      {
        productVariantId: "sku-a",
        unitPrice: 59.9,
        totalPrice: 59.9,
        promotionId: null,
      },
    ]);
  });

  it("automatically applies an active mix-and-match bundle price", () => {
    const result = calculatePromoterSaleLinePrices({
      items: [
        {
          productVariantId: "sku-a",
          productId: "parent-a",
          quantity: 1,
          sellingPriceMyr: 59.9,
        },
        {
          productVariantId: "sku-b",
          productId: "parent-b",
          quantity: 1,
          sellingPriceMyr: 69.9,
        },
      ],
      promotions: [
        {
          id: "promo-1",
          ruleMode: "MIX_AND_MATCH",
          bundleQuantity: 2,
          bundlePrice: 100,
          productIds: ["parent-a", "parent-b"],
          productVariantIds: [],
        },
      ],
    });

    assert.deepEqual(result, [
      {
        productVariantId: "sku-a",
        unitPrice: 50,
        totalPrice: 50,
        promotionId: "promo-1",
      },
      {
        productVariantId: "sku-b",
        unitPrice: 50,
        totalPrice: 50,
        promotionId: "promo-1",
      },
    ]);
  });
});
