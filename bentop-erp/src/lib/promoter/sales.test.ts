import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildPromoterStockDeductionPlan } from "./sales";

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
