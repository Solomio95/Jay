import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { requireImportConfirmation, toImportNumber } from "./apply";

describe("import apply helpers", () => {
  it("requires explicit confirmation before mutating data", () => {
    assert.throws(() => requireImportConfirmation(false, undefined), /confirm/);
    assert.doesNotThrow(() => requireImportConfirmation(false, "IMPORT"));
    assert.doesNotThrow(() => requireImportConfirmation(true, undefined));
  });

  it("converts numeric CSV values safely", () => {
    assert.equal(toImportNumber("59.90", "sellingPriceMyr"), 59.9);
    assert.throws(() => toImportNumber("abc", "sellingPriceMyr"), /sellingPriceMyr/);
  });
});
