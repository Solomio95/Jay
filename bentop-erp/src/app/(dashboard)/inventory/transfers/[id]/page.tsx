import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, User, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/utils";
import { auth } from "@/lib/auth";
import { TransferActionClient } from "@/components/inventory/transfer-action-client";
import type { TransferStatus } from "@prisma/client";

const STATUS_META: Record<
  TransferStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "success" | "warning" | "outline" }
> = {
  REQUESTED: { label: "Requested", variant: "warning" },
  APPROVED: { label: "Approved", variant: "default" },
  IN_TRANSIT: { label: "In Transit", variant: "default" },
  COMPLETED: { label: "Completed", variant: "success" },
  CANCELLED: { label: "Cancelled", variant: "secondary" },
};

export default async function TransferDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const role = (session?.user as unknown as { role: string } | undefined)?.role;

  const transfer = await prisma.stockTransfer.findUnique({
    where: { id },
    include: {
      fromLocation: true,
      toLocation: true,
      requestedBy: { select: { name: true, email: true } },
      approvedBy: { select: { name: true, email: true } },
      completedBy: { select: { name: true, email: true } },
      items: {
        include: {
          productVariant: {
            include: { product: { select: { id: true, name: true, skuPrefix: true } } },
          },
        },
      },
    },
  });

  if (!transfer) notFound();

  const totalUnits = transfer.items.reduce((s, i) => s + i.quantity, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/inventory/transfers">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight font-mono">
              {transfer.transferNumber}
            </h2>
            <Badge variant={STATUS_META[transfer.status].variant}>
              {STATUS_META[transfer.status].label}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {transfer.fromLocation.name}
            <ArrowRight className="inline h-3 w-3 mx-2" />
            {transfer.toLocation.name}
          </p>
        </div>
        <TransferActionClient
          transferId={transfer.id}
          status={transfer.status}
          canApprove={role === "ADMIN" || role === "MANAGER"}
          canComplete={role !== "VIEWER"}
          canCancel={role === "ADMIN" || role === "MANAGER"}
        />
      </div>

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <TimelineRow
              label="Requested"
              date={transfer.requestedAt}
              by={transfer.requestedBy.name}
              active
            />
            {transfer.approvedAt && (
              <TimelineRow
                label="Approved"
                date={transfer.approvedAt}
                by={transfer.approvedBy?.name || "—"}
                active
              />
            )}
            {transfer.completedAt && (
              <TimelineRow
                label="Completed"
                date={transfer.completedAt}
                by={transfer.completedBy?.name || "—"}
                active
              />
            )}
            {transfer.cancelledAt && (
              <TimelineRow
                label="Cancelled"
                date={transfer.cancelledAt}
                by="—"
                active
              />
            )}
          </div>
          {transfer.notes && (
            <div className="mt-4 p-3 bg-muted/30 rounded-md text-sm">
              <div className="text-xs font-medium text-muted-foreground mb-1">Notes</div>
              {transfer.notes}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Items */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Items ({transfer.items.length}) · {totalUnits} units
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Variant</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transfer.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-xs">{item.productVariant.sku}</TableCell>
                  <TableCell>
                    <div className="text-sm">{item.productVariant.product.name}</div>
                    <div className="text-xs text-muted-foreground font-mono">
                      {item.productVariant.product.skuPrefix}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-xs">
                      <span
                        className="inline-block h-3 w-3 rounded-full ring-1 ring-border"
                        style={{ backgroundColor: item.productVariant.colorHex || "#999" }}
                      />
                      {item.productVariant.color} · {item.productVariant.size}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium">{item.quantity}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function TimelineRow({
  label,
  date,
  by,
  active,
}: {
  label: string;
  date: Date;
  by: string;
  active: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`h-2 w-2 rounded-full ${active ? "bg-primary" : "bg-muted-foreground/30"}`}
      />
      <div className="flex-1 flex items-center gap-3">
        <span className="font-medium w-24">{label}</span>
        <span className="text-muted-foreground flex items-center gap-1 text-xs">
          <Calendar className="h-3 w-3" />
          {formatDateTime(date)}
        </span>
        <span className="text-muted-foreground flex items-center gap-1 text-xs">
          <User className="h-3 w-3" />
          {by}
        </span>
      </div>
    </div>
  );
}
