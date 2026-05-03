import { prisma } from "@/lib/db";
import {
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Users,
  Package,
  Store,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";

export default async function SalesReportsPage() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  const [currentOrders, previousOrders] = await Promise.all([
    prisma.order.findMany({
      where: { createdAt: { gte: thirtyDaysAgo }, status: { not: "CANCELLED" } },
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
    }),
    prisma.order.findMany({
      where: {
        createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo },
        status: { not: "CANCELLED" },
      },
      select: { totalAmount: true, currency: true, exchangeRateToMyr: true },
    }),
  ]);

  const toMyr = (o: { totalAmount: { toString: () => string }; currency: string; exchangeRateToMyr: { toString: () => string } }) =>
    Number(o.totalAmount) * (o.currency === "MYR" ? 1 : Number(o.exchangeRateToMyr));

  const totalRevenueMyr = currentOrders.reduce((s, o) => s + toMyr(o), 0);
  const prevRevenueMyr = previousOrders.reduce((s, o) => s + toMyr(o), 0);
  const revenueChange =
    prevRevenueMyr > 0 ? ((totalRevenueMyr - prevRevenueMyr) / prevRevenueMyr) * 100 : 0;
  const totalOrders = currentOrders.length;
  const totalUnits = currentOrders.reduce(
    (s, o) => s + o.items.reduce((x, i) => x + i.quantity, 0),
    0
  );
  const avgOrderValue = totalOrders > 0 ? totalRevenueMyr / totalOrders : 0;

  const totalCostMyr = currentOrders.reduce(
    (s, o) =>
      s + o.items.reduce((x, i) => x + Number(i.costAtTimeOfSale) * i.quantity, 0),
    0
  );
  const grossProfit = totalRevenueMyr - totalCostMyr;
  const grossMarginPct = totalRevenueMyr > 0 ? (grossProfit / totalRevenueMyr) * 100 : 0;

  // Revenue by day
  const byDay: Record<string, { revenue: number; orders: number }> = {};
  for (const o of currentOrders) {
    const day = o.createdAt.toISOString().slice(0, 10);
    const entry = byDay[day] ?? { revenue: 0, orders: 0 };
    entry.revenue += toMyr(o);
    entry.orders += 1;
    byDay[day] = entry;
  }
  const dayEntries = Object.entries(byDay)
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const peakDay = dayEntries.length > 0
    ? dayEntries.reduce((best, d) => (d.revenue > best.revenue ? d : best))
    : null;

  // By channel
  const byChannel: Record<
    string,
    { name: string; type: string; revenue: number; orders: number; units: number }
  > = {};
  for (const o of currentOrders) {
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
  const channelRows = Object.entries(byChannel)
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.revenue - a.revenue);

  // By product
  const byProduct: Record<
    string,
    { name: string; revenue: number; cost: number; units: number }
  > = {};
  for (const o of currentOrders) {
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
  const productRows = Object.entries(byProduct)
    .map(([id, v]) => ({
      id,
      ...v,
      margin: v.revenue > 0 ? ((v.revenue - v.cost) / v.revenue) * 100 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 15);

  // Top customers
  const byCustomer: Record<string, { name: string; type: string; revenue: number; orders: number }> = {};
  for (const o of currentOrders) {
    const key = o.customer?.id ?? "_walkin";
    const entry = byCustomer[key] ?? {
      name: o.customer?.name ?? "Walk-in",
      type: o.customer?.customerType ?? "—",
      revenue: 0,
      orders: 0,
    };
    entry.revenue += toMyr(o);
    entry.orders += 1;
    byCustomer[key] = entry;
  }
  const customerRows = Object.entries(byCustomer)
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Sales Reports</h2>
        <p className="text-muted-foreground">
          Revenue analytics, product performance, and channel breakdown (last 30 days).
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <DollarSign className="h-3.5 w-3.5" /> Revenue
            </div>
            <div className="text-2xl font-bold mt-1">
              {formatCurrency(totalRevenueMyr, "MYR")}
            </div>
            <div className="text-xs mt-0.5">
              {revenueChange >= 0 ? (
                <span className="text-green-600">+{revenueChange.toFixed(1)}%</span>
              ) : (
                <span className="text-destructive">{revenueChange.toFixed(1)}%</span>
              )}{" "}
              <span className="text-muted-foreground">vs prior 30d</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <ShoppingCart className="h-3.5 w-3.5" /> Orders
            </div>
            <div className="text-2xl font-bold mt-1">{totalOrders}</div>
            <div className="text-xs text-muted-foreground">{totalUnits} units</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <TrendingUp className="h-3.5 w-3.5" /> AOV
            </div>
            <div className="text-2xl font-bold mt-1">
              {formatCurrency(avgOrderValue, "MYR")}
            </div>
            <div className="text-xs text-muted-foreground">avg order value</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <DollarSign className="h-3.5 w-3.5" /> Gross Profit
            </div>
            <div className="text-2xl font-bold mt-1">
              {formatCurrency(grossProfit, "MYR")}
            </div>
            <div className="text-xs text-muted-foreground">
              {grossMarginPct.toFixed(1)}% margin
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <Store className="h-3.5 w-3.5" /> Channels
            </div>
            <div className="text-2xl font-bold mt-1">{channelRows.length}</div>
            <div className="text-xs text-muted-foreground">active channels</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <Users className="h-3.5 w-3.5" /> Customers
            </div>
            <div className="text-2xl font-bold mt-1">{customerRows.length}</div>
            <div className="text-xs text-muted-foreground">unique buyers</div>
          </CardContent>
        </Card>
      </div>

      {/* Daily revenue text chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Daily Revenue</CardTitle>
          <CardDescription>
            {dayEntries.length > 0
              ? `${dayEntries.length} days · Peak: ${peakDay?.date} (${formatCurrency(peakDay?.revenue ?? 0, "MYR")})`
              : "No order data"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {dayEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No data.</p>
          ) : (
            <div className="space-y-1.5 max-h-80 overflow-y-auto">
              {dayEntries.map((d) => {
                const maxRev = peakDay?.revenue || 1;
                const pct = (d.revenue / maxRev) * 100;
                return (
                  <div key={d.date} className="flex items-center gap-3 text-xs">
                    <span className="w-20 text-muted-foreground font-mono">{d.date}</span>
                    <div className="flex-1 h-4 bg-muted rounded overflow-hidden">
                      <div
                        className="h-full bg-primary rounded"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-28 text-right font-medium">
                      {formatCurrency(d.revenue, "MYR")}
                    </span>
                    <span className="w-12 text-right text-muted-foreground">
                      {d.orders}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* By Channel */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Revenue by Channel</CardTitle>
          </CardHeader>
          <CardContent>
            {channelRows.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No data.</p>
            ) : (
              <div className="space-y-3">
                {channelRows.map((c) => {
                  const pct =
                    totalRevenueMyr > 0 ? (c.revenue / totalRevenueMyr) * 100 : 0;
                  return (
                    <div key={c.id}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium">
                          {c.name}{" "}
                          <span className="text-xs text-muted-foreground">({c.type})</span>
                        </span>
                        <span className="text-muted-foreground">
                          {formatCurrency(c.revenue, "MYR")} · {c.orders} orders
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Customers */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Customers</CardTitle>
          </CardHeader>
          <CardContent>
            {customerRows.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No data.</p>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Orders</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customerRows.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium text-sm">{c.name}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {c.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{c.orders}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(c.revenue, "MYR")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Product performance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Product Performance</CardTitle>
          <CardDescription>Top 15 products by revenue (last 30 days)</CardDescription>
        </CardHeader>
        <CardContent>
          {productRows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No data.</p>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Units</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">COGS</TableHead>
                    <TableHead className="text-right">Gross Profit</TableHead>
                    <TableHead className="text-right">Margin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productRows.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium text-sm">{p.name}</TableCell>
                      <TableCell className="text-right">{p.units}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(p.revenue, "MYR")}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatCurrency(p.cost, "MYR")}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(p.revenue - p.cost, "MYR")}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant={p.margin >= 30 ? "success" : p.margin >= 15 ? "warning" : "destructive"}
                          className="text-xs"
                        >
                          {p.margin.toFixed(1)}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
