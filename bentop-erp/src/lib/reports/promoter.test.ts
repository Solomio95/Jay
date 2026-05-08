import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildPromoterReportData } from "./promoter";

describe("buildPromoterReportData", () => {
  it("ranks promoters by monthly net sales after returns", () => {
    const data = buildPromoterReportData({
      month: "2026-05",
      promoters: [
        {
          id: "promoter-a",
          name: "Aida",
          defaultLocationId: "loc-1",
          defaultLocation: { id: "loc-1", name: "Billion A" },
        },
        {
          id: "promoter-b",
          name: "Ben",
          defaultLocationId: "loc-2",
          defaultLocation: { id: "loc-2", name: "Billion B" },
        },
      ],
      orders: [
        { createdById: "promoter-a", locationId: "loc-1", totalAmount: 100, items: [{ quantity: 2 }] },
        { createdById: "promoter-b", locationId: "loc-2", totalAmount: 80, items: [{ quantity: 1 }] },
      ],
      returns: [
        { promoterId: "promoter-a", locationId: "loc-1", amount: 60, quantity: 1 },
      ],
    });

    assert.equal(data.summary.grossSales, 180);
    assert.equal(data.summary.returnAmount, 60);
    assert.equal(data.summary.netSales, 120);
    assert.equal(data.rows[0].promoterId, "promoter-b");
    assert.equal(data.rows[0].rank, 1);
    assert.equal(data.rows[1].netQuantity, 1);
  });
});
