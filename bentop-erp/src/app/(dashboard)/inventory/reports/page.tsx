import { prisma } from "@/lib/db";
import {
  Package,
  AlertTriangle,
  TrendingDown,
  Warehouse,
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

export default async function InventoryReportsPage() {
  // Aggregate stock levels (batchId = null rows)
  const stockLevels = await prisma.stockLevel.findMany({
    where: { batchId: null, quantityOnHand: { gt: 0 } },
    include: {
      productVariant: {
        include: {
          product: {
            select: { id: true, name: true, baseCostMyr: true, categoryId: true },
          },
        },
      },
      location: { select: { id: true, name: true, type: true } },
    },
  });

  // Category lookup
  const categoryIds = [
    ...new Set(stockLevels.map((s) => s.productVariant.product.categoryId)),
  ];
  const categories = await prisma.category.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true, name: true },
  });
  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

  // Build valuation rows
  const rows = stockLevels.map((s) => {
    const unitCost =
      Number(s.productVariant.product.baseCostMyr) +
      Number(s.productVariant.additionalCost);
    return {
      sku: s.productVariant.sku,
      productName: s.productVariant.product.name,
      size: s.productVariant.size,
      color: s.productVariant.color,
      categoryName:
        categoryMap.get(s.productVariant.product.categoryId) ?? "Uncategorized",
      locationName: s.location.name,
      locationType: s.location.type,
      onHand: s.quantityOnHand,
      reserved: s.quantityReserved,
      available: s.quantityOnHand - s.quantityReserved,
      unitCost,
      totalValue: s.quantityOnHand * unitCost,
    };
  });

  const totalUnits = rows.reduce((s, r) => s + r.onHand, 0);
  const totalValue = rows.reduce((s, r) => s + r.totalValue, 0);
  const totalReserved = rows.reduce((s, r) => s + r.reserved, 0);

  // By category
  const catAgg: Record<string, { units: number; value: number }> = {};
  for (const r of rows) {
    const e = catAgg[r.categoryName] ?? { units: 0, value: 0 };
    e.units += r.onHand;
    e.value += r.totalValue;
    catAgg[r.categoryName] = e;
  }
  const byCategory = Object.entries(catAgg)
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.value - a.value);

  // By location
  const locAgg: Record<string, { name: string; type: string; units: number; value: number }> = {};
  for (const r of rows) {
    const e = locAgg[r.locationName] ?? { name: r.locationName, type: r.locationType, units: 0, value: 0 };
    e.units += r.onHand;
    e.value += r.totalValue;
    locAgg[r.locationName] = e;
  }
  const byLocation = Object.entries(locAgg)
    .map(([, v]) => v)
    .sort((a, b) => b.value - a.value);

  // Low stock
  const lowStockLevels = await prisma.stockLevel.findMany({
    where: { batchId: null, reorderPoint: { gt: 0 } },
    include: {
      productVariant: {
        select: {
          sku: true,
          size: true,
          color: true,
          product: { select: { name: true } },
        },
      },
      location: { select: { name: true } },
    },
  });
  const lowStock = lowStockLevels
    .filter((s) => s.quantityOnHand - s.quantityReserved <= s.reorderPoint)
    .map((s) => ({
      sku: s.productVariant.sku,
      productName: s.productVariant.product.name,
      size: s.productVariant.size,
      color: s.productVariant.color,
      locationName: s.location.name,
      available: s.quantityOnHand - s.quantityReserved,
      reorderPoint: s.reorderPoint,
      reorderQuantity: s.reorderQuantity,
    }))
    .sort((a, b) => a.available - b.available);

  // Recent movements (last 30 days, grouped by type)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const movementCounts = await prisma.stockMovement.groupBy({
    by: ["movementType"],
    _count: { _all: true },
    _sum: { quantity: true },
    where: { createdAt: { gte: thirtyDaysAgo } },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Inventory Reports</h2>
        <p className="text-muted-foreground">
          Stock valuation, location distribution, and reorder alerts.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <Package className="h-3.5 w-3.5" /> Total Stock
            </div>
            <div className="text-2xl font-bold mt-1">{totalUnits.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">units on hand</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <Warehouse className="h-3.5 w-3.5" /> Total Value
            </div>
            <div className="text-2xl font-bold mt-1">
              {formatCurrency(totalValue, "MYR")}
            </div>
            <div className="text-xs text-muted-foreground">at cost price</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <Package className="h-3.5 w-3.5" /> Reserved
            </div>
            <div className="text-2xl font-bold mt-1">{totalReserved.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">in confirmed orders</div>
          </CardContent>
        </Card>
        <Card className={lowStock.length > 0 ? "border-amber-200" : ""}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-amber-700 text-xs font-medium">
              <AlertTriangle className="h-3.5 w-3.5" /> Low Stock
            </div>
            <div className="text-2xl font-bold mt-1 text-amber-700">{lowStock.length}</div>
            <div className="text-xs text-muted-foreground">items below reorder point</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* By Category */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Value by Category</CardTitle>
          </CardHeader>
          <CardContent>
            {byCategory.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No stock data.</p>
            ) : (
              <div className="space-y-3">
                {byCategory.map((c) => {
                  const pct = totalValue > 0 ? (c.value / totalValue) * 100 : 0;
                  return (
                    <div key={c.name}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium">{c.name}</span>
                        <span className="text-muted-foreground">
                          {formatCurrency(c.value, "MYR")} · {c.units.toLocaleString()} units
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
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

        {/* By Location */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Value by Location</CardTitle>
          </CardHeader>
          <CardContent>
            {byLocation.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No stock data.</p>
            ) : (
              <div className="space-y-3">
                {byLocation.map((l) => {
                  const pct = totalValue > 0 ? (l.value / totalValue) * 100 : 0;
                  return (
                    <div key={l.name}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium">
                          {l.name}{" "}
                          <span className="text-xs text-muted-foreground">({l.type})</span>
                        </span>
                        <span className="text-muted-foreground">
                          {formatCurrency(l.value, "MYR")} · {l.units.toLocaleString()} units
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
      </div>

      {/* Movement summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Stock Movements (Last 30 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          {movementCounts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No movement activity in the last 30 days.
            </p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {movementCounts.map((m) => (
                <div key={m.movementType} className="border rounded-lg p-3">
                  <div className="text-xs text-muted-foreground uppercase">
                    {m.movementType.replace(/_/g, " ")}
                  </div>
                  <div className="text-xl font-bold mt-1">
                    {(m._sum.quantity ?? 0).toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {m._count._all} movements
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Low stock table */}
      {lowStock.length > 0 && (
        <Card className="border-amber-200">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-amber-600" />
              Low Stock Alerts
            </CardTitle>
            <CardDescription>
              Items at or below their reorder point
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-right">Available</TableHead>
                    <TableHead className="text-right">Reorder Point</TableHead>
                    <TableHead className="text-right">Reorder Qty</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lowStock.map((s, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-mono text-xs">{s.sku}</TableCell>
                      <TableCell>
                        <div className="text-sm">{s.productName}</div>
                        <div className="text-xs text-muted-foreground">
                          {s.color} · {s.size}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{s.locationName}</TableCell>
                      <TableCell className="text-right font-bold">
                        {s.available}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {s.reorderPoint}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {s.reorderQuantity}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={s.available <= 0 ? "destructive" : "warning"}
                          className="text-xs"
                        >
                          {s.available <= 0 ? "OUT" : "LOW"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top items by value */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top Items by Value</CardTitle>
          <CardDescription>
            Highest-value stock items across all locations (top 30)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">On Hand</TableHead>
                  <TableHead className="text-right">Reserved</TableHead>
                  <TableHead className="text-right">Unit Cost</TableHead>
                  <TableHead className="text-right">Total Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows
                  .sort((a, b) => b.totalValue - a.totalValue)
                  .slice(0, 30)
                  .map((r, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-mono text-xs">{r.sku}</TableCell>
                      <TableCell>
                        <div className="text-sm">{r.productName}</div>
                        <div className="text-xs text-muted-foreground">
                          {r.color} · {r.size}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{r.categoryName}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r.locationName}
                      </TableCell>
                      <TableCell className="text-right">{r.onHand}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {r.reserved}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(r.unitCost, "MYR")}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(r.totalValue, "MYR")}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
