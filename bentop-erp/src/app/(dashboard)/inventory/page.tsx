import Link from "next/link";
import { prisma } from "@/lib/db";
import {
  Package,
  Boxes,
  AlertTriangle,
  XCircle,
  MapPin,
  TrendingUp,
  TrendingDown,
  ArrowLeftRight,
  ClipboardList,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";

export default async function InventoryDashboardPage() {
  const [
    totalProducts,
    totalVariants,
    locations,
    aggregateLevels,
    recentMovements,
    pendingTransfers,
  ] = await Promise.all([
    prisma.product.count({ where: { isActive: true } }),
    prisma.productVariant.count({ where: { isActive: true } }),
    prisma.location.findMany({
      where: { isActive: true },
      orderBy: [{ type: "asc" }, { name: "asc" }],
    }),
    prisma.stockLevel.findMany({
      where: { batchId: null },
      include: {
        productVariant: {
          include: { product: { select: { id: true, name: true } } },
        },
        location: { select: { id: true, name: true, type: true } },
      },
    }),
    prisma.stockMovement.findMany({
      include: {
        productVariant: {
          select: {
            sku: true,
            size: true,
            color: true,
            colorHex: true,
            product: { select: { name: true } },
          },
        },
        fromLocation: { select: { name: true } },
        toLocation: { select: { name: true } },
        performedBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.stockTransfer.count({ where: { status: { in: ["REQUESTED", "APPROVED"] } } }),
  ]);

  const totalUnits = aggregateLevels.reduce((s, l) => s + l.quantityOnHand, 0);
  const outOfStock = aggregateLevels.filter((l) => l.quantityOnHand <= 0).length;
  const lowStock = aggregateLevels.filter(
    (l) => l.reorderPoint > 0 && l.quantityOnHand <= l.reorderPoint && l.quantityOnHand > 0
  );

  // Stock by location type
  const locationTotals = aggregateLevels.reduce<Record<string, { units: number; records: number }>>(
    (acc, l) => {
      const key = l.location.name;
      (acc[key] ||= { units: 0, records: 0 }).units += l.quantityOnHand;
      acc[key].records += 1;
      return acc;
    },
    {}
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Inventory Overview</h2>
          <p className="text-muted-foreground">
            Real-time stock levels, recent activity, and alerts.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/inventory/stock/in">Stock In</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/inventory/stock/out">Stock Out</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/inventory/stock">View All Stock</Link>
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <Package className="h-3.5 w-3.5" /> Products
            </div>
            <div className="text-2xl font-bold mt-1">{totalProducts.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <Boxes className="h-3.5 w-3.5" /> SKU Variants
            </div>
            <div className="text-2xl font-bold mt-1">{totalVariants.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <MapPin className="h-3.5 w-3.5" /> Locations
            </div>
            <div className="text-2xl font-bold mt-1">{locations.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <TrendingUp className="h-3.5 w-3.5" /> Total Units
            </div>
            <div className="text-2xl font-bold mt-1">{totalUnits.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card className="border-amber-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-amber-700 text-xs font-medium">
              <AlertTriangle className="h-3.5 w-3.5" /> Low Stock
            </div>
            <div className="text-2xl font-bold mt-1 text-amber-700">{lowStock.length}</div>
          </CardContent>
        </Card>
        <Card className="border-destructive/40">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive text-xs font-medium">
              <XCircle className="h-3.5 w-3.5" /> Out of Stock
            </div>
            <div className="text-2xl font-bold mt-1 text-destructive">{outOfStock}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Low Stock Alerts */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                Low Stock Alerts
              </CardTitle>
              <CardDescription>
                SKU × location pairs at or below reorder point
              </CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/inventory/stock?filter=low">View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {lowStock.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-6">
                No low-stock items. 🎉
              </div>
            ) : (
              <div className="space-y-2">
                {lowStock.slice(0, 6).map((l) => (
                  <div
                    key={l.id}
                    className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/40 text-sm"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="font-mono text-xs">{l.productVariant.sku}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {l.productVariant.product.name} · {l.location.name}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-amber-700 font-medium">{l.quantityOnHand}</span>
                      <span className="text-xs text-muted-foreground">/ {l.reorderPoint}</span>
                      <Badge variant="warning" className="text-xs">Low</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stock by Location */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Units by Location</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(locationTotals)
              .sort((a, b) => b[1].units - a[1].units)
              .map(([name, data]) => {
                const pct = totalUnits > 0 ? (data.units / totalUnits) * 100 : 0;
                return (
                  <div key={name}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium">{name}</span>
                      <span className="text-muted-foreground">{data.units.toLocaleString()}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            {Object.keys(locationTotals).length === 0 && (
              <div className="text-sm text-muted-foreground py-3 text-center">
                No stock yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity + Pending Transfers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Recent Stock Activity</CardTitle>
              <CardDescription>Last 10 movements across all locations</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {recentMovements.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-6">
                No movements yet. Start with Stock In to receive inventory.
              </div>
            ) : (
              <div className="divide-y">
                {recentMovements.map((m) => {
                  const isOut = m.movementType === "OUTBOUND" || (!!m.fromLocationId && !m.toLocationId);
                  const isIn = m.movementType === "INBOUND" || (!!m.toLocationId && !m.fromLocationId);
                  return (
                    <div key={m.id} className="flex items-center gap-3 py-2.5 text-sm">
                      <div
                        className={`h-8 w-8 rounded-full flex items-center justify-center ${
                          isIn
                            ? "bg-green-100 text-green-700"
                            : isOut
                            ? "bg-red-100 text-red-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {isIn ? (
                          <TrendingUp className="h-4 w-4" />
                        ) : isOut ? (
                          <TrendingDown className="h-4 w-4" />
                        ) : (
                          <ArrowLeftRight className="h-4 w-4" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs">{m.productVariant.sku}</span>
                          <span className="text-xs text-muted-foreground">
                            · {m.productVariant.color} · {m.productVariant.size}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {m.movementType} ·{" "}
                          {m.fromLocation && m.toLocation
                            ? `${m.fromLocation.name} → ${m.toLocation.name}`
                            : m.fromLocation?.name || m.toLocation?.name}
                          {m.reason && ` · ${m.reason}`}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">
                          {isIn ? "+" : isOut ? "−" : ""}
                          {m.quantity}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatDateTime(m.createdAt)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span>Pending Transfers</span>
              {pendingTransfers > 0 && (
                <Badge variant="warning" className="text-xs">{pendingTransfers}</Badge>
              )}
            </CardTitle>
            <CardDescription>Transfers awaiting approval or completion</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button asChild variant="outline" className="w-full justify-start">
              <Link href="/inventory/transfers?status=REQUESTED">
                <ArrowLeftRight className="mr-2 h-4 w-4" />
                View Pending Transfers
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-start">
              <Link href="/inventory/transfers/new">
                <ArrowLeftRight className="mr-2 h-4 w-4" />
                Request New Transfer
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-start">
              <Link href="/inventory/adjustments">
                <ClipboardList className="mr-2 h-4 w-4" />
                Stock Adjustments
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-start">
              <Link href="/inventory/locations">
                <MapPin className="mr-2 h-4 w-4" />
                Manage Locations
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
