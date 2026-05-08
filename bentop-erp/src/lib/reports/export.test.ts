import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  toConsignmentReportCsvRows,
  toInventoryReportCsvRows,
  toPromoterReportCsvRows,
  toSalesReportCsvRows,
} from "./export";

describe("report CSV row builders", () => {
  it("keeps inventory parent SKU and sub SKU visible", () => {
    const rows = toInventoryReportCsvRows({
      summary: { totalUnits: 1, totalReserved: 0, totalAvailable: 1, totalValue: 10, lowStockCount: 0 },
      byCategory: [],
      byLocation: [],
      lowStock: [],
      rows: [
        {
          variantId: "var-1",
          productId: "prod-1",
          sku: "BT-A-BLK",
          parentSku: "BT-A",
          productName: "Bentop Bag",
          size: "M",
          color: "Black",
          categoryName: "Bags",
          locationId: "loc-1",
          locationName: "Billion A",
          locationType: "CONSIGNMENT",
          onHand: 1,
          reserved: 0,
          available: 1,
          unitCost: 10,
          totalValue: 10,
        },
      ],
    });

    assert.deepEqual(rows[0], {
      locationName: "Billion A",
      locationType: "CONSIGNMENT",
      productName: "Bentop Bag",
      parentSku: "BT-A",
      sku: "BT-A-BLK",
      categoryName: "Bags",
      size: "M",
      color: "Black",
      onHand: 1,
      reserved: 0,
      available: 1,
      unitCost: 10,
      totalValue: 10,
    });
  });

  it("exports sales gross, returns, discount, and net fields", () => {
    const rows = toSalesReportCsvRows({
      period: { days: 30, since: "2026-05-01", until: "2026-05-31" },
      summary: {
        totalRevenueMyr: 100,
        totalReturnsMyr: 20,
        totalDiscountMyr: 5,
        netRevenueMyr: 80,
        totalOrders: 2,
        totalUnits: 3,
        avgOrderValue: 40,
        totalCostMyr: 30,
        grossProfit: 50,
        grossMarginPct: 62.5,
      },
      byDay: [],
      byChannel: [],
      byLocation: [
        { id: "loc-1", name: "Billion A", revenue: 100, returns: 20, net: 80, orders: 2, units: 3 },
      ],
      byProduct: [],
      byCustomerType: [],
      topCustomers: [],
    });

    assert.equal(rows[0].grossRevenueMyr, 100);
    assert.equal(rows[0].returnsMyr, 20);
    assert.equal(rows[0].discountMyr, 5);
    assert.equal(rows[0].netRevenueMyr, 80);
  });

  it("exports consignment partner payable and outstanding amounts", () => {
    const rows = toConsignmentReportCsvRows({
      period: { days: 90, since: "2026-05-01" },
      summary: {
        totalShipments: 1,
        totalShipped: 5,
        totalSold: 2,
        totalReturned: 1,
        sellThroughRate: 40,
        totalRevenueGross: 100,
        totalCommission: 25,
        netRevenue: 75,
        outstandingAmount: 45,
        totalCost: 40,
        grossProfit: 35,
      },
      statusBreakdown: [],
      byPartner: [
        {
          partnerName: "Billion",
          locationName: "Billion A",
          shipments: 1,
          unitsShipped: 5,
          unitsSold: 2,
          unitsReturned: 1,
          revenueGross: 100,
          commissionTotal: 25,
          netRevenue: 75,
          outstandingAmount: 45,
          costTotal: 40,
          sellThrough: 40,
          grossProfit: 35,
        },
      ],
      byProduct: [],
    });

    assert.equal(rows[0].netPayableMyr, 75);
    assert.equal(rows[0].outstandingMyr, 45);
  });

  it("exports promoter monthly ranking rows", () => {
    const rows = toPromoterReportCsvRows({
      period: { month: "2026-05" },
      summary: {
        grossSales: 100,
        returnAmount: 20,
        netSales: 80,
        grossQuantity: 2,
        returnQuantity: 1,
        netQuantity: 1,
        promoterCount: 1,
      },
      rows: [
        {
          promoterId: "promoter-1",
          promoterName: "Aida",
          locationId: "loc-1",
          locationName: "Billion A",
          grossSales: 100,
          returnAmount: 20,
          netSales: 80,
          grossQuantity: 2,
          returnQuantity: 1,
          netQuantity: 1,
          orderCount: 2,
          rank: 1,
        },
      ],
    });

    assert.equal(rows[0].rank, 1);
    assert.equal(rows[0].netSalesMyr, 80);
  });
});
