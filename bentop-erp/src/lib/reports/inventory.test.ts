import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildInventoryReportData } from "./inventory";

describe("buildInventoryReportData", () => {
  it("summarizes on-hand, reserved, available, value, and low-stock rows", () => {
    const data = buildInventoryReportData({
      categories: [{ id: "cat-1", name: "Ladies Bags" }],
      stockLevels: [
        stockLevel({ sku: "BT-A-BLK", quantityOnHand: 10, quantityReserved: 3, reorderPoint: 8 }),
        stockLevel({ sku: "BT-B-BLK", quantityOnHand: 5, quantityReserved: 1, baseCostMyr: 20 }),
      ],
      lowStockLevels: [
        stockLevel({ sku: "BT-A-BLK", quantityOnHand: 10, quantityReserved: 3, reorderPoint: 8 }),
        stockLevel({ sku: "BT-B-BLK", quantityOnHand: 5, quantityReserved: 1, reorderPoint: 3 }),
      ],
    });

    assert.equal(data.summary.totalUnits, 15);
    assert.equal(data.summary.totalReserved, 4);
    assert.equal(data.summary.totalAvailable, 11);
    assert.equal(data.summary.totalValue, 200);
    assert.equal(data.lowStock.length, 1);
    assert.equal(data.byCategory[0].available, 11);
  });
});

function stockLevel(input: {
  sku: string;
  quantityOnHand: number;
  quantityReserved: number;
  reorderPoint?: number;
  baseCostMyr?: number;
}) {
  return {
    quantityOnHand: input.quantityOnHand,
    quantityReserved: input.quantityReserved,
    reorderPoint: input.reorderPoint ?? 0,
    reorderQuantity: 12,
    productVariant: {
      id: input.sku,
      sku: input.sku,
      size: "M",
      color: "Black",
      additionalCost: 0,
      product: {
        id: "prod-1",
        name: "Bentop Bag",
        skuPrefix: "BT",
        baseCostMyr: input.baseCostMyr ?? 10,
        categoryId: "cat-1",
      },
    },
    location: { id: "loc-1", name: "Billion A", type: "CONSIGNMENT" },
  };
}
