import Link from "next/link";
import { prisma } from "@/lib/db";
import {
  Boxes,
  Plus,
  Send,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Truck,
  XCircle,
  BarChart3,
  FileText,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/utils";

const STATUS_COLOR: Record<string, "default" | "secondary" | "success" | "warning" | "destructive"> = {
  DRAFT: "secondary",
  SHIPPED: "default",
  PARTIAL_SETTLED: "warning",
  SETTLED: "success",
  CANCELLED: "destructive",
};

export default async function ConsignmentPage() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    draftCount,
    activeCount,
    settledRecent,
    finalizedReportsRecent,
    issuedInvoicesRecent,
    unpaidInvoices,
    recent,
    consignmentStockLevels,
  ] = await Promise.all([
    prisma.consignmentShipment.count({ where: { status: "DRAFT" } }),
    prisma.consignmentShipment.count({
      where: { status: { in: ["SHIPPED", "PARTIAL_SETTLED"] } },
    }),
    prisma.consignmentShipment.count({
      where: { status: "SETTLED", settledAt: { gte: thirtyDaysAgo } },
    }),
    prisma.consignmentReport.findMany({
      where: { status: "FINALIZED", finalizedAt: { gte: thirtyDaysAgo } },
      select: {
        grossAmount: true,
        commissionAmount: true,
        netAmount: true,
        lines: { select: { quantitySold: true, quantityReturned: true } },
      },
    }),
    prisma.consignmentInvoice.findMany({
      where: { status: { in: ["ISSUED", "PAID"] }, invoiceDate: { gte: thirtyDaysAgo } },
      select: { netAmount: true },
    }),
    prisma.consignmentInvoice.findMany({
      where: { status: "ISSUED" },
      select: { netAmount: true },
    }),
    prisma.consignmentShipment.findMany({
      include: {
        toLocation: { select: { id: true, name: true } },
        items: {
          select: {
            quantityShipped: true,
            quantitySold: true,
            quantityReturned: true,
            unitPrice: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.stockLevel.findMany({
      where: {
        batchId: null,
        location: { type: "CONSIGNMENT", isActive: true },
      },
      select: { quantityOnHand: true },
    }),
  ]);

  const unitsOnConsignment = consignmentStockLevels.reduce(
    (sum, stockLevel) => sum + stockLevel.quantityOnHand,
    0,
  );
  const reportedUnitsSold = finalizedReportsRecent.reduce(
    (sum, report) => sum + report.lines.reduce((lineSum, line) => lineSum + line.quantitySold, 0),
    0,
  );
  const reportedUnitsReturned = finalizedReportsRecent.reduce(
    (sum, report) => sum + report.lines.reduce((lineSum, line) => lineSum + line.quantityReturned, 0),
    0,
  );
  const reportedNetRecent = finalizedReportsRecent.reduce(
    (sum, report) => sum + Number(report.netAmount),
    0,
  );
  const invoicedNetRecent = issuedInvoicesRecent.reduce(
    (sum, invoice) => sum + Number(invoice.netAmount),
    0,
  );
  const unpaidNet = unpaidInvoices.reduce((sum, invoice) => sum + Number(invoice.netAmount), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Consignment</h2>
          <p className="text-muted-foreground">
            Track stock placed with consignee partners and record sales and settlements.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/consignment/stock">
              <Boxes className="h-4 w-4 mr-2" />
              View Stock
            </Link>
          </Button>
          <Button asChild>
            <Link href="/consignment/shipments/new">
              <Plus className="h-4 w-4 mr-2" />
              New Shipment
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <Clock className="h-3.5 w-3.5" /> Drafts
            </div>
            <div className="text-2xl font-bold mt-1">{draftCount}</div>
            <div className="text-xs text-muted-foreground">Awaiting ship-out</div>
          </CardContent>
        </Card>
        <Card className="border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-blue-700 text-xs font-medium">
              <Truck className="h-3.5 w-3.5" /> Active
            </div>
            <div className="text-2xl font-bold mt-1 text-blue-700">{activeCount}</div>
            <div className="text-xs text-muted-foreground">Shipped / partial</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <Boxes className="h-3.5 w-3.5" /> Units on Consignment
            </div>
            <div className="text-2xl font-bold mt-1">{unitsOnConsignment.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">Current stock levels</div>
          </CardContent>
        </Card>
        <Card className="border-green-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-green-700 text-xs font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" /> Settled (30d)
            </div>
            <div className="text-2xl font-bold mt-1 text-green-700">{settledRecent}</div>
            <div className="text-xs text-muted-foreground">Finalised last month</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <BarChart3 className="h-3.5 w-3.5" /> Reported Sold (30d)
            </div>
            <div className="text-2xl font-bold mt-1">{reportedUnitsSold.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">
              {reportedUnitsReturned.toLocaleString()} returned
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <CheckCircle2 className="h-3.5 w-3.5" /> Reports (30d)
            </div>
            <div className="text-2xl font-bold mt-1">{finalizedReportsRecent.length}</div>
            <div className="text-xs text-muted-foreground">
              {formatCurrency(reportedNetRecent, "MYR")} net
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <FileText className="h-3.5 w-3.5" /> Invoiced (30d)
            </div>
            <div className="text-2xl font-bold mt-1">{formatCurrency(invoicedNetRecent, "MYR")}</div>
            <div className="text-xs text-muted-foreground">Net amount issued</div>
          </CardContent>
        </Card>
        <Card className="border-amber-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-amber-700 text-xs font-medium">
              <AlertTriangle className="h-3.5 w-3.5" /> To Collect
            </div>
            <div className="text-2xl font-bold mt-1 text-amber-700">
              {formatCurrency(unpaidNet, "MYR")}
            </div>
            <div className="text-xs text-muted-foreground">Issued invoices unpaid</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Recent Shipments</CardTitle>
            <CardDescription>Latest consignment activity</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">
              No consignment shipments yet. Start by creating one.
            </div>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Shipment</TableHead>
                    <TableHead>Partner</TableHead>
                    <TableHead>Consignee</TableHead>
                    <TableHead className="text-right">Items</TableHead>
                    <TableHead className="text-right">Sold</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recent.map((s) => {
                    const totalShipped = s.items.reduce((x, i) => x + i.quantityShipped, 0);
                    const totalSold = s.items.reduce((x, i) => x + i.quantitySold, 0);
                    const totalValue = s.items.reduce(
                      (x, i) => x + Number(i.unitPrice) * i.quantityShipped,
                      0
                    );
                    return (
                      <TableRow key={s.id} className="cursor-pointer">
                        <TableCell className="font-mono text-xs">
                          <Link href={`/consignment/shipments/${s.id}`} className="hover:underline">
                            {s.shipmentNumber}
                          </Link>
                        </TableCell>
                        <TableCell>{s.partnerName}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {s.toLocation.name}
                        </TableCell>
                        <TableCell className="text-right text-sm">{totalShipped}</TableCell>
                        <TableCell className="text-right text-sm">{totalSold}</TableCell>
                        <TableCell className="text-right text-sm">
                          {formatCurrency(totalValue, "MYR")}
                        </TableCell>
                        <TableCell>
                          <Badge variant={STATUS_COLOR[s.status]} className="text-xs">
                            {s.status.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDate(s.createdAt)}
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Workflow</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-secondary">
              <Clock className="h-3.5 w-3.5" /> DRAFT
            </span>
            →
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-100 text-blue-800">
              <Send className="h-3.5 w-3.5" /> SHIPPED
            </span>
            →
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-amber-100 text-amber-800">
              <Boxes className="h-3.5 w-3.5" /> PARTIAL SETTLED
            </span>
            →
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-green-100 text-green-800">
              <CheckCircle2 className="h-3.5 w-3.5" /> SETTLED
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-destructive/10 text-destructive ml-auto">
              <XCircle className="h-3.5 w-3.5" /> CANCELLED returns remainder
            </span>
          </div>
          <div className="mt-3 text-xs text-muted-foreground flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0 text-amber-600" />
            <span>
              Shipping moves stock from source to the consignee location. Recording sales deducts
              consignee stock. Settling returns any unsold units back to the source.
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
