import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export type PromoterReportFilters = {
  month?: string | null;
  locationId?: string | null;
  promoterId?: string | null;
};

type PromoterReportUser = {
  id: string;
  name: string;
  defaultLocationId: string | null;
  defaultLocation?: { id: string; name: string } | null;
};

type PromoterReportOrder = {
  createdById: string;
  locationId: string | null;
  totalAmount: unknown;
  items: Array<{ quantity: number }>;
};

type PromoterReportReturn = {
  promoterId: string;
  locationId: string;
  amount: unknown;
  quantity: number;
};

export async function getPromoterReport(filters: PromoterReportFilters = {}) {
  const period = resolvePromoterReportPeriod(filters.month);
  const promoterWhere: Prisma.UserWhereInput = {
    role: "PROMOTER",
    isActive: true,
    ...(filters.promoterId ? { id: filters.promoterId } : {}),
    ...(filters.locationId ? { defaultLocationId: filters.locationId } : {}),
  };

  const [promoters, orders, returns] = await Promise.all([
    prisma.user.findMany({
      where: promoterWhere,
      select: {
        id: true,
        name: true,
        defaultLocationId: true,
        defaultLocation: { select: { id: true, name: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.order.findMany({
      where: {
        createdAt: { gte: period.start, lt: period.end },
        status: { not: "CANCELLED" },
        ...(filters.locationId ? { locationId: filters.locationId } : {}),
        ...(filters.promoterId ? { createdById: filters.promoterId } : { createdBy: { role: "PROMOTER" } }),
      },
      select: {
        createdById: true,
        locationId: true,
        totalAmount: true,
        items: { select: { quantity: true } },
      },
    }),
    prisma.promoterReturn.findMany({
      where: {
        createdAt: { gte: period.start, lt: period.end },
        ...(filters.locationId ? { locationId: filters.locationId } : {}),
        ...(filters.promoterId ? { promoterId: filters.promoterId } : {}),
      },
      select: {
        promoterId: true,
        locationId: true,
        amount: true,
        quantity: true,
      },
    }),
  ]);

  return buildPromoterReportData({ month: period.month, promoters, orders, returns });
}

export function resolvePromoterReportPeriod(month?: string | null) {
  const normalizedMonth = month && /^\d{4}-\d{2}$/.test(month) ? month : new Date().toISOString().slice(0, 7);
  const start = new Date(`${normalizedMonth}-01T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  return { month: normalizedMonth, start, end };
}

export function buildPromoterReportData({
  month,
  promoters,
  orders,
  returns,
}: {
  month: string;
  promoters: PromoterReportUser[];
  orders: PromoterReportOrder[];
  returns: PromoterReportReturn[];
}) {
  const rows = promoters.map((promoter) => {
    const promoterOrders = orders.filter((order) => order.createdById === promoter.id);
    const promoterReturns = returns.filter((item) => item.promoterId === promoter.id);
    const grossSales = promoterOrders.reduce((sum, order) => sum + Number(order.totalAmount), 0);
    const returnAmount = promoterReturns.reduce((sum, item) => sum + Number(item.amount), 0);
    const grossQuantity = promoterOrders.reduce(
      (sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
      0,
    );
    const returnQuantity = promoterReturns.reduce((sum, item) => sum + item.quantity, 0);

    return {
      promoterId: promoter.id,
      promoterName: promoter.name,
      locationId: promoter.defaultLocationId,
      locationName: promoter.defaultLocation?.name ?? "Unassigned",
      grossSales,
      returnAmount,
      netSales: grossSales - returnAmount,
      grossQuantity,
      returnQuantity,
      netQuantity: grossQuantity - returnQuantity,
      orderCount: promoterOrders.length,
    };
  });

  const rankedRows = rows
    .sort((a, b) => b.netSales - a.netSales)
    .map((row, index) => ({ ...row, rank: index + 1 }));

  return {
    period: { month },
    summary: {
      grossSales: rows.reduce((sum, row) => sum + row.grossSales, 0),
      returnAmount: rows.reduce((sum, row) => sum + row.returnAmount, 0),
      netSales: rows.reduce((sum, row) => sum + row.netSales, 0),
      grossQuantity: rows.reduce((sum, row) => sum + row.grossQuantity, 0),
      returnQuantity: rows.reduce((sum, row) => sum + row.returnQuantity, 0),
      netQuantity: rows.reduce((sum, row) => sum + row.netQuantity, 0),
      promoterCount: rows.length,
    },
    rows: rankedRows,
  };
}
