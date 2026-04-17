import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  Package,
  ShoppingCart,
  AlertTriangle,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

const statusColors: Record<string, string> = {
  DRAFT: "secondary",
  CONFIRMED: "default",
  PROCESSING: "default",
  PACKED: "default",
  SHIPPED: "warning",
  DELIVERED: "success",
  CANCELLED: "destructive",
  RETURNED: "destructive",
};

function formatMyr(amount: number) {
  return `RM ${amount.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function DashboardPage() {
  const session = await auth();

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday.getTime() - 86400000);
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

  const [
    ordersThisMonth,
    ordersLastMonth,
    ordersToday,
    ordersYesterday,
    totalActiveProducts,
    recentOrders,
    lowStockLevels,
  ] = await Promise.all([
    // Fetch orders this month to compute MYR revenue (totalAmount * exchangeRateToMyr)
    prisma.order.findMany({
      where: {
        createdAt: { gte: startOfThisMonth },
        status: { notIn: ["CANCELLED", "RETURNED"] },
      },
      select: { totalAmount: true, exchangeRateToMyr: true },
    }),
    prisma.order.findMany({
      where: {
        createdAt: { gte: startOfLastMonth, lte: endOfLastMonth },
        status: { notIn: ["CANCELLED", "RETURNED"] },
      },
      select: { totalAmount: true, exchangeRateToMyr: true },
    }),
    prisma.order.count({
      where: { createdAt: { gte: startOfToday } },
    }),
    prisma.order.count({
      where: { createdAt: { gte: startOfYesterday, lt: startOfToday } },
    }),
    prisma.product.count({ where: { isActive: true } }),
    prisma.order.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        customer: { select: { name: true } },
        salesChannel: { select: { name: true } },
      },
    }),
    // Fetch stock levels with no batch (aggregate rows) where qty > 0
    prisma.stockLevel.findMany({
      where: { batchId: null },
      include: {
        productVariant: {
          select: {
            sku: true,
            size: true,
            color: true,
            product: { select: { name: true, isActive: true } },
          },
        },
        location: { select: { name: true } },
      },
      orderBy: { quantityOnHand: "asc" },
    }),
  ]);

  // Compute MYR revenue
  const revenueThis = ordersThisMonth.reduce(
    (sum, o) => sum + Number(o.totalAmount) * Number(o.exchangeRateToMyr),
    0
  );
  const revenueLast = ordersLastMonth.reduce(
    (sum, o) => sum + Number(o.totalAmount) * Number(o.exchangeRateToMyr),
    0
  );
  const revenueDiff = revenueLast > 0 ? ((revenueThis - revenueLast) / revenueLast) * 100 : 0;
  const orderDiff = ordersToday - ordersYesterday;

  // Filter to low-stock items: quantityOnHand < reorderPoint, active products only
  const lowStockItems = lowStockLevels
    .filter(
      (l) =>
        l.productVariant.product.isActive &&
        l.quantityOnHand < l.reorderPoint &&
        l.reorderPoint > 0
    )
    .slice(0, 5);

  const kpiCards = [
    {
      title: "Revenue This Month",
      value: formatMyr(revenueThis),
      change: `${revenueDiff >= 0 ? "+" : ""}${revenueDiff.toFixed(1)}%`,
      trend: revenueDiff >= 0 ? ("up" as const) : ("down" as const),
      icon: DollarSign,
      description: "vs last month",
      positiveIsUp: true,
    },
    {
      title: "Orders Today",
      value: String(ordersToday),
      change: `${orderDiff >= 0 ? "+" : ""}${orderDiff}`,
      trend: orderDiff >= 0 ? ("up" as const) : ("down" as const),
      icon: ShoppingCart,
      description: "vs yesterday",
      positiveIsUp: true,
    },
    {
      title: "Active Products",
      value: String(totalActiveProducts),
      change: "",
      trend: "up" as const,
      icon: Package,
      description: "total SKUs",
      positiveIsUp: true,
    },
    {
      title: "Low Stock Alerts",
      value: String(lowStockItems.length),
      change: "",
      trend: lowStockItems.length > 0 ? ("down" as const) : ("up" as const),
      icon: AlertTriangle,
      description: "items below reorder point",
      positiveIsUp: false,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          Welcome back, {session?.user?.name?.split(" ")[0]}
        </h2>
        <p className="text-muted-foreground">
          Here&apos;s what&apos;s happening with your business today.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              <card.icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
              {card.change ? (
                <div className="flex items-center text-xs text-muted-foreground mt-1">
                  {card.trend === "up" ? (
                    <ArrowUpRight className="h-3 w-3 text-green-600 mr-1" aria-hidden="true" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3 text-red-600 mr-1" aria-hidden="true" />
                  )}
                  <span
                    className={
                      (card.trend === "up") === card.positiveIsUp
                        ? "text-green-600"
                        : "text-red-600"
                    }
                  >
                    {card.change}
                  </span>
                  <span className="ml-1">{card.description}</span>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground mt-1">{card.description}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recent Orders</CardTitle>
            <Link
              href="/sales/orders"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {recentOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No orders yet</p>
            ) : (
              <div className="space-y-3">
                {recentOrders.map((order) => (
                  <Link
                    key={order.id}
                    href={`/sales/orders/${order.id}`}
                    className="flex items-center justify-between py-2 border-b last:border-0 hover:bg-muted/30 -mx-2 px-2 rounded transition-colors"
                  >
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium font-mono">{order.orderNumber}</p>
                      <p className="text-xs text-muted-foreground">
                        {order.customer?.name ?? "Walk-in"} &middot;{" "}
                        {order.salesChannel?.name ?? "—"}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">
                        {formatMyr(
                          Number(order.totalAmount) * Number(order.exchangeRateToMyr)
                        )}
                      </span>
                      <Badge
                        variant={
                          statusColors[order.status] as
                            | "default"
                            | "secondary"
                            | "destructive"
                            | "outline"
                            | "success"
                            | "warning"
                        }
                      >
                        {order.status}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600" aria-hidden="true" />
              Low Stock Alerts
            </CardTitle>
            <Link
              href="/inventory/stock"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {lowStockItems.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                All stock levels are healthy
              </p>
            ) : (
              <div className="space-y-3">
                {lowStockItems.map((item) => (
                  <div
                    key={`${item.productVariantId}-${item.locationId}`}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                  >
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium">
                        {item.productVariant.product.name} &ndash; {item.productVariant.color}{" "}
                        {item.productVariant.size}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {item.productVariant.sku} &middot; {item.location.name}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-red-600">
                        {item.quantityOnHand} left
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Reorder at {item.reorderPoint}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
