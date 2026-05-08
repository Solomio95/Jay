import type { ReactNode } from "react";
import Link from "next/link";
import { BarChart3, CalendarDays, Download, Receipt, RotateCcw, Wallet } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
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
import { formatCurrency, formatDate } from "@/lib/utils";
import { getConsignmentReport } from "@/lib/reports/consignment";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const REPORT_STATUS_COLOR: Record<string, "default" | "secondary" | "success" | "warning" | "destructive"> = {
  DRAFT: "secondary",
  FINALIZED: "success",
  CANCELLED: "destructive",
};

export default async function ConsignmentReportsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = {
    days: numberParam(params, "days") ?? 90,
    from: getParam(params, "from"),
    to: getParam(params, "to"),
    partnerId: getParam(params, "partnerId"),
    locationId: getParam(params, "locationId"),
    productId: getParam(params, "productId"),
    productVariantId: getParam(params, "productVariantId"),
  };
  const recentReportWhere = toConsignmentReportWhere(filters);

  const [report, partners, locations, products, variants, recentReports] = await Promise.all([
    getConsignmentReport(filters),
    prisma.consignmentPartner.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.location.findMany({ where: { isActive: true, type: "CONSIGNMENT" }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.product.findMany({ where: { isActive: true }, select: { id: true, name: true, skuPrefix: true }, orderBy: { name: "asc" } }),
    prisma.productVariant.findMany({ where: { isActive: true }, select: { id: true, sku: true }, orderBy: { sku: "asc" }, take: 500 }),
    prisma.consignmentReport.findMany({
      where: recentReportWhere,
      include: {
        partner: { select: { name: true } },
        shipment: { select: { id: true, shipmentNumber: true } },
        lines: {
          select: {
            quantitySold: true,
            quantityReturned: true,
          },
        },
        invoices: {
          select: {
            id: true,
            invoiceNumber: true,
            status: true,
          },
        },
      },
      orderBy: [{ periodEnd: "desc" }, { createdAt: "desc" }],
      take: 100,
    }),
  ]);
  const exportHref = `/api/v1/exports/reports/consignment${toQueryString({ ...filters, days: String(filters.days) })}`;
  const recentReportTotals = recentReports.reduce(
    (sum, consignmentReport) => {
      const sold = consignmentReport.lines.reduce((lineSum, line) => lineSum + line.quantitySold, 0);
      const returned = consignmentReport.lines.reduce((lineSum, line) => lineSum + line.quantityReturned, 0);
      return {
        reports: sum.reports + 1,
        sold: sum.sold + sold,
        returned: sum.returned + returned,
      };
    },
    { reports: 0, sold: 0, returned: 0 },
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Sales And Return Reports</h2>
          <p className="text-muted-foreground">Consignment sell-through, returns, commission, invoice payable, and outstanding payment.</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <a href={exportHref}><Download className="mr-2 h-4 w-4" />Report CSV</a>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
          <CardDescription>Filter by report period, partner, location, parent SKU, or sub SKU.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-4 lg:grid-cols-8">
            <Input name="from" type="date" defaultValue={filters.from ?? ""} />
            <Input name="to" type="date" defaultValue={filters.to ?? ""} />
            <Input name="days" type="number" min="1" defaultValue={String(filters.days)} />
            <select name="partnerId" defaultValue={filters.partnerId ?? ""} className="h-10 rounded-md border bg-background px-3 text-sm">
              <option value="">All partners</option>
              {partners.map((partner) => <option key={partner.id} value={partner.id}>{partner.name}</option>)}
            </select>
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
            <Button type="submit">Apply</Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Metric icon={<Receipt className="h-3.5 w-3.5" />} label="Gross" value={formatCurrency(report.summary.totalRevenueGross, "MYR")} />
        <Metric icon={<Wallet className="h-3.5 w-3.5" />} label="Commission" value={formatCurrency(report.summary.totalCommission, "MYR")} />
        <Metric icon={<Wallet className="h-3.5 w-3.5" />} label="Net Payable" value={formatCurrency(report.summary.netRevenue, "MYR")} />
        <Metric icon={<Receipt className="h-3.5 w-3.5" />} label="Outstanding" value={formatCurrency(report.summary.outstandingAmount, "MYR")} />
        <Metric icon={<RotateCcw className="h-3.5 w-3.5" />} label="Returned" value={report.summary.totalReturned.toLocaleString()} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">By Partner</CardTitle></CardHeader>
        <CardContent>
          <ReportTable
            headers={["Partner", "Location", "Shipped", "Sold", "Returned", "Gross", "Commission", "Net", "Outstanding"]}
            rows={report.byPartner.map((row) => [
              row.partnerName,
              row.locationName,
              row.unitsShipped,
              row.unitsSold,
              row.unitsReturned,
              formatCurrency(row.revenueGross, "MYR"),
              formatCurrency(row.commissionTotal, "MYR"),
              formatCurrency(row.netRevenue, "MYR"),
              formatCurrency(row.outstandingAmount, "MYR"),
            ])}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">By Product</CardTitle></CardHeader>
        <CardContent>
          <ReportTable
            headers={["Product", "SKU", "Shipped", "Sold", "Returned", "Gross", "Net"]}
            rows={report.byProduct.map((row) => [
              row.name,
              row.sku,
              row.shipped,
              row.sold,
              row.returned,
              formatCurrency(row.gross, "MYR"),
              formatCurrency(row.net, "MYR"),
            ])}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dated Report Register</CardTitle>
          <CardDescription>Invoice-ready sales and return reports recorded by partner and period.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <InlineStat icon={<CalendarDays className="h-3.5 w-3.5" />} label="Reports" value={recentReportTotals.reports.toLocaleString()} />
            <InlineStat icon={<BarChart3 className="h-3.5 w-3.5" />} label="Sold Units" value={recentReportTotals.sold.toLocaleString()} />
            <InlineStat icon={<RotateCcw className="h-3.5 w-3.5" />} label="Returned" value={recentReportTotals.returned.toLocaleString()} />
          </div>
          {recentReports.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No dated reports match these filters.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Report</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Partner</TableHead>
                    <TableHead>Shipment</TableHead>
                    <TableHead className="text-right">Sold</TableHead>
                    <TableHead className="text-right">Returned</TableHead>
                    <TableHead className="text-right">Gross</TableHead>
                    <TableHead className="text-right">Commission</TableHead>
                    <TableHead className="text-right">Net Invoice</TableHead>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentReports.map((consignmentReport) => {
                    const sold = consignmentReport.lines.reduce((sum, line) => sum + line.quantitySold, 0);
                    const returned = consignmentReport.lines.reduce((sum, line) => sum + line.quantityReturned, 0);
                    const invoice = consignmentReport.invoices[0];

                    return (
                      <TableRow key={consignmentReport.id}>
                        <TableCell className="font-mono text-xs">{consignmentReport.reportNumber}</TableCell>
                        <TableCell className="text-xs">
                          {formatDate(consignmentReport.periodStart)} to {formatDate(consignmentReport.periodEnd)}
                        </TableCell>
                        <TableCell>{consignmentReport.partner.name}</TableCell>
                        <TableCell className="font-mono text-xs">
                          <Link href={`/consignment/shipments/${consignmentReport.shipment.id}`} className="hover:underline">
                            {consignmentReport.shipment.shipmentNumber}
                          </Link>
                        </TableCell>
                        <TableCell className="text-right">{sold}</TableCell>
                        <TableCell className="text-right">{returned}</TableCell>
                        <TableCell className="text-right">{formatCurrency(Number(consignmentReport.grossAmount), "MYR")}</TableCell>
                        <TableCell className="text-right text-amber-700">
                          {formatCurrency(Number(consignmentReport.commissionAmount), "MYR")}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(Number(consignmentReport.netAmount), "MYR")}
                        </TableCell>
                        <TableCell>
                          {invoice ? (
                            <Button asChild size="sm" variant="outline">
                              <Link href={`/consignment/invoices/${invoice.id}`}>{invoice.invoiceNumber}</Link>
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">Not issued</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={REPORT_STATUS_COLOR[consignmentReport.status]}>{consignmentReport.status}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 text-muted-foreground text-xs">{icon} {label}</div>
        <div className="text-2xl font-bold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}

function InlineStat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-md border px-3 py-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon} {label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
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

function toConsignmentReportWhere(filters: {
  from?: string;
  to?: string;
  partnerId?: string;
  locationId?: string;
  productId?: string;
  productVariantId?: string;
}): Prisma.ConsignmentReportWhereInput {
  const from = filters.from ? startOfDay(filters.from) : undefined;
  const to = filters.to ? endOfDay(filters.to) : undefined;
  const lineFilter = filters.productVariantId
    ? { shipmentItem: { productVariantId: filters.productVariantId } }
    : filters.productId
      ? { shipmentItem: { productVariant: { productId: filters.productId } } }
      : undefined;

  return {
    ...(filters.partnerId ? { partnerId: filters.partnerId } : {}),
    ...(filters.locationId ? { shipment: { toLocationId: filters.locationId } } : {}),
    ...(from ? { periodEnd: { gte: from } } : {}),
    ...(to ? { periodStart: { lte: to } } : {}),
    ...(lineFilter ? { lines: { some: lineFilter } } : {}),
  };
}

function startOfDay(value: string) {
  return new Date(`${value}T00:00:00.000`);
}

function endOfDay(value: string) {
  return new Date(`${value}T23:59:59.999`);
}

function toQueryString(values: Record<string, string | number | null | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}
