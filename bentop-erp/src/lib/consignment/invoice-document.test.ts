import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildConsignmentInvoiceDocument } from "./invoice-document";

describe("buildConsignmentInvoiceDocument", () => {
  it("summarizes invoice lines, paid amount, outstanding amount, and report period", () => {
    const document = buildConsignmentInvoiceDocument({
      invoiceNumber: "INV-2026-001",
      invoiceDate: new Date("2026-05-08T00:00:00.000Z"),
      dueDate: new Date("2026-05-15T00:00:00.000Z"),
      billToName: "Billion Group",
      billToContact: "Accounts",
      billToEmail: "ap@example.com",
      billToPhone: "0123456789",
      billToAddress: { street: "1 Main Road", city: "Kuching", state: "Sarawak", country: "Malaysia" },
      grossAmount: "150.00",
      commissionAmount: "37.50",
      netAmount: "112.50",
      status: "ISSUED",
      report: {
        reportNumber: "RPT-001",
        periodStart: new Date("2026-05-01T00:00:00.000Z"),
        periodEnd: new Date("2026-05-07T00:00:00.000Z"),
      },
      shipment: { shipmentNumber: "CS-001" },
      lines: [
        {
          id: "line-1",
          sku: "BT-A-BLK",
          productName: "Bentop Bag",
          color: "Black",
          size: "M",
          quantitySold: 2,
          actualUnitPrice: "50.00",
          grossAmount: "100.00",
          commissionTierName: "Best Buy",
          commissionRate: "25.00",
          commissionAmount: "25.00",
          netAmount: "75.00",
        },
        {
          id: "line-2",
          sku: "BT-B-RED",
          productName: "Bentop Pouch",
          color: "Red",
          size: "S",
          quantitySold: 1,
          actualUnitPrice: "50.00",
          grossAmount: "50.00",
          commissionTierName: "Best Buy",
          commissionRate: "25.00",
          commissionAmount: "12.50",
          netAmount: "37.50",
        },
      ],
      payments: [{ amount: "30.00" }, { amount: "12.50" }],
    });

    assert.equal(document.invoiceNumber, "INV-2026-001");
    assert.equal(document.reportPeriodLabel, "May 1, 2026 to May 7, 2026");
    assert.equal(document.totalUnits, 3);
    assert.equal(document.paidAmount, 42.5);
    assert.equal(document.outstandingAmount, 70);
    assert.deepEqual(document.billToLines, [
      "Billion Group",
      "Accounts",
      "ap@example.com",
      "0123456789",
      "1 Main Road, Kuching, Sarawak, Malaysia",
    ]);
    assert.deepEqual(
      document.lines.map((line) => ({
        sku: line.sku,
        quantitySold: line.quantitySold,
        netAmount: line.netAmount,
      })),
      [
        { sku: "BT-A-BLK", quantitySold: 2, netAmount: 75 },
        { sku: "BT-B-RED", quantitySold: 1, netAmount: 37.5 },
      ],
    );
  });
});
