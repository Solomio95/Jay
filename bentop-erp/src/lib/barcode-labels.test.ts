import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PDFDocument } from "pdf-lib";
import {
  BARCODE_LABEL_HEIGHT_PT,
  BARCODE_LABEL_WIDTH_PT,
  assertLabelsHaveBarcodes,
  buildBarcodeLabelPdf,
} from "@/lib/barcode-labels";

describe("barcode label PDF generation", () => {
  it("creates 35mm by 25mm pages for every requested label copy", async () => {
    const pdfBytes = await buildBarcodeLabelPdf([
      {
        articleNo: "BT-CP-001-BLK-M",
        size: "M",
        colour: "Black",
        barcode: "9551234567890",
        copies: 2,
      },
    ]);

    const pdf = await PDFDocument.load(pdfBytes);
    assert.equal(pdf.getPageCount(), 2);

    const firstPage = pdf.getPage(0);
    assert.ok(Math.abs(firstPage.getWidth() - BARCODE_LABEL_WIDTH_PT) < 0.01);
    assert.ok(Math.abs(firstPage.getHeight() - BARCODE_LABEL_HEIGHT_PT) < 0.01);
  });

  it("reports article numbers with missing barcodes before generating labels", () => {
    assert.deepEqual(
      assertLabelsHaveBarcodes([
        {
          articleNo: "BT-MISSING",
          size: "L",
          colour: "Navy",
          barcode: "",
          copies: 1,
        },
      ]),
      ["BT-MISSING"]
    );
  });
});
