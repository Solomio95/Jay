import { prisma } from "@/lib/db";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PackagePlus, PackageMinus, ArrowLeftRight, ClipboardList } from "lucide-react";
import { StockLevelsClient } from "@/components/inventory/stock-levels-client";

type SearchParams = Promise<{
  locationId?: string;
  search?: string;
  filter?: string;
  page?: string;
}>;

export default async function StockLevelsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const locationId = sp.locationId || "";
  const search = sp.search || "";
  const filter = sp.filter || "all";
  const page = Math.max(1, parseInt(sp.page || "1"));
  const pageSize = 50;

  const [locations, aggregates] = await Promise.all([
    prisma.location.findMany({
      where: { isActive: true },
      orderBy: [{ type: "asc" }, { name: "asc" }],
      select: { id: true, name: true, type: true },
    }),
    prisma.stockLevel.findMany({
      where: {
        batchId: null,
        ...(locationId ? { locationId } : {}),
        ...(search
          ? {
              productVariant: {
                OR: [
                  { sku: { contains: search, mode: "insensitive" } },
                  { product: { name: { contains: search, mode: "insensitive" } } },
                  { product: { skuPrefix: { contains: search, mode: "insensitive" } } },
                ],
              },
            }
          : {}),
      },
      include: {
        productVariant: {
          include: { product: { select: { id: true, name: true, skuPrefix: true } } },
        },
        location: { select: { id: true, name: true, type: true } },
      },
      orderBy: [{ location: { name: "asc" } }, { productVariant: { sku: "asc" } }],
    }),
  ]);

  const filtered = aggregates.filter((l) => {
    if (filter === "out") return l.quantityOnHand <= 0;
    if (filter === "low") return l.reorderPoint > 0 && l.quantityOnHand <= l.reorderPoint && l.quantityOnHand > 0;
    return true;
  });

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  // KPIs
  const total = aggregates.length;
  const outOfStock = aggregates.filter((l) => l.quantityOnHand <= 0).length;
  const lowStock = aggregates.filter(
    (l) => l.reorderPoint > 0 && l.quantityOnHand <= l.reorderPoint && l.quantityOnHand > 0
  ).length;
  const totalUnits = aggregates.reduce((s, l) => s + l.quantityOnHand, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Stock Levels</h2>
          <p className="text-muted-foreground">Real-time stock levels across all locations.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/inventory/stock/in">
              <PackagePlus className="mr-2 h-4 w-4" /> Stock In
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/inventory/stock/out">
              <PackageMinus className="mr-2 h-4 w-4" /> Stock Out
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/inventory/transfers">
              <ArrowLeftRight className="mr-2 h-4 w-4" /> Transfer
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/inventory/adjustments">
              <ClipboardList className="mr-2 h-4 w-4" /> Adjust
            </Link>
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs text-muted-foreground">Tracked SKU×Location</div>
            <div className="text-2xl font-bold mt-1">{total.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs text-muted-foreground">Total Units on Hand</div>
            <div className="text-2xl font-bold mt-1">{totalUnits.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card className="border-amber-200">
          <CardContent className="pt-6">
            <div className="text-xs text-amber-700 font-medium">Low Stock</div>
            <div className="text-2xl font-bold mt-1 text-amber-700">{lowStock}</div>
          </CardContent>
        </Card>
        <Card className="border-destructive/40">
          <CardContent className="pt-6">
            <div className="text-xs text-destructive font-medium">Out of Stock</div>
            <div className="text-2xl font-bold mt-1 text-destructive">{outOfStock}</div>
          </CardContent>
        </Card>
      </div>

      <StockLevelsClient
        locations={locations}
        rows={paged.map((l) => ({
          id: l.id,
          quantityOnHand: l.quantityOnHand,
          quantityReserved: l.quantityReserved,
          reorderPoint: l.reorderPoint,
          reorderQuantity: l.reorderQuantity,
          binLocation: l.binLocation,
          productVariantId: l.productVariantId,
          sku: l.productVariant.sku,
          size: l.productVariant.size,
          color: l.productVariant.color,
          colorHex: l.productVariant.colorHex,
          productName: l.productVariant.product.name,
          productSkuPrefix: l.productVariant.product.skuPrefix,
          locationId: l.locationId,
          locationName: l.location.name,
          locationType: l.location.type,
        }))}
        initialSearch={search}
        initialLocationId={locationId}
        initialFilter={filter}
        page={page}
        totalPages={totalPages}
        totalRows={filtered.length}
      />
    </div>
  );
}
