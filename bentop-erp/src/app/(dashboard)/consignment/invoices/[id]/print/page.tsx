import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { InvoicePrintActions } from "@/components/consignment/invoice-print-actions";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { buildConsignmentInvoiceDocument, formatDocumentDate } from "@/lib/consignment/invoice-document";
import { formatCurrency } from "@/lib/utils";

export default async function ConsignmentInvoicePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const invoice = await prisma.consignmentInvoice.findUnique({
    where: { id },
    include: {
      report: { select: { reportNumber: true, periodStart: true, periodEnd: true } },
      shipment: { select: { shipmentNumber: true } },
      lines: { orderBy: { id: "asc" } },
      payments: { select: { amount: true } },
    },
  });

  if (!invoice) {
    notFound();
  }

  const document = buildConsignmentInvoiceDocument(invoice);

  return (
    <div className="min-h-screen bg-muted/30 py-6 print:bg-white print:py-0">
      <div className="mx-auto max-w-5xl space-y-4 px-4 print:max-w-none print:px-0">
        <div className="flex items-center justify-between gap-3 print:hidden">
          <Button asChild variant="outline" size="sm">
            <Link href={`/consignment/invoices/${id}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
          <InvoicePrintActions />
        </div>

        <article className="bg-white p-8 shadow-sm print:p-0 print:shadow-none">
          <header className="flex items-start justify-between gap-8 border-b pb-6">
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Bentop ERP</div>
              <h1 className="mt-2 text-3xl font-bold tracking-tight">Consignment Invoice</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Invoice for consignment partner sales collection.
              </p>
            </div>
            <div className="text-right">
              <div className="font-mono text-2xl font-bold">{document.invoiceNumber}</div>
              <div className="mt-2 text-sm text-muted-foreground">Status: {document.status}</div>
            </div>
          </header>

          <section className="grid gap-8 py-6 md:grid-cols-2">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Bill To</h2>
              <div className="mt-3 space-y-1 text-sm">
                {document.billToLines.map((line) => (
                  <div key={line}>{line}</div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <DocumentField label="Invoice Date" value={formatDocumentDate(document.invoiceDate)} />
              <DocumentField label="Due Date" value={document.dueDate ? formatDocumentDate(document.dueDate) : "-"} />
              <DocumentField label="Report" value={document.reportNumber} />
              <DocumentField label="Report Period" value={document.reportPeriodLabel} />
              <DocumentField label="Shipment" value={document.shipmentNumber} />
              <DocumentField label="Sold Units" value={document.totalUnits.toLocaleString()} />
            </div>
          </section>

          <section className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-y bg-muted/40 text-xs uppercase text-muted-foreground">
                  <th className="px-3 py-2 text-left">SKU / Product</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                  <th className="px-3 py-2 text-right">Price</th>
                  <th className="px-3 py-2 text-right">Gross</th>
                  <th className="px-3 py-2 text-left">Commission Group</th>
                  <th className="px-3 py-2 text-right">Commission</th>
                  <th className="px-3 py-2 text-right">Net</th>
                </tr>
              </thead>
              <tbody>
                {document.lines.map((line) => (
                  <tr key={line.id} className="border-b">
                    <td className="px-3 py-3">
                      <div className="font-mono text-xs">{line.sku}</div>
                      <div className="text-xs text-muted-foreground">
                        {line.productName} / {line.color} {line.size}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right">{line.quantitySold}</td>
                    <td className="px-3 py-3 text-right">{formatCurrency(line.actualUnitPrice, "MYR")}</td>
                    <td className="px-3 py-3 text-right">{formatCurrency(line.grossAmount, "MYR")}</td>
                    <td className="px-3 py-3">
                      {line.commissionTierName} ({line.commissionRate.toFixed(2)}%)
                    </td>
                    <td className="px-3 py-3 text-right">{formatCurrency(line.commissionAmount, "MYR")}</td>
                    <td className="px-3 py-3 text-right font-medium">{formatCurrency(line.netAmount, "MYR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="ml-auto mt-6 w-full max-w-sm space-y-2 text-sm">
            <SummaryLine label="Gross Sales" value={formatCurrency(document.grossAmount, "MYR")} />
            <SummaryLine label="Partner Commission" value={formatCurrency(document.commissionAmount, "MYR")} />
            <SummaryLine label="Net To Bentop" value={formatCurrency(document.netAmount, "MYR")} strong />
            <SummaryLine label="Paid" value={formatCurrency(document.paidAmount, "MYR")} />
            <SummaryLine label="Outstanding" value={formatCurrency(document.outstandingAmount, "MYR")} strong />
          </section>

          <footer className="mt-10 border-t pt-4 text-xs text-muted-foreground">
            Generated from Bentop ERP using finalized consignment report and invoice line snapshots.
          </footer>
        </article>
      </div>
    </div>
  );
}

function DocumentField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

function SummaryLine({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-4 ${strong ? "border-t pt-2 font-semibold" : ""}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
