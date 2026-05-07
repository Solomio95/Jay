import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";
import { canViewReports, forbiddenResponse } from "@/lib/permissions";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const role = (session.user as unknown as { role: string }).role;
    if (!canViewReports(role)) {
      return forbiddenResponse();
    }
  
    const sp = request.nextUrl.searchParams;
    const days = parseInt(sp.get("days") ?? "30", 10);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  
    const orders = await prisma.order.findMany({
      where: { createdAt: { gte: since }, status: { not: "CANCELLED" } },
      include: {
        customer: { select: { id: true, name: true, customerType: true } },
        salesChannel: { select: { id: true, name: true, type: true } },
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
  
    // Revenue in MYR
    const toMyr = (o: { totalAmount: { toString: () => string }; currency: string; exchangeRateToMyr: { toString: () => string } }) =>
      Number(o.totalAmount) * (o.currency === "MYR" ? 1 : Number(o.exchangeRateToMyr));
  
    const totalRevenueMyr = orders.reduce((s, o) => s + toMyr(o), 0);
    const totalOrders = orders.length;
    const totalUnits = orders.reduce(
      (s, o) => s + o.items.reduce((x, i) => x + i.quantity, 0),
      0
    );
    const avgOrderValue = totalOrders > 0 ? totalRevenueMyr / totalOrders : 0;
  
    // Cost and margin
    const totalCostMyr = orders.reduce(
      (s, o) =>
        s + o.items.reduce((x, i) => x + Number(i.costAtTimeOfSale) * i.quantity, 0),
      0
    );
    const grossProfit = totalRevenueMyr - totalCostMyr;
    const grossMarginPct = totalRevenueMyr > 0 ? (grossProfit / totalRevenueMyr) * 100 : 0;
  
    // Revenue by day (for chart)
    const byDay: Record<string, { revenue: number; orders: number; units: number }> = {};
    for (const o of orders) {
      const day = o.createdAt.toISOString().slice(0, 10);
      const entry = byDay[day] ?? { revenue: 0, orders: 0, units: 0 };
      entry.revenue += toMyr(o);
      entry.orders += 1;
      entry.units += o.items.reduce((x, i) => x + i.quantity, 0);
      byDay[day] = entry;
    }
  
    // By channel
    const byChannel: Record<
      string,
      { name: string; type: string; revenue: number; orders: number; units: number }
    > = {};
    for (const o of orders) {
      const key = o.salesChannel?.id ?? "_direct";
      const entry = byChannel[key] ?? {
        name: o.salesChannel?.name ?? "Direct",
        type: o.salesChannel?.type ?? "—",
        revenue: 0,
        orders: 0,
        units: 0,
      };
      entry.revenue += toMyr(o);
      entry.orders += 1;
      entry.units += o.items.reduce((x, i) => x + i.quantity, 0);
      byChannel[key] = entry;
    }
  
    // By product
    const byProduct: Record<
      string,
      { name: string; revenue: number; cost: number; units: number }
    > = {};
    for (const o of orders) {
      const rate = o.currency === "MYR" ? 1 : Number(o.exchangeRateToMyr);
      for (const item of o.items) {
        const key = item.productVariant.product.id;
        const entry = byProduct[key] ?? {
          name: item.productVariant.product.name,
          revenue: 0,
          cost: 0,
          units: 0,
        };
        entry.revenue += Number(item.totalPrice) * rate;
        entry.cost += Number(item.costAtTimeOfSale) * item.quantity;
        entry.units += item.quantity;
        byProduct[key] = entry;
      }
    }
  
    // By customer type
    const byCustomerType: Record<string, { revenue: number; orders: number }> = {};
    for (const o of orders) {
      const key = o.customer?.customerType ?? "WALK_IN";
      const entry = byCustomerType[key] ?? { revenue: 0, orders: 0 };
      entry.revenue += toMyr(o);
      entry.orders += 1;
      byCustomerType[key] = entry;
    }
  
    // Top customers
    const byCustomer: Record<string, { name: string; revenue: number; orders: number }> = {};
    for (const o of orders) {
      const key = o.customer?.id ?? "_walkin";
      const entry = byCustomer[key] ?? {
        name: o.customer?.name ?? "Walk-in",
        revenue: 0,
        orders: 0,
      };
      entry.revenue += toMyr(o);
      entry.orders += 1;
      byCustomer[key] = entry;
    }
  
    return Response.json({
      data: {
        period: { days, since: since.toISOString() },
        summary: {
          totalRevenueMyr,
          totalOrders,
          totalUnits,
          avgOrderValue,
          totalCostMyr,
          grossProfit,
          grossMarginPct,
        },
        byDay: Object.entries(byDay)
          .map(([date, v]) => ({ date, ...v }))
          .sort((a, b) => a.date.localeCompare(b.date)),
        byChannel: Object.entries(byChannel)
          .map(([id, v]) => ({ id, ...v }))
          .sort((a, b) => b.revenue - a.revenue),
        byProduct: Object.entries(byProduct)
          .map(([id, v]) => ({
            id,
            ...v,
            margin: v.revenue > 0 ? ((v.revenue - v.cost) / v.revenue) * 100 : 0,
          }))
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 20),
        byCustomerType: Object.entries(byCustomerType)
          .map(([type, v]) => ({ type, ...v }))
          .sort((a, b) => b.revenue - a.revenue),
        topCustomers: Object.entries(byCustomer)
          .map(([id, v]) => ({ id, ...v }))
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 10),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
