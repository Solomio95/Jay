import type { ReactNode } from "react";
import { DollarSign, Download, Search, ShoppingCart, Store, TrendingDown, TrendingUp } from "lucide-react";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { getSalesReport } from "@/lib/reports/sales";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SalesReportsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = {
    days: numberParam(params, "days") ?? 30,
    from: getParam(params, "from"),
    to: getParam(params, "to"),
    locationId: getParam(params, "locationId"),
    productId: getParam(params, "productId"),
    productVariantId: getParam(params, "productVariantId"),
    search: getParam(params, "search"),
  };

  const [report, locations, products, variants] = await Promise.all([
    getSalesReport(filters),
    prisma.location.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.product.findMany({ where: { isActive: true }, select: { id: true, name: true, skuPrefix: true }, orderBy: { name: "asc" } }),
    prisma.productVariant.findMany({ where: { isActive: true }, select: { id: true, sku: true }, orderBy: { sku: "asc" }, take: 500 }),
  ]);
  const exportHref = `/api/v1/exports/reports/sales${toQueryString({
    ...filters,
    days: String(filters.days),
  })}`;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Sales Reports</h2>
          <p className="text-muted-foreground">
            Gross sales, discounts, returns, net revenue, and channel breakdown.
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
          <CardDescription>Filter sales by date range, location, parent SKU, sub SKU, or search text.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-4 lg:grid-cols-8">
            <Input name="from" type="date" defaultValue={filters.from ?? ""} />
            <Input name="to" type="date" defaultValue={filters.to ?? ""} />
            <Input name="days" type="number" min="1" defaultValue={String(filters.days)} placeholder="Days" />
            <select name="locationId" defaultValue={filters.locationId ?? ""} className="h-10 rounded-md border bg-background px-3 text-sm">
              <option value="">All locations</option>
              {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
            </select>
            <select name="productId" defaultValue={filters.productId ?? ""} className="h-10 rounded-md border bg-background px-3 text-sm">
              <option value="">All parent SKUs</option>
              {products.map((product) => <option key={product.id} value={product.id}>{product.skuPrefix} - {product.name}</option>)}
            </select>
            <select name="productVariantId" defaultValue={filters.productVariantId ?? ""} className="h-10 rounded-md border bg-background px-3 text-sm">
              <option value="">All sub SKUs</option>
              {variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.sku}</option>)}
            </select>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input name="search" defaultValue={filters.search ?? ""} placeholder="Search SKU or product" className="pl-9" />
            </div>
            <Button type="submit">Apply</Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Metric icon={<DollarSign className="h-3.5 w-3.5" />} label="Gross" value={formatCurrency(report.summary.totalRevenueMyr, "MYR")} note="before returns" />
        <Metric icon={<TrendingDown className="h-3.5 w-3.5" />} label="Returns" value={formatCurrency(report.summary.totalReturnsMyr, "MYR")} note="returned value" />
        <Metric icon={<TrendingUp className="h-3.5 w-3.5" />} label="Net" value={formatCurrency(report.summary.netRevenueMyr, "MYR")} note="after returns" />
        <Metric icon={<ShoppingCart className="h-3.5 w-3.5" />} label="Orders" value={report.summary.totalOrders.toLocaleString()} note={`${report.summary.totalUnits} units`} />
        <Metric icon={<DollarSign className="h-3.5 w-3.5" />} label="Profit" value={formatCurrency(report.summary.grossProfit, "MYR")} note={`${report.summary.grossMarginPct.toFixed(1)}% margin`} />
        <Metric icon={<Store className="h-3.5 w-3.5" />} label="Discount" value={formatCurrency(report.summary.totalDiscountMyr, "MYR")} note="total discount" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sales by Location</CardTitle>
        </CardHeader>
        <CardContent>
          <ReportTable
            headers={["Location", "Gross", "Returns", "Net", "Orders", "Units"]}
            rows={report.byLocation.map((row) => [
              row.name,
              formatCurrency(row.revenue, "MYR"),
              formatCurrency(row.returns, "MYR"),
              formatCurrency(row.net, "MYR"),
              row.orders,
              row.units,
            ])}
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Sales by Channel</CardTitle></CardHeader>
          <CardContent>
            <ReportTable
              headers={["Channel", "Type", "Gross", "Returns", "Net", "Orders"]}
              rows={report.byChannel.map((row) => [
                row.name,
                row.type,
                formatCurrency(row.revenue, "MYR"),
                formatCurrency(row.returns, "MYR"),
                formatCurrency(row.net, "MYR"),
                row.orders,
              ])}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Top Customers</CardTitle></CardHeader>
          <CardContent>
            <ReportTable
              headers={["Customer", "Revenue", "Orders"]}
              rows={report.topCustomers.map((row) => [row.name, formatCurrency(row.revenue, "MYR"), row.orders])}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Product Performance</CardTitle>
          <CardDescription>Top products by revenue for the current filters.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Units</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Discount</TableHead>
                  <TableHead className="text-right">COGS</TableHead>
                  <TableHead className="text-right">Margin</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.byProduct.map((row) => (
                  <TableRow key={row.name}>
                    <TableCell>{row.name}</TableCell>
                    <TableCell className="text-right">{row.units}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.revenue, "MYR")}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.discount, "MYR")}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.cost, "MYR")}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={row.margin >= 30 ? "success" : row.margin >= 15 ? "warning" : "destructive"}>{row.margin.toFixed(1)}%</Badge>
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

function ReportTable({ headers, rows }: { headers: string[]; rows: Array<Array<string | number>> }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-4">No data.</p>;
  }

  return (
    <div className="border rounded-lg overflow-x-auto">
      <Table>
        <TableHeader><TableRow>{headers.map((header) => <TableHead key={header}>{header}</TableHead>)}</TableRow></TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={index}>{row.map((cell, cellIndex) => <TableCell key={cellIndex}>{cell}</TableCell>)}</TableRow>
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

function numberParam(params: Awaited<PageProps["searchParams"]>, key: string) {
  const value = getParam(params, key);
  if (!value) return undefined;
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toQueryString(values: Record<string, string | number | null | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}
