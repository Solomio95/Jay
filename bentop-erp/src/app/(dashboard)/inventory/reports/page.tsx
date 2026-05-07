import type { ReactNode } from "react";
import { AlertTriangle, Download, Package, Search, TrendingDown, Warehouse } from "lucide-react";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { CsvImportToolsClient } from "@/components/inventory/csv-import-tools-client";
import { getInventoryReport } from "@/lib/reports/inventory";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function InventoryReportsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = {
    locationId: getParam(params, "locationId"),
    productId: getParam(params, "productId"),
    productVariantId: getParam(params, "productVariantId"),
    search: getParam(params, "search"),
  };

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const [report, locations, products, variants, movementCounts] = await Promise.all([
    getInventoryReport(filters),
    prisma.location.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.product.findMany({ where: { isActive: true }, select: { id: true, name: true, skuPrefix: true }, orderBy: { name: "asc" } }),
    prisma.productVariant.findMany({ where: { isActive: true }, select: { id: true, sku: true }, orderBy: { sku: "asc" }, take: 500 }),
    prisma.stockMovement.groupBy({
      by: ["movementType"],
      _count: { _all: true },
      _sum: { quantity: true },
      where: { createdAt: { gte: thirtyDaysAgo } },
    }),
  ]);

  const exportHref = `/api/v1/exports/reports/inventory${toQueryString(filters)}`;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Inventory Reports</h2>
          <p className="text-muted-foreground">
            Stock valuation, location distribution, and reorder alerts.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <a href={exportHref}>
            <Download className="mr-2 h-4 w-4" />
            Report CSV
          </a>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
          <CardDescription>Filter by location, parent SKU, sub SKU, or search text.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-5">
            <select name="locationId" defaultValue={filters.locationId ?? ""} className="h-10 rounded-md border bg-background px-3 text-sm">
              <option value="">All locations</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>{location.name}</option>
              ))}
            </select>
            <select name="productId" defaultValue={filters.productId ?? ""} className="h-10 rounded-md border bg-background px-3 text-sm">
              <option value="">All parent SKUs</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>{product.skuPrefix} - {product.name}</option>
              ))}
            </select>
            <select name="productVariantId" defaultValue={filters.productVariantId ?? ""} className="h-10 rounded-md border bg-background px-3 text-sm">
              <option value="">All sub SKUs</option>
              {variants.map((variant) => (
                <option key={variant.id} value={variant.id}>{variant.sku}</option>
              ))}
            </select>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input name="search" defaultValue={filters.search ?? ""} placeholder="Search SKU or product" className="pl-9" />
            </div>
            <Button type="submit">Apply</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Import and Export Tools</CardTitle>
          <CardDescription>
            Download clean templates, validate CSV data first, then import only after row errors are fixed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CsvImportToolsClient />
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Metric icon={<Package className="h-3.5 w-3.5" />} label="Total Stock" value={report.summary.totalUnits.toLocaleString()} note="units on hand" />
        <Metric icon={<Warehouse className="h-3.5 w-3.5" />} label="Total Value" value={formatCurrency(report.summary.totalValue, "MYR")} note="at cost price" />
        <Metric icon={<Package className="h-3.5 w-3.5" />} label="Reserved" value={report.summary.totalReserved.toLocaleString()} note={`${report.summary.totalAvailable.toLocaleString()} available`} />
        <Metric icon={<AlertTriangle className="h-3.5 w-3.5" />} label="Low Stock" value={report.summary.lowStockCount.toLocaleString()} note="below reorder point" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BreakdownCard title="Value by Category" rows={report.byCategory.map((row) => ({
          key: row.name,
          label: row.name,
          value: formatCurrency(row.value, "MYR"),
          note: `${row.units.toLocaleString()} units`,
          pct: report.summary.totalValue > 0 ? (row.value / report.summary.totalValue) * 100 : 0,
        }))} />
        <BreakdownCard title="Value by Location" rows={report.byLocation.map((row) => ({
          key: row.id,
          label: row.name,
          value: formatCurrency(row.value, "MYR"),
          note: `${row.units.toLocaleString()} units`,
          pct: report.summary.totalValue > 0 ? (row.value / report.summary.totalValue) * 100 : 0,
        }))} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Stock Movements (Last 30 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          {movementCounts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No movement activity in the last 30 days.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {movementCounts.map((movement) => (
                <div key={movement.movementType} className="border rounded-lg p-3">
                  <div className="text-xs text-muted-foreground uppercase">{movement.movementType.replace(/_/g, " ")}</div>
                  <div className="text-xl font-bold mt-1">{(movement._sum.quantity ?? 0).toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">{movement._count._all} movements</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {report.lowStock.length > 0 && (
        <Card className="border-amber-200">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-amber-600" />
              Low Stock Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              headers={["SKU", "Product", "Location", "Available", "Reorder Point", "Reorder Qty", "Status"]}
              rows={report.lowStock.map((row) => [
                row.sku,
                `${row.productName} (${row.color ?? "-"} / ${row.size ?? "-"})`,
                row.locationName,
                row.available,
                row.reorderPoint,
                row.reorderQuantity,
                row.available <= 0 ? "OUT" : "LOW",
              ])}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top Items by Value</CardTitle>
          <CardDescription>Highest-value stock items for the current filters.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Parent SKU</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">On Hand</TableHead>
                  <TableHead className="text-right">Reserved</TableHead>
                  <TableHead className="text-right">Available</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.rows.map((row) => (
                  <TableRow key={`${row.locationId}-${row.variantId}`}>
                    <TableCell className="font-mono text-xs">{row.sku}</TableCell>
                    <TableCell className="font-mono text-xs">{row.parentSku}</TableCell>
                    <TableCell>{row.productName}</TableCell>
                    <TableCell>{row.locationName}</TableCell>
                    <TableCell className="text-right">{row.onHand}</TableCell>
                    <TableCell className="text-right">{row.reserved}</TableCell>
                    <TableCell className="text-right">{row.available}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(row.totalValue, "MYR")}</TableCell>
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

function Metric({ icon, label, value, note }: { icon: ReactNode; label: string; value: string; note: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 text-muted-foreground text-xs">{icon} {label}</div>
        <div className="text-2xl font-bold mt-1">{value}</div>
        <div className="text-xs text-muted-foreground">{note}</div>
      </CardContent>
    </Card>
  );
}

function BreakdownCard({ title, rows }: { title: string; rows: Array<{ key: string; label: string; value: string; note: string; pct: number }> }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No data.</p>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => (
              <div key={row.key}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium">{row.label}</span>
                  <span className="text-muted-foreground">{row.value} - {row.note}</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${row.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DataTable({ headers, rows }: { headers: string[]; rows: Array<Array<string | number>> }) {
  return (
    <div className="border rounded-lg overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>{headers.map((header) => <TableHead key={header}>{header}</TableHead>)}</TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={index}>
              {row.map((cell, cellIndex) => (
                <TableCell key={cellIndex}>{cellIndex === 6 ? <Badge variant={cell === "OUT" ? "destructive" : "warning"}>{cell}</Badge> : cell}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function getParam(params: Awaited<PageProps["searchParams"]>, key: string) {
  const value = params?.[key];
  return Array.isArray(value) ? value[0] : value;
}

function toQueryString(values: Record<string, string | null | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}
