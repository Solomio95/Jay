import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildPartnerStatementSummary } from "./partner-statement";

describe("buildPartnerStatementSummary", () => {
  it("summarizes partner invoice totals, paid amounts, outstanding amounts, and overdue invoices", () => {
    const summary = buildPartnerStatementSummary(
      [
        {
          status: "ISSUED",
          invoiceDate: new Date("2026-05-01T00:00:00.000Z"),
          dueDate: new Date("2026-05-05T00:00:00.000Z"),
          grossAmount: "100.00",
          commissionAmount: "25.00",
          netAmount: "75.00",
          payments: [{ amount: "20.00" }],
        },
        {
          status: "PAID",
          invoiceDate: new Date("2026-05-03T00:00:00.000Z"),
          dueDate: new Date("2026-05-10T00:00:00.000Z"),
          grossAmount: "80.00",
          commissionAmount: "20.00",
          netAmount: "60.00",
          payments: [{ amount: "60.00" }],
        },
        {
          status: "VOID",
          invoiceDate: new Date("2026-05-04T00:00:00.000Z"),
          dueDate: new Date("2026-05-06T00:00:00.000Z"),
          grossAmount: "500.00",
          commissionAmount: "100.00",
          netAmount: "400.00",
          payments: [],
        },
      ],
      new Date("2026-05-08T12:00:00.000Z"),
    );

    assert.deepEqual(summary, {
      invoiceCount: 2,
      overdueCount: 1,
      grossAmount: 180,
      commissionAmount: 45,
      netAmount: 135,
      paidAmount: 80,
      outstandingAmount: 55,
      lastInvoiceDate: new Date("2026-05-03T00:00:00.000Z"),
    });
  });
});
