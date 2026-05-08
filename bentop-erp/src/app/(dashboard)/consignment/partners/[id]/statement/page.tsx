import Link from "next/link";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, Receipt, Wallet } from "lucide-react";

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
import {
  buildPartnerStatementSummary,
  calculateInvoiceOutstandingAmount,
  calculateInvoicePaidAmount,
} from "@/lib/consignment/partner-statement";
import { formatCurrency, formatDate } from "@/lib/utils";

const INVOICE_STATUS_COLOR: Record<string, "default" | "secondary" | "success" | "warning" | "destructive"> = {
  DRAFT: "secondary",
  ISSUED: "default",
  PARTIAL_PAID: "warning",
  PAID: "success",
  VOID: "destructive",
};

export default async function ConsignmentPartnerStatementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const partner = await prisma.consignmentPartner.findUnique({
    where: { id },
    include: {
      location: { select: { name: true } },
      invoices: {
        include: {
          report: { select: { reportNumber: true, periodStart: true, periodEnd: true } },
          shipment: { select: { id: true, shipmentNumber: true } },
          payments: { orderBy: [{ paymentDate: "desc" }, { createdAt: "desc" }] },
        },
        orderBy: [{ invoiceDate: "desc" }, { createdAt: "desc" }],
      },
    },
  });

  if (!partner) {
    notFound();
  }

  const summary = buildPartnerStatementSummary(partner.invoices);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/consignment/partners">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{partner.name} Statement</h2>
          <p className="text-muted-foreground">
            Invoice collection status for {partner.location?.name ?? "this consignment partner"}.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <Metric icon={<Receipt className="h-3.5 w-3.5" />} label="Invoices" value={summary.invoiceCount.toLocaleString()} />
        <Metric icon={<Wallet className="h-3.5 w-3.5" />} label="Gross" value={formatCurrency(summary.grossAmount, "MYR")} />
        <Metric icon={<Wallet className="h-3.5 w-3.5" />} label="Commission" value={formatCurrency(summary.commissionAmount, "MYR")} />
        <Metric icon={<Wallet className="h-3.5 w-3.5" />} label="Net" value={formatCurrency(summary.netAmount, "MYR")} />
        <Metric icon={<Wallet className="h-3.5 w-3.5" />} label="Outstanding" value={formatCurrency(summary.outstandingAmount, "MYR")} />
        <Metric icon={<CalendarDays className="h-3.5 w-3.5" />} label="Overdue" value={summary.overdueCount.toLocaleString()} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invoice Statement</CardTitle>
          <CardDescription>Invoice, report, payment, and balance details for this partner.</CardDescription>
        </CardHeader>
        <CardContent>
          {partner.invoices.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No invoices have been issued for this partner yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Report Period</TableHead>
                    <TableHead>Shipment</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {partner.invoices.map((invoice) => {
                    const paidAmount = calculateInvoicePaidAmount(invoice);
                    const outstandingAmount = calculateInvoiceOutstandingAmount(invoice);

                    return (
                      <TableRow key={invoice.id}>
                        <TableCell>
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/consignment/invoices/${invoice.id}`}>{invoice.invoiceNumber}</Link>
                          </Button>
                        </TableCell>
                        <TableCell className="text-xs">{formatDate(invoice.invoiceDate)}</TableCell>
                        <TableCell className="text-xs">
                          {formatDate(invoice.report.periodStart)} to {formatDate(invoice.report.periodEnd)}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          <Link href={`/consignment/shipments/${invoice.shipment.id}`} className="hover:underline">
                            {invoice.shipment.shipmentNumber}
                          </Link>
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(Number(invoice.netAmount), "MYR")}</TableCell>
                        <TableCell className="text-right text-emerald-700">{formatCurrency(paidAmount, "MYR")}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(outstandingAmount, "MYR")}</TableCell>
                        <TableCell className="text-xs">{invoice.dueDate ? formatDate(invoice.dueDate) : "-"}</TableCell>
                        <TableCell>
                          <Badge variant={INVOICE_STATUS_COLOR[invoice.status]}>{invoice.status}</Badge>
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
