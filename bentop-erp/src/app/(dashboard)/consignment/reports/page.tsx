import Link from "next/link";
import type { ReactNode } from "react";
import { BarChart3, CalendarDays, Receipt, RotateCcw, Wallet } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { prisma } from "@/lib/db";
import { formatCurrency, formatDate } from "@/lib/utils";

const REPORT_STATUS_COLOR: Record<string, "default" | "secondary" | "success" | "warning" | "destructive"> = {
  DRAFT: "secondary",
  FINALIZED: "success",
  CANCELLED: "destructive",
};

export default async function ConsignmentReportsPage() {
  const reports = await prisma.consignmentReport.findMany({
    include: {
      partner: { select: { name: true } },
      shipment: { select: { id: true, shipmentNumber: true } },
      lines: {
        select: {
          quantitySold: true,
          quantityReturned: true,
          grossAmount: true,
          commissionAmount: true,
          netAmount: true,
        },
      },
      invoices: {
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          netAmount: true,
        },
      },
    },
    orderBy: [{ periodEnd: "desc" }, { createdAt: "desc" }],
    take: 100,
  });

  const totals = reports.reduce(
    (sum, report) => {
      const reportSold = report.lines.reduce((lineSum, line) => lineSum + line.quantitySold, 0);
      const reportReturned = report.lines.reduce((lineSum, line) => lineSum + line.quantityReturned, 0);
      return {
        reports: sum.reports + 1,
        sold: sum.sold + reportSold,
        returned: sum.returned + reportReturned,
        grossAmount: sum.grossAmount + Number(report.grossAmount),
        commissionAmount: sum.commissionAmount + Number(report.commissionAmount),
        netAmount: sum.netAmount + Number(report.netAmount),
      };
    },
    { reports: 0, sold: 0, returned: 0, grossAmount: 0, commissionAmount: 0, netAmount: 0 },
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Sales And Return Reports</h2>
        <p className="text-muted-foreground">
          Dated partner reports used to create consignment invoices.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Metric icon={<CalendarDays className="h-3.5 w-3.5" />} label="Reports" value={totals.reports.toLocaleString()} />
        <Metric icon={<BarChart3 className="h-3.5 w-3.5" />} label="Sold Units" value={totals.sold.toLocaleString()} />
        <Metric icon={<RotateCcw className="h-3.5 w-3.5" />} label="Returned" value={totals.returned.toLocaleString()} />
        <Metric icon={<Receipt className="h-3.5 w-3.5" />} label="Gross Sales" value={formatCurrency(totals.grossAmount, "MYR")} />
        <Metric icon={<Wallet className="h-3.5 w-3.5" />} label="Net To Bentop" value={formatCurrency(totals.netAmount, "MYR")} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Report Register</CardTitle>
          <CardDescription>Latest dated sales and return reports by partner.</CardDescription>
        </CardHeader>
        <CardContent>
          {reports.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No reports have been recorded yet.</p>
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
                  {reports.map((report) => {
                    const sold = report.lines.reduce((sum, line) => sum + line.quantitySold, 0);
                    const returned = report.lines.reduce((sum, line) => sum + line.quantityReturned, 0);
                    const invoice = report.invoices[0];

                    return (
                      <TableRow key={report.id}>
                        <TableCell className="font-mono text-xs">{report.reportNumber}</TableCell>
                        <TableCell className="text-xs">
                          {formatDate(report.periodStart)} to {formatDate(report.periodEnd)}
                        </TableCell>
                        <TableCell>{report.partner.name}</TableCell>
                        <TableCell className="font-mono text-xs">
                          <Link href={`/consignment/shipments/${report.shipment.id}`} className="hover:underline">
                            {report.shipment.shipmentNumber}
                          </Link>
                        </TableCell>
                        <TableCell className="text-right">{sold}</TableCell>
                        <TableCell className="text-right">{returned}</TableCell>
                        <TableCell className="text-right">{formatCurrency(Number(report.grossAmount), "MYR")}</TableCell>
                        <TableCell className="text-right text-amber-700">
                          {formatCurrency(Number(report.commissionAmount), "MYR")}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(Number(report.netAmount), "MYR")}
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
                          <Badge variant={REPORT_STATUS_COLOR[report.status]}>{report.status}</Badge>
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

function Metric({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
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
