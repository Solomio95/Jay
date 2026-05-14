import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseCsv, toCsv } from "./csv";

describe("csv helpers", () => {
  it("escapes commas, quotes, and new lines when exporting CSV", () => {
    const csv = toCsv([
      {
        sku: "BT-001",
        name: "Dress, Floral",
        notes: "Line 1\nLine \"2\"",
      },
    ]);

    assert.equal(csv, 'sku,name,notes\r\nBT-001,"Dress, Floral","Line 1\nLine ""2"""');
  });

  it("parses quoted CSV fields with commas and escaped quotes", () => {
    const rows = parseCsv('sku,name,notes\r\nBT-001,"Dress, Floral","Line ""2"""');

    assert.deepEqual(rows, [
      {
        sku: "BT-001",
        name: "Dress, Floral",
        notes: 'Line "2"',
      },
    ]);
  });

  it("keeps headers when exporting an empty result set", () => {
    assert.equal(toCsv([], ["sku", "productName", "available"]), "sku,productName,available");
  });
});
