import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildSalesReportData } from "./sales";

describe("buildSalesReportData", () => {
  it("subtracts returns from gross sales and keeps discount totals visible", () => {
    const data = buildSalesReportData({
      period: {
        days: 30,
        since: new Date("2026-05-01T00:00:00.000Z"),
        until: new Date("2026-05-31T23:59:59.000Z"),
      },
      orders: [
        {
          id: "order-1",
          createdAt: new Date("2026-05-02T10:00:00.000Z"),
          totalAmount: 100,
          discountAmount: 10,
          currency: "MYR",
          exchangeRateToMyr: 1,
          location: { id: "loc-1", name: "Billion A" },
          customer: { id: "cust-1", name: "Jane", customerType: "RETAIL" },
          salesChannel: { id: "channel-1", name: "Consignment", type: "CONSIGNMENT" },
          promoterReturns: [{ amount: 40 }],
          items: [
            {
              quantity: 2,
              totalPrice: 100,
              discountAmount: 10,
              costAtTimeOfSale: 20,
              productVariant: {
                id: "var-1",
                sku: "BT-A-BLK",
                size: "M",
                color: "Black",
                product: { id: "prod-1", name: "Bentop Bag", categoryId: "cat-1" },
              },
            },
          ],
        },
      ],
    });

    assert.equal(data.summary.totalRevenueMyr, 100);
    assert.equal(data.summary.totalReturnsMyr, 40);
    assert.equal(data.summary.netRevenueMyr, 60);
    assert.equal(data.summary.totalDiscountMyr, 10);
    assert.equal(data.summary.grossProfit, 20);
    assert.equal(data.byLocation[0].net, 60);
  });
});
