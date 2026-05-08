import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateImportRows } from "./validation";

describe("validateImportRows", () => {
  it("validates product variant import rows and reports row-level errors", () => {
    const result = validateImportRows("product-variants", [
      {
        productName: "Floral Dress",
        skuPrefix: "FD",
        categoryName: "Dress",
        sku: "FD-BLK-S",
        size: "S",
        color: "Black",
        sellingPriceMyr: "59.90",
        baseCostMyr: "20.00",
      },
      {
        productName: "",
        skuPrefix: "BAD",
        categoryName: "Dress",
        sku: "",
        size: "S",
        color: "Black",
        sellingPriceMyr: "-1",
        baseCostMyr: "x",
      },
    ]);

    assert.equal(result.validRows, 1);
    assert.equal(result.invalidRows, 1);
    assert.equal(result.errors[0].rowNumber, 3);
    assert(result.errors[0].messages.some((message) => message.includes("productName")));
    assert(result.errors[0].messages.some((message) => message.includes("sku")));
  });
});
