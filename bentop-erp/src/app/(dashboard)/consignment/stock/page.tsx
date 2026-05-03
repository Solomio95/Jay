import Link from "next/link";
import { Boxes, Building2, PackageSearch, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { prisma } from "@/lib/db";

type SearchParams = Promise<{
  search?: string;
  locationId?: string;
  partnerId?: string;
  page?: string;
}>;

const PAGE_SIZE = 100;

export default async function ConsignmentStockPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const search = sp.search?.trim() ?? "";
  const locationId = sp.locationId ?? "";
  const partnerId = sp.partnerId ?? "";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const consignmentLocationWhere = {
    isActive: true,
    type: "CONSIGNMENT" as const,
  };

  const [locations, partners] = await Promise.all([
    prisma.location.findMany({
      where: consignmentLocationWhere,
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.consignmentPartner.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, locationId: true },
    }),
  ]);

  const selectedPartner = partnerId
    ? partners.find((partner) => partner.id === partnerId)
    : null;
  const effectiveLocationId = selectedPartner?.locationId ?? locationId;

  const where = {
    batchId: null,
    location: consignmentLocationWhere,
    ...(effectiveLocationId ? { locationId: effectiveLocationId } : {}),
    ...(search
      ? {
          productVariant: {
            OR: [
              { sku: { contains: search, mode: "insensitive" as const } },
              { product: { name: { contains: search, mode: "insensitive" as const } } },
              { product: { skuPrefix: { contains: search, mode: "insensitive" as const } } },
            ],
          },
        }
      : {}),
  };

  const [rows, allMatching] = await Promise.all([
    prisma.stockLevel.findMany({
      where,
      include: {
        location: { select: { id: true, name: true } },
        productVariant: {
          include: {
            product: { select: { id: true, name: true, skuPrefix: true } },
          },
        },
      },
      orderBy: [
        { location: { name: "asc" } },
        { productVariant: { product: { name: "asc" } } },
        { productVariant: { sku: "asc" } },
      ],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.stockLevel.findMany({
      where,
      select: {
        quantityOnHand: true,
        quantityReserved: true,
        locationId: true,
        productVariant: {
          select: { productId: true, product: { select: { name: true } } },
        },
      },
    }),
  ]);

  const partnerByLocationId = new Map(
    partners
      .filter((partner) => partner.locationId)
      .map((partner) => [partner.locationId as string, partner]),
  );
  const totalUnits = allMatching.reduce((sum, row) => sum + row.quantityOnHand, 0);
  const totalReserved = allMatching.reduce((sum, row) => sum + row.quantityReserved, 0);
  const activeLocations = new Set(allMatching.map((row) => row.locationId)).size;
  const productCount = new Set(allMatching.map((row) => row.productVariant.productId)).size;
  const totalPages = Math.max(1, Math.ceil(allMatching.length / PAGE_SIZE));

  const productSummary = Object.values(
    allMatching.reduce<
      Record<string, { productId: string; productName: string; units: number; locations: Set<string> }>
    >((groups, row) => {
      const productId = row.productVariant.productId;
      groups[productId] ??= {
        productId,
        productName: row.productVariant.product.name,
        units: 0,
        locations: new Set<string>(),
      };
      groups[productId].units += row.quantityOnHand;
      groups[productId].locations.add(row.locationId);
      return groups;
    }, {}),
  );

  const queryForPage = (nextPage: number) => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (locationId) params.set("locationId", locationId);
    if (partnerId) params.set("partnerId", partnerId);
    if (nextPage > 1) params.set("page", String(nextPage));
    return `/consignment/stock?${params.toString()}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Consignment Stock</h2>
        <p className="text-muted-foreground">
          Stock on hand across all consignment partner locations.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric icon={<Boxes className="h-3.5 w-3.5" />} label="Units On Hand" value={totalUnits.toLocaleString()} />
        <Metric icon={<Building2 className="h-3.5 w-3.5" />} label="Active Locations" value={activeLocations.toLocaleString()} />
        <Metric icon={<PackageSearch className="h-3.5 w-3.5" />} label="Products" value={productCount.toLocaleString()} />
        <Metric icon={<Boxes className="h-3.5 w-3.5" />} label="Reserved" value={totalReserved.toLocaleString()} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-[1fr_240px_240px_auto]" action="/consignment/stock">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input name="search" defaultValue={search} className="pl-9" placeholder="Search SKU or product" />
            </div>
            <select
              name="partnerId"
              defaultValue={partnerId}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">All partners</option>
              {partners.map((partner) => (
                <option key={partner.id} value={partner.id}>
                  {partner.name}
                </option>
              ))}
            </select>
            <select
              name="locationId"
              defaultValue={locationId}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              disabled={Boolean(partnerId)}
            >
              <option value="">All consignment locations</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
            <Button type="submit">Apply</Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Location SKU Detail</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Location / Partner</TableHead>
                  <TableHead>SKU / Product</TableHead>
                  <TableHead>Variant</TableHead>
                  <TableHead className="text-right">On Hand</TableHead>
                  <TableHead className="text-right">Reserved</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      No consignment stock found.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => {
                    const partner = partnerByLocationId.get(row.locationId);
                    return (
                      <TableRow key={row.id}>
                        <TableCell>
                          <div className="font-medium">{row.location.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {partner?.name ?? "No partner linked"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-mono text-xs">{row.productVariant.sku}</div>
                          <div className="text-xs text-muted-foreground">
                            {row.productVariant.product.name}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-xs">
                            <span
                              className="inline-block h-3 w-3 rounded-full ring-1 ring-border"
                              style={{ backgroundColor: row.productVariant.colorHex || "#999" }}
                            />
                            {row.productVariant.color} / {row.productVariant.size}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {row.quantityOnHand.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {row.quantityReserved > 0 ? row.quantityReserved.toLocaleString() : "-"}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Product Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {productSummary.length === 0 ? (
              <p className="text-sm text-muted-foreground">No products found.</p>
            ) : (
              productSummary
                .sort((a, b) => b.units - a.units)
                .slice(0, 20)
                .map((product) => (
                  <div key={product.productId} className="rounded-md border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{product.productName}</div>
                        <div className="text-xs text-muted-foreground">
                          {product.locations.size.toLocaleString()} location(s)
                        </div>
                      </div>
                      <Badge variant="secondary">{product.units.toLocaleString()}</Badge>
                    </div>
                  </div>
                ))
            )}
          </CardContent>
        </Card>
      </div>

      {allMatching.length > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Showing {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, allMatching.length)} of{" "}
            {allMatching.length}
          </span>
          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline" disabled={page <= 1}>
              <Link href={queryForPage(page - 1)}>Previous</Link>
            </Button>
            <Button asChild size="sm" variant="outline" disabled={page >= totalPages}>
              <Link href={queryForPage(page + 1)}>Next</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {icon}
          {label}
        </div>
        <div className="mt-1 text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}
