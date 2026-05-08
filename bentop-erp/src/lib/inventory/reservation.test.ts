import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertEnoughAvailableStock,
  calculateAvailableStock,
  mergeRequestedQuantities,
} from "./reservation";

describe("calculateAvailableStock", () => {
  it("subtracts reserved quantity from on-hand stock", () => {
    assert.equal(calculateAvailableStock(10, 4), 6);
  });

  it("never returns a negative available quantity", () => {
    assert.equal(calculateAvailableStock(3, 8), 0);
  });
});

describe("assertEnoughAvailableStock", () => {
  it("throws a stock error when requested quantity exceeds available stock", () => {
    assert.throws(
      () =>
        assertEnoughAvailableStock({
          available: 2,
          requested: 3,
          itemLabel: "BT-RED-S",
        }),
      /INSUFFICIENT_STOCK:Only 2 available for BT-RED-S, requested 3/,
    );
  });
});

describe("mergeRequestedQuantities", () => {
  it("combines duplicate variant lines before stock validation", () => {
    const quantities = mergeRequestedQuantities([
      { productVariantId: "variant-1", quantity: 2 },
      { productVariantId: "variant-2", quantity: 1 },
      { productVariantId: "variant-1", quantity: 3 },
    ]);

    assert.deepEqual(Array.from(quantities.entries()), [
      ["variant-1", 5],
      ["variant-2", 1],
    ]);
  });
});
