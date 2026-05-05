import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildPromoterSalesHistoryWhere,
  buildPromoterStockDeductionPlan,
  summarizePromoterSaleHistoryItem,
} from "./sales";

describe("buildPromoterStockDeductionPlan", () => {
  it("uses aggregate stock when no batch stock exists", () => {
    const plan = buildPromoterStockDeductionPlan({
      quantity: 1,
      batchRows: [],
      aggregateRow: { id: "aggregate-1", quantityOnHand: 7 },
    });

    assert.deepEqual(plan, {
      batchDeductions: [],
      aggregateDeduction: { id: "aggregate-1", quantity: 1 },
      movements: [{ batchId: null, quantity: 1 }],
    });
  });

  it("uses batch stock first and aggregate stock for any remaining quantity", () => {
    const plan = buildPromoterStockDeductionPlan({
      quantity: 4,
      batchRows: [{ id: "batch-stock-1", batchId: "batch-1", quantityOnHand: 2 }],
      aggregateRow: { id: "aggregate-1", quantityOnHand: 5 },
    });

    assert.deepEqual(plan, {
      batchDeductions: [{ id: "batch-stock-1", quantity: 2 }],
      aggregateDeduction: { id: "aggregate-1", quantity: 4 },
      movements: [
        { batchId: "batch-1", quantity: 2 },
        { batchId: null, quantity: 2 },
      ],
    });
  });
});

describe("buildPromoterSalesHistoryWhere", () => {
  it("limits sales history to the promoter's own submitted sales", () => {
    assert.deepEqual(buildPromoterSalesHistoryWhere({ userId: "promoter-1" }), {
      createdById: "promoter-1",
      internalNotes: { contains: "Promoter sale finalized at submission" },
    });
  });

  it("can filter the promoter's own sales by search text and date range", () => {
    assert.deepEqual(
      buildPromoterSalesHistoryWhere({
        userId: "promoter-1",
        search: "BT-SO-123",
        dateFrom: "2026-05-01",
        dateTo: "2026-05-05",
      }),
      {
        createdById: "promoter-1",
        internalNotes: { contains: "Promoter sale finalized at submission" },
        createdAt: {
          gte: new Date("2026-05-01T00:00:00.000Z"),
          lte: new Date("2026-05-05T23:59:59.999Z"),
        },
        OR: [
          { orderNumber: { contains: "BT-SO-123", mode: "insensitive" } },
          { customer: { name: { contains: "BT-SO-123", mode: "insensitive" } } },
          { location: { name: { contains: "BT-SO-123", mode: "insensitive" } } },
          {
            items: {
              some: {
                productVariant: {
                  OR: [
                    { sku: { contains: "BT-SO-123", mode: "insensitive" } },
                    {
                      product: {
                        name: { contains: "BT-SO-123", mode: "insensitive" },
                      },
                    },
                  ],
                },
              },
            },
          },
        ],
      },
    );
  });
});

describe("summarizePromoterSaleHistoryItem", () => {
  it("shows returned and remaining quantity for a sale line", () => {
    assert.deepEqual(
      summarizePromoterSaleHistoryItem({
        quantity: 3,
        totalPrice: 150,
        promoterReturns: [
          { quantity: 1, amount: 50 },
          { quantity: 1, amount: 50 },
        ],
      }),
      {
        returnedQuantity: 2,
        returnableQuantity: 1,
        returnedAmount: 100,
        netAmount: 50,
      },
    );
  });

  it("does not show negative remaining quantity when over-returned data exists", () => {
    assert.deepEqual(
      summarizePromoterSaleHistoryItem({
        quantity: 1,
        totalPrice: 50,
        promoterReturns: [{ quantity: 2, amount: 100 }],
      }),
      {
        returnedQuantity: 2,
        returnableQuantity: 0,
        returnedAmount: 100,
        netAmount: 0,
      },
    );
  });
});
