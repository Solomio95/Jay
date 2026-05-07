import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findScannedVariant } from "./barcode";

const variants = [
  { sku: "BT-TEE-RED-M", barcode: "9550000000012", name: "Red Tee" },
  { sku: "BT-TEE-BLK-L", barcode: null, name: "Black Tee" },
];

describe("findScannedVariant", () => {
  it("matches exact barcode before SKU text", () => {
    assert.equal(findScannedVariant(variants, "9550000000012")?.name, "Red Tee");
  });

  it("matches exact SKU case-insensitively", () => {
    assert.equal(findScannedVariant(variants, "bt-tee-blk-l")?.name, "Black Tee");
  });

  it("does not treat partial SKU text as a scan match", () => {
    assert.equal(findScannedVariant(variants, "TEE"), null);
  });
});
