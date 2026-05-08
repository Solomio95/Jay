import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { summarizePromoterReturnOrderState } from "./returns";

describe("summarizePromoterReturnOrderState", () => {
  it("keeps an order active when only part of the sale is returned", () => {
    assert.deepEqual(
      summarizePromoterReturnOrderState({
        currentStatus: "PROCESSING",
        totalQuantity: 3,
        returnedQuantity: 1,
        totalAmount: 150,
        returnedAmount: 50,
      }),
      {
        status: "PROCESSING",
        paymentStatus: "PARTIAL",
      },
    );
  });

  it("marks an order returned and refunded when every item is returned", () => {
    assert.deepEqual(
      summarizePromoterReturnOrderState({
        currentStatus: "PROCESSING",
        totalQuantity: 2,
        returnedQuantity: 2,
        totalAmount: 100,
        returnedAmount: 100,
      }),
      {
        status: "RETURNED",
        paymentStatus: "REFUNDED",
      },
    );
  });

  it("does not reopen cancelled orders while summarizing returns", () => {
    assert.deepEqual(
      summarizePromoterReturnOrderState({
        currentStatus: "CANCELLED",
        totalQuantity: 2,
        returnedQuantity: 1,
        totalAmount: 100,
        returnedAmount: 50,
      }),
      {
        status: "CANCELLED",
        paymentStatus: "PARTIAL",
      },
    );
  });
});
