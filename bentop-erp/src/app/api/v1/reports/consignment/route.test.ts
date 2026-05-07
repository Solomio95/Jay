import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildConsignmentReportData } from "./route";

describe("buildConsignmentReportData", () => {
  it("uses finalized invoice money snapshots instead of shipment default commission", () => {
    const data = buildConsignmentReportData({
      days: 90,
      since: new Date("2026-05-01T00:00:00.000Z"),
      shipments: [
        {
          status: "PARTIAL_SETTLED",
          partnerName: "Billion Group",
          toLocationId: "location-1",
          toLocation: { id: "location-1", name: "Billion SBB" },
          commissionRate: "0",
          invoices: [
            {
              grossAmount: "100",
              commissionAmount: "23",
              netAmount: "77",
            },
          ],
          items: [
            {
              quantityShipped: 10,
              quantitySold: 2,
              quantityReturned: 1,
              unitPrice: "49.9",
              costAtShipment: "20",
            },
          ],
        },
      ],
    });

    assert.equal(data.summary.totalRevenueGross, 100);
    assert.equal(data.summary.totalCommission, 23);
    assert.equal(data.summary.netRevenue, 77);
    assert.equal(data.byPartner[0].revenueGross, 100);
    assert.equal(data.byPartner[0].commissionTotal, 23);
    assert.equal(data.byPartner[0].netRevenue, 77);
  });
});
