import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { summarizeConsignmentInvoicePaymentState } from "./invoice-payments";

describe("summarizeConsignmentInvoicePaymentState", () => {
  it("keeps an issued invoice unpaid when no payment has been recorded", () => {
    const summary = summarizeConsignmentInvoicePaymentState({
      netAmount: 1200,
      paidAmount: 0,
      currentStatus: "ISSUED",
    });

    assert.equal(summary.status, "ISSUED");
    assert.equal(summary.balanceAmount, 1200);
    assert.equal(summary.isFullyPaid, false);
  });

  it("marks an invoice partially paid when payment is below the invoice net amount", () => {
    const summary = summarizeConsignmentInvoicePaymentState({
      netAmount: 1200,
      paidAmount: 450,
      currentStatus: "ISSUED",
    });

    assert.equal(summary.status, "PARTIAL_PAID");
    assert.equal(summary.balanceAmount, 750);
    assert.equal(summary.isFullyPaid, false);
  });

  it("marks an invoice paid when payments cover the invoice net amount", () => {
    const summary = summarizeConsignmentInvoicePaymentState({
      netAmount: 1200,
      paidAmount: 1200,
      currentStatus: "PARTIAL_PAID",
    });

    assert.equal(summary.status, "PAID");
    assert.equal(summary.balanceAmount, 0);
    assert.equal(summary.isFullyPaid, true);
  });

  it("does not change a void invoice", () => {
    const summary = summarizeConsignmentInvoicePaymentState({
      netAmount: 1200,
      paidAmount: 1200,
      currentStatus: "VOID",
    });

    assert.equal(summary.status, "VOID");
    assert.equal(summary.balanceAmount, 0);
    assert.equal(summary.isFullyPaid, false);
  });
});
