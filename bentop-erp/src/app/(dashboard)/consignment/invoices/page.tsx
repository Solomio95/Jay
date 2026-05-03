import Link from "next/link";
import type { ReactNode } from "react";
import { CalendarDays, Receipt, Wallet } from "lucide-react";

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
  PAID: "success",
  VOID: "destructive",
};

export default async function ConsignmentInvoicesPage() {
  const invoices = await prisma.consignmentInvoice.findMany({
    include: {
      partner: { select: { name: true } },
      shipment: { select: { id: true, shipmentNumber: true } },
      report: { select: { reportNumber: true, periodStart: true, periodEnd: true } },
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
    }),
    { invoices: 0, grossAmount: 0, commissionAmount: 0, netAmount: 0 },
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Consignment Invoices</h2>
        <p className="text-muted-foreground">
          Invoices raised to collect net sales from consignment partners.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric icon={<Receipt className="h-3.5 w-3.5" />} label="Invoices" value={totals.invoices.toLocaleString()} />
        <Metric icon={<CalendarDays className="h-3.5 w-3.5" />} label="Gross Sales" value={formatCurrency(totals.grossAmount, "MYR")} />
        <Metric icon={<Wallet className="h-3.5 w-3.5" />} label="Commission" value={formatCurrency(totals.commissionAmount, "MYR")} />
        <Metric icon={<Wallet className="h-3.5 w-3.5" />} label="Net To Bentop" value={formatCurrency(totals.netAmount, "MYR")} />
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
                    <TableHead>Due</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => (
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
                      <TableCell className="text-xs">
                        {invoice.dueDate ? formatDate(invoice.dueDate) : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={INVOICE_STATUS_COLOR[invoice.status]}>{invoice.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
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
