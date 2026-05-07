import Link from "next/link";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, FileText, MapPin, User, Wallet } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { formatCurrency, formatDate } from "@/lib/utils";

const INVOICE_STATUS_COLOR: Record<string, "default" | "secondary" | "success" | "warning" | "destructive"> = {
  DRAFT: "secondary",
  ISSUED: "default",
  PARTIAL_PAID: "warning",
  PAID: "success",
  VOID: "destructive",
};

export default async function ConsignmentInvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const invoice = await prisma.consignmentInvoice.findUnique({
    where: { id },
    include: {
      partner: { select: { name: true } },
      shipment: { select: { id: true, shipmentNumber: true } },
      report: {
        include: {
          lines: {
            select: {
              id: true,
              quantityReturned: true,
              shipmentItem: {
                select: {
                  productVariant: {
                    select: {
                      sku: true,
                      product: { select: { name: true } },
                    },
                  },
                },
              },
            },
          },
        },
      },
      lines: { orderBy: { id: "asc" } },
      payments: {
        include: { createdBy: { select: { name: true, email: true } } },
        orderBy: [{ paymentDate: "desc" }, { createdAt: "desc" }],
      },
    },
  });

  if (!invoice) {
    notFound();
  }

  const paidAmount = invoice.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
  const balanceAmount = Math.max(0, Number(invoice.netAmount) - paidAmount);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/consignment/invoices">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-mono text-2xl font-bold tracking-tight">{invoice.invoiceNumber}</h2>
              <Badge variant={INVOICE_STATUS_COLOR[invoice.status]}>{invoice.status}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Invoice to collect consignment sales from {invoice.billToName}.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <Metric label="Gross Sales" value={formatCurrency(Number(invoice.grossAmount), "MYR")} />
        <Metric label="Commission" value={formatCurrency(Number(invoice.commissionAmount), "MYR")} />
        <Metric label="Net To Bentop" value={formatCurrency(Number(invoice.netAmount), "MYR")} />
        <Metric label="Paid" value={formatCurrency(paidAmount, "MYR")} />
        <Metric label="Outstanding" value={formatCurrency(balanceAmount, "MYR")} />
        <Metric label="Sold Units" value={invoice.lines.reduce((sum, line) => sum + line.quantitySold, 0).toLocaleString()} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Invoice Lines</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 text-left">SKU / Product</th>
                    <th className="px-4 py-2 text-right">Qty</th>
                    <th className="px-4 py-2 text-right">Selling Price</th>
                    <th className="px-4 py-2 text-right">Gross</th>
                    <th className="px-4 py-2 text-left">Group</th>
                    <th className="px-4 py-2 text-right">Commission</th>
                    <th className="px-4 py-2 text-right">Net</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {invoice.lines.map((line) => (
                    <tr key={line.id}>
                      <td className="px-4 py-2">
                        <div className="font-mono text-xs">{line.sku}</div>
                        <div className="text-xs text-muted-foreground">
                          {line.productName} / {line.color} {line.size}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-right">{line.quantitySold}</td>
                      <td className="px-4 py-2 text-right">
                        {formatCurrency(Number(line.actualUnitPrice), "MYR")}
                      </td>
                      <td className="px-4 py-2 text-right">{formatCurrency(Number(line.grossAmount), "MYR")}</td>
                      <td className="px-4 py-2">
                        <Badge variant="secondary">
                          {line.commissionTierName} {Number(line.commissionRate).toFixed(2)}%
                        </Badge>
                      </td>
                      <td className="px-4 py-2 text-right text-amber-700">
                        {formatCurrency(Number(line.commissionAmount), "MYR")}
                      </td>
                      <td className="px-4 py-2 text-right font-medium">
                        {formatCurrency(Number(line.netAmount), "MYR")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Bill To</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Detail icon={<User className="h-4 w-4" />} label="Partner" value={invoice.billToName} />
              {invoice.billToContact && (
                <Detail icon={<User className="h-4 w-4" />} label="Contact" value={invoice.billToContact} />
              )}
              {invoice.billToEmail && (
                <Detail icon={<FileText className="h-4 w-4" />} label="Email" value={invoice.billToEmail} />
              )}
              {invoice.billToPhone && (
                <Detail icon={<FileText className="h-4 w-4" />} label="Phone" value={invoice.billToPhone} />
              )}
              {formatAddress(invoice.billToAddress) && (
                <Detail icon={<MapPin className="h-4 w-4" />} label="Address" value={formatAddress(invoice.billToAddress)} />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Source Report</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Detail icon={<CalendarDays className="h-4 w-4" />} label="Invoice Date" value={formatDate(invoice.invoiceDate)} />
              {invoice.dueDate && (
                <Detail icon={<CalendarDays className="h-4 w-4" />} label="Due Date" value={formatDate(invoice.dueDate)} />
              )}
              <Detail
                icon={<FileText className="h-4 w-4" />}
                label="Report"
                value={`${invoice.report.reportNumber} (${formatDate(invoice.report.periodStart)} to ${formatDate(invoice.report.periodEnd)})`}
              />
              <Detail
                icon={<FileText className="h-4 w-4" />}
                label="Shipment"
                value={invoice.shipment.shipmentNumber}
                href={`/consignment/shipments/${invoice.shipment.id}`}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Payment History</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {invoice.payments.map((payment) => (
                <div key={payment.id} className="rounded-md border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium">{formatCurrency(Number(payment.amount), "MYR")}</div>
                    <Badge variant="secondary">{payment.paymentMethod}</Badge>
                  </div>
                  <Detail icon={<CalendarDays className="h-4 w-4" />} label="Date" value={formatDate(payment.paymentDate)} />
                  {payment.referenceNumber && (
                    <Detail icon={<FileText className="h-4 w-4" />} label="Reference" value={payment.referenceNumber} />
                  )}
                  <Detail
                    icon={<User className="h-4 w-4" />}
                    label="Recorded By"
                    value={payment.createdBy.name || payment.createdBy.email}
                  />
                </div>
              ))}
              {invoice.payments.length === 0 && (
                <Detail icon={<Wallet className="h-4 w-4" />} label="Payment" value="No payment recorded yet" />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

function Detail({
  icon,
  label,
  value,
  href,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  href?: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <div className="mt-0.5 text-muted-foreground">{icon}</div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        {href ? (
          <Link href={href} className="font-medium hover:underline">
            {value}
          </Link>
        ) : (
          <div className="font-medium">{value}</div>
        )}
      </div>
    </div>
  );
}

function formatAddress(address: unknown) {
  if (!address || typeof address !== "object" || Array.isArray(address)) {
    return "";
  }

  const data = address as Record<string, unknown>;
  return ["street", "city", "state", "postalCode", "country"]
    .map((key) => data[key])
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .join(", ");
}
