import Link from "next/link";
import type { ReactNode } from "react";
import { AlertTriangle, CalendarDays, MessageSquare, Receipt, Wallet } from "lucide-react";

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
import { CollectionFollowUpForm } from "@/components/consignment/collection-follow-up-form";
import { prisma } from "@/lib/db";
import {
  agingBucketLabel,
  collectionStatusLabel,
  summarizeCollectionInvoice,
  type CollectionAgingBucket,
  type CollectionStatus,
} from "@/lib/consignment/collections";
import { formatCurrency, formatDate } from "@/lib/utils";

const AGING_VARIANT: Record<CollectionAgingBucket, "default" | "secondary" | "success" | "warning" | "destructive"> = {
  NOT_DUE: "secondary",
  OVERDUE_1_7: "warning",
  OVERDUE_8_30: "warning",
  OVERDUE_31_60: "destructive",
  OVERDUE_60_PLUS: "destructive",
  PAID: "success",
};

const STATUS_VARIANT: Record<CollectionStatus, "default" | "secondary" | "success" | "warning" | "destructive"> = {
  NOT_FOLLOWED_UP: "secondary",
  CONTACTED: "default",
  PROMISED_PAYMENT: "success",
  DISPUTED: "warning",
  ESCALATED: "destructive",
};

export default async function ConsignmentCollectionsPage() {
  const invoices = await prisma.consignmentInvoice.findMany({
    where: { status: { in: ["ISSUED", "PARTIAL_PAID"] } },
    include: {
      partner: { select: { id: true, name: true } },
      shipment: { select: { id: true, shipmentNumber: true } },
      report: { select: { reportNumber: true, periodStart: true, periodEnd: true } },
      payments: { select: { amount: true } },
      followUps: {
        include: { createdBy: { select: { name: true, email: true } } },
        orderBy: { createdAt: "desc" },
        take: 3,
      },
    },
    orderBy: [{ dueDate: "asc" }, { invoiceDate: "desc" }],
    take: 100,
  });

  const rows = invoices
    .map((invoice) => ({ invoice, collection: summarizeCollectionInvoice(invoice) }))
    .filter((row) => row.collection.outstandingAmount > 0)
    .sort((a, b) => b.collection.outstandingAmount - a.collection.outstandingAmount);
  const totals = rows.reduce(
    (sum, row) => ({
      invoices: sum.invoices + 1,
      outstanding: sum.outstanding + row.collection.outstandingAmount,
      overdue: sum.overdue + (row.collection.agingBucket !== "NOT_DUE" ? 1 : 0),
      followUpsDue:
        sum.followUpsDue +
        (row.collection.nextFollowUpDate && row.collection.nextFollowUpDate <= new Date() ? 1 : 0),
    }),
    { invoices: 0, outstanding: 0, overdue: 0, followUpsDue: 0 },
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Consignment Collections</h2>
        <p className="text-muted-foreground">Outstanding partner invoices, aging, and follow-up notes.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric icon={<Receipt className="h-3.5 w-3.5" />} label="Open Invoices" value={totals.invoices.toLocaleString()} />
        <Metric icon={<Wallet className="h-3.5 w-3.5" />} label="Outstanding" value={formatCurrency(totals.outstanding, "MYR")} />
        <Metric icon={<AlertTriangle className="h-3.5 w-3.5" />} label="Overdue" value={totals.overdue.toLocaleString()} />
        <Metric icon={<CalendarDays className="h-3.5 w-3.5" />} label="Follow Ups Due" value={totals.followUpsDue.toLocaleString()} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Collection Worklist</CardTitle>
          <CardDescription>Record contact notes and next follow-up dates for partner invoices.</CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No outstanding consignment invoices.</p>
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Partner</TableHead>
                      <TableHead>Report Period</TableHead>
                      <TableHead className="text-right">Outstanding</TableHead>
                      <TableHead>Due</TableHead>
                      <TableHead>Aging</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Next Follow-Up</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map(({ invoice, collection }) => (
                      <TableRow key={invoice.id}>
                        <TableCell>
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/consignment/invoices/${invoice.id}`}>{invoice.invoiceNumber}</Link>
                          </Button>
                          <div className="mt-1 font-mono text-xs text-muted-foreground">{invoice.shipment.shipmentNumber}</div>
                        </TableCell>
                        <TableCell>
                          <Link href={`/consignment/partners/${invoice.partner.id}/statement`} className="font-medium hover:underline">
                            {invoice.partner.name}
                          </Link>
                        </TableCell>
                        <TableCell className="text-xs">
                          {formatDate(invoice.report.periodStart)} to {formatDate(invoice.report.periodEnd)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(collection.outstandingAmount, "MYR")}
                        </TableCell>
                        <TableCell className="text-xs">{invoice.dueDate ? formatDate(invoice.dueDate) : "-"}</TableCell>
                        <TableCell>
                          <Badge variant={AGING_VARIANT[collection.agingBucket]}>{agingBucketLabel(collection.agingBucket)}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={STATUS_VARIANT[collection.collectionStatus]}>{collectionStatusLabel(collection.collectionStatus)}</Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {collection.nextFollowUpDate ? formatDate(collection.nextFollowUpDate) : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="space-y-3">
                {rows.map(({ invoice, collection }) => (
                  <div key={invoice.id} className="rounded-lg border p-3">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="font-medium">{invoice.invoiceNumber} - {invoice.partner.name}</div>
                        <div className="text-xs text-muted-foreground">
                          Last note: {collection.lastFollowUpNote ?? "No follow-up yet"}
                        </div>
                      </div>
                      <Badge variant={AGING_VARIANT[collection.agingBucket]}>{agingBucketLabel(collection.agingBucket)}</Badge>
                    </div>
                    <CollectionFollowUpForm invoiceId={invoice.id} defaultStatus={collection.collectionStatus} />
                    {invoice.followUps.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {invoice.followUps.map((followUp) => (
                          <div key={followUp.id} className="flex gap-2 text-xs text-muted-foreground">
                            <MessageSquare className="mt-0.5 h-3.5 w-3.5" />
                            <span>
                              {formatDate(followUp.createdAt)} by {followUp.createdBy.name || followUp.createdBy.email}: {followUp.note}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
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
