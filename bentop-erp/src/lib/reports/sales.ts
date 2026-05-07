import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export type SalesReportFilters = {
  days?: number;
  from?: string | null;
  to?: string | null;
  locationId?: string | null;
  productId?: string | null;
  productVariantId?: string | null;
  search?: string | null;
};

type SalesReportOrder = {
  id: string;
  createdAt: Date;
  totalAmount: unknown;
  discountAmount: unknown;
  currency: string;
  exchangeRateToMyr: unknown;
  location?: { id: string; name: string } | null;
  customer?: { id: string; name: string; customerType: string } | null;
  salesChannel?: { id: string; name: string; type: string } | null;
  promoterReturns?: Array<{ amount: unknown }>;
  items: Array<{
    quantity: number;
    totalPrice: unknown;
    discountAmount: unknown;
    costAtTimeOfSale: unknown;
    productVariant: {
      id: string;
      sku: string;
      size: string | null;
      color: string | null;
      product: { id: string; name: string; categoryId: string };
    };
  }>;
};

export async function getSalesReport(filters: SalesReportFilters = {}, now = new Date()) {
  const period = resolveSalesReportPeriod(filters, now);
  const where = buildSalesOrderWhere(filters, period.since, period.until);

  const orders = await prisma.order.findMany({
    where,
    include: {
      location: { select: { id: true, name: true } },
      customer: { select: { id: true, name: true, customerType: true } },
      salesChannel: { select: { id: true, name: true, type: true } },
      promoterReturns: { select: { amount: true } },
      items: {
        include: {
          productVariant: {
            select: {
              id: true,
              sku: true,
              size: true,
              color: true,
              product: { select: { id: true, name: true, categoryId: true } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return buildSalesReportData({ orders: orders as unknown as SalesReportOrder[], period });
}

export function resolveSalesReportPeriod(filters: SalesReportFilters, now = new Date()) {
  const days = Number.isFinite(filters.days) && filters.days ? Math.max(1, filters.days) : 30;
  const since = filters.from ? new Date(filters.from) : new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const until = filters.to ? new Date(filters.to) : now;

  return { days, since, until };
}

export function buildSalesOrderWhere(filters: SalesReportFilters, since: Date, until: Date) {
  const itemFilters: Prisma.OrderItemWhereInput[] = [];
  if (filters.productVariantId) itemFilters.push({ productVariantId: filters.productVariantId });
  if (filters.productId) itemFilters.push({ productVariant: { productId: filters.productId } });
  if (filters.search) {
    itemFilters.push({
      productVariant: {
        OR: [
          { sku: { contains: filters.search, mode: "insensitive" } },
          { product: { name: { contains: filters.search, mode: "insensitive" } } },
          { product: { skuPrefix: { contains: filters.search, mode: "insensitive" } } },
        ],
      },
    });
  }

  return {
    createdAt: { gte: since, lte: until },
    status: { not: "CANCELLED" },
    ...(filters.locationId ? { locationId: filters.locationId } : {}),
    ...(itemFilters.length > 0 ? { items: { some: { AND: itemFilters } } } : {}),
  } satisfies Prisma.OrderWhereInput;
}

export function buildSalesReportData({
  orders,
  period,
}: {
  orders: SalesReportOrder[];
  period: { days: number; since: Date; until: Date };
}) {
  const totalRevenueMyr = orders.reduce((sum, order) => sum + toMyr(order), 0);
  const totalReturnsMyr = orders.reduce((sum, order) => sum + returnedAmountMyr(order), 0);
  const totalDiscountMyr = orders.reduce((sum, order) => sum + Number(order.discountAmount), 0);
  const netRevenueMyr = totalRevenueMyr - totalReturnsMyr;
  const totalOrders = orders.length;
  const totalUnits = orders.reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0);
  const avgOrderValue = totalOrders > 0 ? netRevenueMyr / totalOrders : 0;
  const totalCostMyr = orders.reduce(
    (sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + Number(item.costAtTimeOfSale) * item.quantity, 0),
    0,
  );
  const grossProfit = netRevenueMyr - totalCostMyr;
  const grossMarginPct = netRevenueMyr > 0 ? (grossProfit / netRevenueMyr) * 100 : 0;

  const byDay: Record<string, { revenue: number; returns: number; net: number; orders: number; units: number }> = {};
  const byChannel: Record<string, { name: string; type: string; revenue: number; returns: number; net: number; orders: number; units: number }> = {};
  const byLocation: Record<string, { name: string; revenue: number; returns: number; net: number; orders: number; units: number }> = {};
  const byProduct: Record<string, { name: string; revenue: number; discount: number; cost: number; units: number }> = {};
  const byCustomerType: Record<string, { revenue: number; orders: number }> = {};
  const byCustomer: Record<string, { name: string; revenue: number; orders: number }> = {};

  for (const order of orders) {
    const revenue = toMyr(order);
    const returns = returnedAmountMyr(order);
    const net = revenue - returns;
    const units = order.items.reduce((sum, item) => sum + item.quantity, 0);
    const day = order.createdAt.toISOString().slice(0, 10);
    const dayEntry = byDay[day] ?? { revenue: 0, returns: 0, net: 0, orders: 0, units: 0 };
    dayEntry.revenue += revenue;
    dayEntry.returns += returns;
    dayEntry.net += net;
    dayEntry.orders += 1;
    dayEntry.units += units;
    byDay[day] = dayEntry;

    const channelKey = order.salesChannel?.id ?? "_direct";
    const channelEntry = byChannel[channelKey] ?? {
      name: order.salesChannel?.name ?? "Direct",
      type: order.salesChannel?.type ?? "-",
      revenue: 0,
      returns: 0,
      net: 0,
      orders: 0,
      units: 0,
    };
    channelEntry.revenue += revenue;
    channelEntry.returns += returns;
    channelEntry.net += net;
    channelEntry.orders += 1;
    channelEntry.units += units;
    byChannel[channelKey] = channelEntry;

    const locationKey = order.location?.id ?? "_none";
    const locationEntry = byLocation[locationKey] ?? {
      name: order.location?.name ?? "No location",
      revenue: 0,
      returns: 0,
      net: 0,
      orders: 0,
      units: 0,
    };
    locationEntry.revenue += revenue;
    locationEntry.returns += returns;
    locationEntry.net += net;
    locationEntry.orders += 1;
    locationEntry.units += units;
    byLocation[locationKey] = locationEntry;

    const customerType = order.customer?.customerType ?? "WALK_IN";
    const customerTypeEntry = byCustomerType[customerType] ?? { revenue: 0, orders: 0 };
    customerTypeEntry.revenue += net;
    customerTypeEntry.orders += 1;
    byCustomerType[customerType] = customerTypeEntry;

    const customerKey = order.customer?.id ?? "_walkin";
    const customerEntry = byCustomer[customerKey] ?? {
      name: order.customer?.name ?? "Walk-in",
      revenue: 0,
      orders: 0,
    };
    customerEntry.revenue += net;
    customerEntry.orders += 1;
    byCustomer[customerKey] = customerEntry;

    const rate = order.currency === "MYR" ? 1 : Number(order.exchangeRateToMyr);
    for (const item of order.items) {
      const productKey = item.productVariant.product.id;
      const productEntry = byProduct[productKey] ?? {
        name: item.productVariant.product.name,
        revenue: 0,
        discount: 0,
        cost: 0,
        units: 0,
      };
      productEntry.revenue += Number(item.totalPrice) * rate;
      productEntry.discount += Number(item.discountAmount) * rate;
      productEntry.cost += Number(item.costAtTimeOfSale) * item.quantity;
      productEntry.units += item.quantity;
      byProduct[productKey] = productEntry;
    }
  }

  return {
    period: { days: period.days, since: period.since.toISOString(), until: period.until.toISOString() },
    summary: {
      totalRevenueMyr,
      totalReturnsMyr,
      totalDiscountMyr,
      netRevenueMyr,
      totalOrders,
      totalUnits,
      avgOrderValue,
      totalCostMyr,
      grossProfit,
      grossMarginPct,
    },
    byDay: sortedEntries(byDay, "date", (a, b) => a.date.localeCompare(b.date)),
    byChannel: sortedEntries(byChannel, "id", (a, b) => b.net - a.net),
    byLocation: sortedEntries(byLocation, "id", (a, b) => b.net - a.net),
    byProduct: sortedEntries(byProduct, "id", (a, b) => b.revenue - a.revenue)
      .map((item) => ({ ...item, margin: item.revenue > 0 ? ((item.revenue - item.cost) / item.revenue) * 100 : 0 }))
      .slice(0, 20),
    byCustomerType: sortedEntries(byCustomerType, "type", (a, b) => b.revenue - a.revenue),
    topCustomers: sortedEntries(byCustomer, "id", (a, b) => b.revenue - a.revenue).slice(0, 10),
  };
}

function toMyr(order: SalesReportOrder) {
  return Number(order.totalAmount) * (order.currency === "MYR" ? 1 : Number(order.exchangeRateToMyr));
}

function returnedAmountMyr(order: SalesReportOrder) {
  const returned = (order.promoterReturns ?? []).reduce((sum, item) => sum + Number(item.amount), 0);
  return returned * (order.currency === "MYR" ? 1 : Number(order.exchangeRateToMyr));
}

function sortedEntries<T extends Record<string, number | string>>(
  values: Record<string, T>,
  idKey: string,
  sortFn: (a: T & Record<string, string>, b: T & Record<string, string>) => number,
) {
  return Object.entries(values)
    .map(([id, value]) => ({ [idKey]: id, ...value }) as T & Record<string, string>)
    .sort(sortFn);
}
