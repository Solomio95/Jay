import type { CsvRow } from "@/lib/csv/csv";

type InventoryReportData = {
  rows: Array<{
    productName: string;
    parentSku: string;
    sku: string;
    categoryName: string;
    size: string | null;
    color: string | null;
    locationName: string;
    locationType: string;
    onHand: number;
    reserved: number;
    available: number;
    unitCost: number;
    totalValue: number;
  } & Record<string, unknown>>;
} & Record<string, unknown>;

type SalesReportData = {
  summary: {
    totalRevenueMyr: number;
    totalReturnsMyr: number;
    totalDiscountMyr: number;
    netRevenueMyr: number;
    totalOrders: number;
    totalUnits: number;
    avgOrderValue: number;
    totalCostMyr: number;
    grossProfit: number;
    grossMarginPct: number;
  };
  byLocation: Array<{
    name: string;
    revenue: number;
    returns: number;
    net: number;
    orders: number;
    units: number;
  } & Record<string, unknown>>;
} & Record<string, unknown>;

type ConsignmentReportData = {
  byPartner: Array<{
    partnerName: string;
    locationName: string;
    shipments: number;
    unitsShipped: number;
    unitsSold: number;
    unitsReturned: number;
    revenueGross: number;
    commissionTotal: number;
    netRevenue: number;
    outstandingAmount: number;
    costTotal: number;
    sellThrough: number;
    grossProfit: number;
  } & Record<string, unknown>>;
} & Record<string, unknown>;

type PromoterReportData = {
  rows: Array<{
    rank: number;
    promoterName: string;
    locationName: string;
    grossSales: number;
    returnAmount: number;
    netSales: number;
    grossQuantity: number;
    returnQuantity: number;
    netQuantity: number;
    orderCount: number;
  } & Record<string, unknown>>;
} & Record<string, unknown>;

export function toInventoryReportCsvRows(data: InventoryReportData): CsvRow[] {
  return data.rows.map((row) => ({
    locationName: row.locationName,
    locationType: row.locationType,
    productName: row.productName,
    parentSku: row.parentSku,
    sku: row.sku,
    categoryName: row.categoryName,
    size: row.size,
    color: row.color,
    onHand: row.onHand,
    reserved: row.reserved,
    available: row.available,
    unitCost: row.unitCost,
    totalValue: row.totalValue,
  }));
}

export function toSalesReportCsvRows(data: SalesReportData): CsvRow[] {
  if (data.byLocation.length === 0) {
    return [salesSummaryCsvRow(data.summary, "All locations")];
  }

  return data.byLocation.map((row) => ({
    locationName: row.name,
    grossRevenueMyr: row.revenue,
    returnsMyr: row.returns,
    discountMyr: data.summary.totalDiscountMyr,
    netRevenueMyr: row.net,
    orders: row.orders,
    units: row.units,
    avgOrderValueMyr: row.orders > 0 ? row.net / row.orders : 0,
  }));
}

export function toConsignmentReportCsvRows(data: ConsignmentReportData): CsvRow[] {
  return data.byPartner.map((row) => ({
    partnerName: row.partnerName,
    locationName: row.locationName,
    shipments: row.shipments,
    shippedUnits: row.unitsShipped,
    soldUnits: row.unitsSold,
    returnedUnits: row.unitsReturned,
    sellThroughPct: row.sellThrough,
    grossSalesMyr: row.revenueGross,
    commissionMyr: row.commissionTotal,
    netPayableMyr: row.netRevenue,
    outstandingMyr: row.outstandingAmount,
    costMyr: row.costTotal,
    grossProfitMyr: row.grossProfit,
  }));
}

export function toPromoterReportCsvRows(data: PromoterReportData): CsvRow[] {
  return data.rows.map((row) => ({
    rank: row.rank,
    promoterName: row.promoterName,
    locationName: row.locationName,
    grossSalesMyr: row.grossSales,
    returnAmountMyr: row.returnAmount,
    netSalesMyr: row.netSales,
    grossQuantity: row.grossQuantity,
    returnQuantity: row.returnQuantity,
    netQuantity: row.netQuantity,
    orderCount: row.orderCount,
  }));
}

function salesSummaryCsvRow(summary: SalesReportData["summary"], locationName: string): CsvRow {
  return {
    locationName,
    grossRevenueMyr: summary.totalRevenueMyr,
    returnsMyr: summary.totalReturnsMyr,
    discountMyr: summary.totalDiscountMyr,
    netRevenueMyr: summary.netRevenueMyr,
    orders: summary.totalOrders,
    units: summary.totalUnits,
    avgOrderValueMyr: summary.avgOrderValue,
  };
}
