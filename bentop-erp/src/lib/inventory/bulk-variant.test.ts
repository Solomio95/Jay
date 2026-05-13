import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseBulkVariantTokens, pickBulkVariantMatch, type BulkVariantCandidate } from "./bulk-variant";

describe("parseBulkVariantTokens", () => {
  it("splits pasted SKU and barcode text by line, comma, tab, and spaces", () => {
    assert.deepEqual(parseBulkVariantTokens("SKU-A, SKU-B\nSKU-C\tSKU-D  SKU-A"), [
      "SKU-A",
      "SKU-B",
      "SKU-C",
      "SKU-D",
    ]);
  });
});

describe("pickBulkVariantMatch", () => {
  const candidates: BulkVariantCandidate[] = [
    { id: "1", sku: "BT-TEE-BLK-M", barcode: "9550001" },
    { id: "2", sku: "BT-TEE-BLK-L", barcode: null },
  ];

  it("prefers an exact SKU match case-insensitively", () => {
    assert.equal(pickBulkVariantMatch("bt-tee-blk-m", candidates)?.id, "1");
  });

  it("matches exact barcode before falling back to a single search result", () => {
    assert.equal(pickBulkVariantMatch("9550001", candidates)?.id, "1");
  });

  it("uses the only candidate when the search result is unique", () => {
    assert.equal(pickBulkVariantMatch("partial", [candidates[1]])?.id, "2");
  });

  it("returns null when multiple candidates are possible and none is exact", () => {
    assert.equal(pickBulkVariantMatch("BT-TEE", candidates), null);
  });
});
