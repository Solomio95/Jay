import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { summarizePurchaseOrderReceiptState } from "./receiving";

describe("summarizePurchaseOrderReceiptState", () => {
  it("marks an ordered purchase as partially received until every item is fully received", () => {
    const status = summarizePurchaseOrderReceiptState([
      { quantityOrdered: 10, quantityReceived: 10 },
      { quantityOrdered: 8, quantityReceived: 3 },
    ]);

    assert.equal(status, "PARTIAL_RECEIVED");
  });

  it("marks a purchase as received when every ordered unit has been received", () => {
    const status = summarizePurchaseOrderReceiptState([
      { quantityOrdered: 10, quantityReceived: 10 },
      { quantityOrdered: 8, quantityReceived: 8 },
    ]);

    assert.equal(status, "RECEIVED");
  });

  it("keeps a purchase ordered when nothing has been received", () => {
    const status = summarizePurchaseOrderReceiptState([
      { quantityOrdered: 10, quantityReceived: 0 },
      { quantityOrdered: 8, quantityReceived: 0 },
    ]);

    assert.equal(status, "ORDERED");
  });
});
