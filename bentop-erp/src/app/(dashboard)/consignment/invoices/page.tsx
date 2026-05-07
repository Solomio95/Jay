import Link from "next/link";
import type { ReactNode } from "react";
import { CalendarDays, Download, Printer, Receipt, Wallet } from "lucide-react";

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

const INVOICE_STATUS_COLOR: Record<string, "default" | "secondary" | "success" | "warning" | "destructive"> = {
  DRAFT: "secondary",
  ISSUED: "default",
  PARTIAL_PAID: "warning",
  PAID: "success",
  VOID: "destructive",
};

export default async function ConsignmentInvoicesPage() {
  const invoices = await prisma.consignmentInvoice.findMany({
    include: {
      partner: { select: { name: true } },
      shipment: { select: { id: true, shipmentNumber: true } },
      report: { select: { reportNumber: true, periodStart: true, periodEnd: true } },
      payments: { select: { amount: true } },
    },
    orderBy: [{ invoiceDate: "desc" }, { createdAt: "desc" }],
    take: 100,
  });

  const totals = invoices.reduce(
    (sum, invoice) => ({
      invoices: sum.invoices + 1,
      grossAmount: sum.grossAmount + Number(invoice.grossAmount),
      commissionAmount: sum.commissionAmount + Number(invoice.commissionAmount),
      netAmount: sum.netAmount + Number(invoice.netAmount),
      paidAmount: sum.paidAmount + invoice.payments.reduce((paid, payment) => paid + Number(payment.amount), 0),
    }),
    { invoices: 0, grossAmount: 0, commissionAmount: 0, netAmount: 0, paidAmount: 0 },
  );
  const outstandingAmount = Math.max(0, totals.netAmount - totals.paidAmount);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Consignment Invoices</h2>
          <p className="text-muted-foreground">
            Invoices raised to collect net sales from consignment partners.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <a href="/api/v1/exports/consignment-invoices">
              <Download className="mr-2 h-4 w-4" />
              Invoices CSV
            </a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href="/api/v1/exports/payments">
              <Download className="mr-2 h-4 w-4" />
              Payments CSV
            </a>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Metric icon={<Receipt className="h-3.5 w-3.5" />} label="Invoices" value={totals.invoices.toLocaleString()} />
        <Metric icon={<CalendarDays className="h-3.5 w-3.5" />} label="Gross Sales" value={formatCurrency(totals.grossAmount, "MYR")} />
        <Metric icon={<Wallet className="h-3.5 w-3.5" />} label="Commission" value={formatCurrency(totals.commissionAmount, "MYR")} />
        <Metric icon={<Wallet className="h-3.5 w-3.5" />} label="Net To Bentop" value={formatCurrency(totals.netAmount, "MYR")} />
        <Metric icon={<Wallet className="h-3.5 w-3.5" />} label="Outstanding" value={formatCurrency(outstandingAmount, "MYR")} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invoice Register</CardTitle>
          <CardDescription>Latest invoices by report date and partner.</CardDescription>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No consignment invoices yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Partner</TableHead>
                    <TableHead>Report Period</TableHead>
                    <TableHead>Shipment</TableHead>
                    <TableHead className="text-right">Gross</TableHead>
                    <TableHead className="text-right">Commission</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Print</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => {
                    const paidAmount = invoice.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
                    const balanceAmount = Math.max(0, Number(invoice.netAmount) - paidAmount);

                    return (
                      <TableRow key={invoice.id}>
                        <TableCell>
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/consignment/invoices/${invoice.id}`}>{invoice.invoiceNumber}</Link>
                          </Button>
                        </TableCell>
                        <TableCell className="text-xs">{formatDate(invoice.invoiceDate)}</TableCell>
                        <TableCell>{invoice.partner.name}</TableCell>
                        <TableCell className="text-xs">
                          {formatDate(invoice.report.periodStart)} to {formatDate(invoice.report.periodEnd)}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          <Link href={`/consignment/shipments/${invoice.shipment.id}`} className="hover:underline">
                            {invoice.shipment.shipmentNumber}
                          </Link>
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(Number(invoice.grossAmount), "MYR")}</TableCell>
                        <TableCell className="text-right text-amber-700">
                          {formatCurrency(Number(invoice.commissionAmount), "MYR")}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(Number(invoice.netAmount), "MYR")}
                        </TableCell>
                        <TableCell className="text-right text-emerald-700">
                          {formatCurrency(paidAmount, "MYR")}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(balanceAmount, "MYR")}
                        </TableCell>
                        <TableCell className="text-xs">
                          {invoice.dueDate ? formatDate(invoice.dueDate) : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={INVOICE_STATUS_COLOR[invoice.status]}>{invoice.status}</Badge>
                        </TableCell>
                        <TableCell>
                          <Button asChild size="sm" variant="ghost">
                            <Link href={`/consignment/invoices/${invoice.id}/print`}>
                              <Printer className="h-4 w-4" />
                              <span className="sr-only">Print {invoice.invoiceNumber}</span>
                            </Link>
                          </Button>
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
