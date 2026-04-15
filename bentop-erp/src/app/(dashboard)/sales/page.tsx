import Link from "next/link";
import { prisma } from "@/lib/db";
import {
  ShoppingCart,
  Users,
  Store,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Package,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDateTime } from "@/lib/utils";

const STATUS_COLOR: Record<string, "default" | "secondary" | "success" | "warning" | "destructive"> = {
  DRAFT: "secondary",
  CONFIRMED: "default",
  PROCESSING: "warning",
  PACKED: "warning",
  SHIPPED: "default",
  DELIVERED: "success",
  CANCELLED: "destructive",
  RETURNED: "destructive",
};

export default async function SalesDashboardPage() {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    todayOrders,
    weekOrders,
    monthOrders,
    unpaidCount,
    pendingCount,
    customerCount,
    channelCount,
    recentOrders,
    statusBreakdown,
    topChannels,
  ] = await Promise.all([
    prisma.order.findMany({
      where: { createdAt: { gte: startOfToday }, status: { not: "CANCELLED" } },
      select: { totalAmount: true, currency: true, exchangeRateToMyr: true },
    }),
    prisma.order.findMany({
      where: { createdAt: { gte: sevenDaysAgo }, status: { not: "CANCELLED" } },
      select: { totalAmount: true, currency: true, exchangeRateToMyr: true },
    }),
    prisma.order.findMany({
      where: { createdAt: { gte: thirtyDaysAgo }, status: { not: "CANCELLED" } },
      select: { totalAmount: true, currency: true, exchangeRateToMyr: true },
    }),
    prisma.order.count({
      where: {
        paymentStatus: "UNPAID",
        status: { in: ["DELIVERED", "SHIPPED", "PACKED", "PROCESSING"] },
      },
    }),
    prisma.order.count({
      where: { status: { in: ["CONFIRMED", "PROCESSING", "PACKED"] } },
    }),
    prisma.customer.count({ where: { isActive: true } }),
    prisma.salesChannel.count({ where: { isActive: true } }),
    prisma.order.findMany({
      include: {
        customer: { select: { id: true, name: true } },
        salesChannel: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.order.groupBy({
      by: ["status"],
      _count: { _all: true },
      where: { createdAt: { gte: thirtyDaysAgo } },
    }),
    prisma.order.groupBy({
      by: ["salesChannelId"],
      _count: { _all: true },
      _sum: { totalAmount: true },
      where: {
        createdAt: { gte: thirtyDaysAgo },
        status: { not: "CANCELLED" },
        salesChannelId: { not: null },
      },
    }),
  ]);

  const sumInMyr = (
    rows: { totalAmount: { toString: () => string }; currency: string; exchangeRateToMyr: { toString: () => string } }[]
  ) =>
    rows.reduce(
      (s, o) => s + Number(o.totalAmount) * (o.currency === "MYR" ? 1 : Number(o.exchangeRateToMyr)),
      0
    );

  const todayRevenue = sumInMyr(todayOrders);
  const weekRevenue = sumInMyr(weekOrders);
  const monthRevenue = sumInMyr(monthOrders);

  const channelIds = topChannels.map((c) => c.salesChannelId).filter((v): v is string => v !== null);
  const channels = await prisma.salesChannel.findMany({
    where: { id: { in: channelIds } },
    select: { id: true, name: true, type: true },
  });
  const channelMap = new Map(channels.map((c) => [c.id, c]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Sales Overview</h2>
          <p className="text-muted-foreground">
            Revenue, active orders, and channel performance.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/sales/pos">
              <Store className="h-4 w-4 mr-2" />
              POS
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/sales/orders/new">
              <ShoppingCart className="h-4 w-4 mr-2" />
              New Order
            </Link>
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <TrendingUp className="h-3.5 w-3.5" /> Today
            </div>
            <div className="text-2xl font-bold mt-1">
              {formatCurrency(todayRevenue, "MYR")}
            </div>
            <div className="text-xs text-muted-foreground">{todayOrders.length} orders</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <TrendingUp className="h-3.5 w-3.5" /> Last 7 days
            </div>
            <div className="text-2xl font-bold mt-1">
              {formatCurrency(weekRevenue, "MYR")}
            </div>
            <div className="text-xs text-muted-foreground">{weekOrders.length} orders</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <TrendingUp className="h-3.5 w-3.5" /> Last 30 days
            </div>
            <div className="text-2xl font-bold mt-1">
              {formatCurrency(monthRevenue, "MYR")}
            </div>
            <div className="text-xs text-muted-foreground">{monthOrders.length} orders</div>
          </CardContent>
        </Card>
        <Card className="border-amber-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-amber-700 text-xs font-medium">
              <Clock className="h-3.5 w-3.5" /> Pending
            </div>
            <div className="text-2xl font-bold mt-1 text-amber-700">{pendingCount}</div>
            <div className="text-xs text-muted-foreground">To process/pack</div>
          </CardContent>
        </Card>
        <Card className="border-destructive/40">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive text-xs font-medium">
              <AlertTriangle className="h-3.5 w-3.5" /> Unpaid
            </div>
            <div className="text-2xl font-bold mt-1 text-destructive">{unpaidCount}</div>
            <div className="text-xs text-muted-foreground">Shipped/delivered</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <Users className="h-3.5 w-3.5" /> Customers
            </div>
            <div className="text-2xl font-bold mt-1">{customerCount.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">{channelCount} channels</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent orders */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Recent Orders</CardTitle>
              <CardDescription>Last 8 orders across all channels</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/sales/orders">View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentOrders.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-6">
                No orders yet. Start with a POS sale or create a new order.
              </div>
            ) : (
              <div className="divide-y">
                {recentOrders.map((o) => (
                  <Link
                    key={o.id}
                    href={`/sales/orders/${o.id}`}
                    className="flex items-center gap-3 py-2.5 hover:bg-muted/30 -mx-2 px-2 rounded"
                  >
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                      {o.status === "DELIVERED" ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : o.status === "CANCELLED" || o.status === "RETURNED" ? (
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                      ) : (
                        <Package className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-medium">{o.orderNumber}</span>
                        <Badge variant={STATUS_COLOR[o.status]} className="text-xs">
                          {o.status}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {o.customer?.name ?? "Walk-in"}
                        {o.salesChannel && ` · ${o.salesChannel.name}`}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-sm">
                        {formatCurrency(Number(o.totalAmount), o.currency)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDateTime(o.createdAt)}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Status breakdown (last 30d) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Orders by Status</CardTitle>
            <CardDescription>Last 30 days</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {statusBreakdown.length === 0 ? (
              <div className="text-sm text-muted-foreground py-3 text-center">
                No activity.
              </div>
            ) : (
              statusBreakdown
                .sort((a, b) => b._count._all - a._count._all)
                .map((s) => {
                  const total = statusBreakdown.reduce((sum, x) => sum + x._count._all, 0);
                  const pct = total > 0 ? (s._count._all / total) * 100 : 0;
                  return (
                    <div key={s.status}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium">{s.status}</span>
                        <span className="text-muted-foreground">{s._count._all}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top channels */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Channel Performance</CardTitle>
          <CardDescription>Last 30 days — excluding cancelled</CardDescription>
        </CardHeader>
        <CardContent>
          {topChannels.length === 0 ? (
            <div className="text-sm text-muted-foreground py-3 text-center">
              No channel-attributed orders yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {topChannels
                .sort((a, b) => Number(b._sum.totalAmount ?? 0) - Number(a._sum.totalAmount ?? 0))
                .map((c) => {
                  const channel = c.salesChannelId ? channelMap.get(c.salesChannelId) : null;
                  if (!channel) return null;
                  return (
                    <div key={c.salesChannelId} className="border rounded-lg p-3">
                      <div className="font-medium text-sm">{channel.name}</div>
                      <div className="text-xs text-muted-foreground mb-2">{channel.type}</div>
                      <div className="flex items-end justify-between">
                        <div>
                          <div className="text-xl font-bold">
                            {formatCurrency(Number(c._sum.totalAmount ?? 0), "MYR")}
                          </div>
                          <div className="text-xs text-muted-foreground">{c._count._all} orders</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
