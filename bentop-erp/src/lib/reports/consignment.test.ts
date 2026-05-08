import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildConsignmentReportData } from "./consignment";

describe("buildConsignmentReportData", () => {
  it("tracks shipped, sold, returned, net payable, and outstanding invoice amount", () => {
    const data = buildConsignmentReportData({
      days: 90,
      since: new Date("2026-05-01T00:00:00.000Z"),
      shipments: [
        {
          status: "SHIPPED",
          partnerId: "partner-1",
          partnerName: "Billion",
          toLocationId: "loc-1",
          toLocation: { id: "loc-1", name: "Billion A" },
          commissionRate: 25,
          invoices: [
            {
              grossAmount: 100,
              commissionAmount: 25,
              netAmount: 75,
              payments: [{ amount: 30 }],
            },
          ],
          items: [
            {
              quantityShipped: 5,
              quantitySold: 2,
              quantityReturned: 1,
              unitPrice: 50,
              costAtShipment: 20,
              productVariant: {
                id: "var-1",
                sku: "BT-A-BLK",
                product: { id: "prod-1", name: "Bentop Bag" },
              },
            },
          ],
        },
      ],
    });

    assert.equal(data.summary.totalShipped, 5);
    assert.equal(data.summary.totalSold, 2);
    assert.equal(data.summary.totalReturned, 1);
    assert.equal(data.summary.netRevenue, 75);
    assert.equal(data.summary.outstandingAmount, 45);
    assert.equal(data.byProduct[0].sold, 2);
  });
});
