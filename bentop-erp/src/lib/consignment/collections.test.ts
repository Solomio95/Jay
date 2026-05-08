import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getCollectionAgingBucket,
  summarizeCollectionInvoice,
} from "./collections";

describe("consignment collections", () => {
  it("assigns invoice aging buckets from due date and outstanding amount", () => {
    const now = new Date("2026-05-20T12:00:00.000Z");

    assert.equal(getCollectionAgingBucket(null, 50, now), "NOT_DUE");
    assert.equal(getCollectionAgingBucket(new Date("2026-05-22T00:00:00.000Z"), 50, now), "NOT_DUE");
    assert.equal(getCollectionAgingBucket(new Date("2026-05-20T00:00:00.000Z"), 50, now), "NOT_DUE");
    assert.equal(getCollectionAgingBucket(new Date("2026-05-19T00:00:00.000Z"), 50, now), "OVERDUE_1_7");
    assert.equal(getCollectionAgingBucket(new Date("2026-05-10T00:00:00.000Z"), 50, now), "OVERDUE_8_30");
    assert.equal(getCollectionAgingBucket(new Date("2026-04-10T00:00:00.000Z"), 50, now), "OVERDUE_31_60");
    assert.equal(getCollectionAgingBucket(new Date("2026-03-01T00:00:00.000Z"), 50, now), "OVERDUE_60_PLUS");
    assert.equal(getCollectionAgingBucket(new Date("2026-03-01T00:00:00.000Z"), 0, now), "PAID");
  });

  it("summarizes collection invoice balance, aging, and last follow-up", () => {
    const summary = summarizeCollectionInvoice(
      {
        id: "invoice-1",
        invoiceNumber: "INV-001",
        dueDate: new Date("2026-05-10T00:00:00.000Z"),
        netAmount: "100.00",
        payments: [{ amount: "25.00" }],
        collectionStatus: "CONTACTED",
        followUps: [
          {
            note: "Called account team",
            nextFollowUpDate: new Date("2026-05-21T00:00:00.000Z"),
            createdAt: new Date("2026-05-19T08:00:00.000Z"),
          },
        ],
      },
      new Date("2026-05-20T12:00:00.000Z"),
    );

    assert.deepEqual(summary, {
      invoiceId: "invoice-1",
      invoiceNumber: "INV-001",
      netAmount: 100,
      paidAmount: 25,
      outstandingAmount: 75,
      agingBucket: "OVERDUE_8_30",
      collectionStatus: "CONTACTED",
      lastFollowUpNote: "Called account team",
      nextFollowUpDate: new Date("2026-05-21T00:00:00.000Z"),
    });
  });
});
