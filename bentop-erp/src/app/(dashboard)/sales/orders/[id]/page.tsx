import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, User as UserIcon, Store } from "lucide-react";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { OrderStatusActions } from "@/components/sales/order-status-actions";

const STATUS_COLOR: Record<string, "default" | "secondary" | "success" | "warning" | "destructive"> = {
  DRAFT: "secondary",
  CONFIRMED: "default",
  PROCESSING: "warning",
  PACKED: "warning",
  SHIPPED: "default",
  DELIVERED: "success",
  CANCELLED: "destructive",
  RETURNED: "destructive",
};

const PAYMENT_COLOR: Record<string, "default" | "secondary" | "success" | "warning" | "destructive"> = {
  UNPAID: "destructive",
  PARTIAL: "warning",
  PAID: "success",
  REFUNDED: "secondary",
};

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const role = (session?.user as unknown as { role: string } | undefined)?.role ?? "VIEWER";
  const canEdit = role !== "VIEWER";

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      customer: true,
      salesChannel: true,
      location: true,
      createdBy: { select: { id: true, name: true, email: true } },
      items: {
        include: {
          productVariant: {
            select: {
              id: true,
              sku: true,
              size: true,
              color: true,
              colorHex: true,
              product: { select: { id: true, name: true } },
            },
          },
          batch: { select: { id: true, batchNumber: true } },
        },
      },
      statusHistory: {
        include: { changedBy: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!order) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
            <Link href="/sales/orders">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Orders
            </Link>
          </Button>
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-2xl font-bold tracking-tight font-mono">{order.orderNumber}</h2>
            <Badge variant={STATUS_COLOR[order.status]}>{order.status}</Badge>
            <Badge variant={PAYMENT_COLOR[order.paymentStatus]}>{order.paymentStatus}</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Created {formatDateTime(order.createdAt)} by {order.createdBy.name}
          </p>
        </div>
        <OrderStatusActions
          orderId={order.id}
          status={order.status}
          paymentStatus={order.paymentStatus}
          paymentMethod={order.paymentMethod}
          paymentReference={order.paymentReference}
          canEdit={canEdit}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <UserIcon className="h-4 w-4" /> Customer
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            {order.customer ? (
              <>
                <Link
                  href={`/sales/customers/${order.customer.id}`}
                  className="font-medium hover:underline"
                >
                  {order.customer.name}
                </Link>
                <div className="text-xs text-muted-foreground">
                  {order.customer.customerType}
                  {order.customer.companyName ? ` · ${order.customer.companyName}` : ""}
                </div>
                {order.customer.email && <div className="text-xs">{order.customer.email}</div>}
                {order.customer.phone && <div className="text-xs">{order.customer.phone}</div>}
              </>
            ) : (
              <span className="text-muted-foreground">Walk-in customer</span>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Store className="h-4 w-4" /> Channel
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            {order.salesChannel ? (
              <>
                <div className="font-medium">{order.salesChannel.name}</div>
                <div className="text-xs text-muted-foreground">{order.salesChannel.type}</div>
                {order.salesChannel.commissionRate != null && (
                  <div className="text-xs text-muted-foreground">
                    {Number(order.salesChannel.commissionRate)}% commission
                  </div>
                )}
              </>
            ) : (
              <span className="text-muted-foreground">Direct (no channel)</span>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4" /> Fulfillment
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            {order.location ? (
              <>
                <div className="font-medium">{order.location.name}</div>
                <div className="text-xs text-muted-foreground">{order.location.type}</div>
              </>
            ) : (
              <span className="text-muted-foreground">No location assigned</span>
            )}
            <div className="text-xs text-muted-foreground mt-2">
              Currency: <span className="font-medium">{order.currency}</span>
              {order.currency !== "MYR" && ` (rate ${Number(order.exchangeRateToMyr)})`}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Items</CardTitle>
          <CardDescription>{order.items.length} line items</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Discount</TableHead>
                  <TableHead className="text-right">Line Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.items.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="font-mono text-xs">{i.productVariant.sku}</TableCell>
                    <TableCell className="text-sm">
                      <div>{i.productVariant.product.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {i.productVariant.color} · {i.productVariant.size}
                        {i.batch && ` · Batch ${i.batch.batchNumber}`}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{i.quantity}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(Number(i.unitPrice), order.currency)}
                    </TableCell>
                    <TableCell className="text-right">
                      {Number(i.discountAmount) > 0
                        ? `−${formatCurrency(Number(i.discountAmount), order.currency)}`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(Number(i.totalPrice), order.currency)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 flex justify-end">
            <div className="w-full max-w-sm space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(Number(order.subtotal), order.currency)}</span>
              </div>
              {Number(order.discountAmount) > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Discount{order.discountType === "PERCENTAGE" ? ` (${Number(order.discountAmount)}%)` : ""}
                  </span>
                  <span className="text-destructive">
                    −{formatCurrency(
                      order.discountType === "PERCENTAGE"
                        ? (Number(order.subtotal) * Number(order.discountAmount)) / 100
                        : Number(order.discountAmount),
                      order.currency
                    )}
                  </span>
                </div>
              )}
              {Number(order.taxAmount) > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax</span>
                  <span>{formatCurrency(Number(order.taxAmount), order.currency)}</span>
                </div>
              )}
              {Number(order.shippingAmount) > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shipping</span>
                  <span>{formatCurrency(Number(order.shippingAmount), order.currency)}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t font-semibold text-base">
                <span>Total</span>
                <span>{formatCurrency(Number(order.totalAmount), order.currency)}</span>
              </div>
              {order.paymentMethod && (
                <div className="pt-2 text-xs text-muted-foreground">
                  Paid via {order.paymentMethod}
                  {order.paymentReference && ` (ref ${order.paymentReference})`}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {order.statusHistory.map((h, i) => (
                <div key={h.id} className="flex items-start gap-3 text-sm">
                  <div className="flex flex-col items-center">
                    <div className="h-2 w-2 rounded-full bg-primary mt-1.5" />
                    {i < order.statusHistory.length - 1 && (
                      <div className="w-px flex-1 bg-border mt-1" />
                    )}
                  </div>
                  <div className="flex-1 pb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      {h.fromStatus && (
                        <Badge variant="secondary" className="text-xs">{h.fromStatus}</Badge>
                      )}
                      <span className="text-xs text-muted-foreground">→</span>
                      <Badge variant={STATUS_COLOR[h.toStatus]} className="text-xs">
                        {h.toStatus}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {formatDateTime(h.createdAt)} · {h.changedBy.name}
                    </div>
                    {h.reason && <div className="text-xs mt-1">{h.reason}</div>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-3">
            {order.notes ? (
              <div>
                <div className="text-xs font-semibold text-muted-foreground mb-1">Customer notes</div>
                <p className="whitespace-pre-wrap">{order.notes}</p>
              </div>
            ) : null}
            {order.internalNotes ? (
              <div>
                <div className="text-xs font-semibold text-muted-foreground mb-1">Internal notes</div>
                <p className="whitespace-pre-wrap">{order.internalNotes}</p>
              </div>
            ) : null}
            {!order.notes && !order.internalNotes && (
              <p className="text-muted-foreground">No notes</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
