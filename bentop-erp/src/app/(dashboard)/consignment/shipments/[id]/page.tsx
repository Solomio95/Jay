import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Package, User, MapPin, FileText, Calendar } from "lucide-react";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { ConsignmentShipmentActions } from "@/components/consignment/consignment-shipment-actions";

const STATUS_COLOR: Record<string, "default" | "secondary" | "success" | "warning" | "destructive"> = {
  DRAFT: "secondary",
  SHIPPED: "default",
  PARTIAL_SETTLED: "warning",
  SETTLED: "success",
  CANCELLED: "destructive",
};

export default async function ConsignmentShipmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const shipment = await prisma.consignmentShipment.findUnique({
    where: { id },
    include: {
      fromLocation: true,
      toLocation: true,
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
              product: { select: { id: true, name: true, skuPrefix: true } },
            },
          },
          batch: { select: { id: true, batchNumber: true } },
        },
      },
    },
  });

  if (!shipment) {
    notFound();
  }

  const totalShipped = shipment.items.reduce((s, i) => s + i.quantityShipped, 0);
  const totalSold = shipment.items.reduce((s, i) => s + i.quantitySold, 0);
  const totalReturned = shipment.items.reduce((s, i) => s + i.quantityReturned, 0);
  const totalRemaining = totalShipped - totalSold - totalReturned;
  const totalShipmentValue = shipment.items.reduce(
    (s, i) => s + Number(i.unitPrice) * i.quantityShipped,
    0
  );
  const totalSoldValue = shipment.items.reduce(
    (s, i) => s + Number(i.unitPrice) * i.quantitySold,
    0
  );
  const commission = (totalSoldValue * Number(shipment.commissionRate)) / 100;
  const netPayable = totalSoldValue - commission;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/consignment">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-2xl font-bold tracking-tight font-mono">
                {shipment.shipmentNumber}
              </h2>
              <Badge variant={STATUS_COLOR[shipment.status]}>
                {shipment.status.replace("_", " ")}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Consignment to {shipment.partnerName}
            </p>
          </div>
        </div>
        <ConsignmentShipmentActions
          shipmentId={shipment.id}
          status={shipment.status}
          items={shipment.items.map((i) => ({
            id: i.id,
            sku: i.productVariant.sku,
            productName: i.productVariant.product.name,
            color: i.productVariant.color,
            size: i.productVariant.size,
            quantityShipped: i.quantityShipped,
            quantitySold: i.quantitySold,
            quantityReturned: i.quantityReturned,
            unitPrice: Number(i.unitPrice),
          }))}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs text-muted-foreground">Units Shipped</div>
            <div className="text-2xl font-bold mt-1">{totalShipped}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs text-muted-foreground">Units Sold</div>
            <div className="text-2xl font-bold mt-1">{totalSold}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs text-muted-foreground">Units Remaining</div>
            <div className="text-2xl font-bold mt-1">{totalRemaining}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs text-muted-foreground">Shipment Value</div>
            <div className="text-2xl font-bold mt-1">
              {formatCurrency(totalShipmentValue, "MYR")}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Line Items</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-2">SKU</th>
                    <th className="text-left px-4 py-2">Product</th>
                    <th className="text-right px-4 py-2">Shipped</th>
                    <th className="text-right px-4 py-2">Sold</th>
                    <th className="text-right px-4 py-2">Returned</th>
                    <th className="text-right px-4 py-2">Remaining</th>
                    <th className="text-right px-4 py-2">Unit Price</th>
                    <th className="text-right px-4 py-2">Sold Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {shipment.items.map((i) => {
                    const remaining = i.quantityShipped - i.quantitySold - i.quantityReturned;
                    const soldValue = Number(i.unitPrice) * i.quantitySold;
                    return (
                      <tr key={i.id}>
                        <td className="px-4 py-2 font-mono text-xs">{i.productVariant.sku}</td>
                        <td className="px-4 py-2">
                          <div>{i.productVariant.product.name}</div>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span
                              className="inline-block h-2 w-2 rounded-full ring-1 ring-border"
                              style={{ backgroundColor: i.productVariant.colorHex || "#999" }}
                            />
                            {i.productVariant.color} · {i.productVariant.size}
                            {i.batch && ` · Batch ${i.batch.batchNumber}`}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-right">{i.quantityShipped}</td>
                        <td className="px-4 py-2 text-right">{i.quantitySold}</td>
                        <td className="px-4 py-2 text-right">{i.quantityReturned}</td>
                        <td className="px-4 py-2 text-right font-medium">{remaining}</td>
                        <td className="px-4 py-2 text-right">
                          {formatCurrency(Number(i.unitPrice), "MYR")}
                        </td>
                        <td className="px-4 py-2 text-right font-medium">
                          {formatCurrency(soldValue, "MYR")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <User className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-xs text-muted-foreground">Partner</div>
                  <div className="font-medium">{shipment.partnerName}</div>
                  {shipment.partnerContact && (
                    <div className="text-xs text-muted-foreground">
                      {shipment.partnerContact}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-xs text-muted-foreground">From → To</div>
                  <div className="font-medium">
                    {shipment.fromLocation.name} → {shipment.toLocation.name}
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Package className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-xs text-muted-foreground">Commission</div>
                  <div className="font-medium">{Number(shipment.commissionRate).toFixed(2)}%</div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-xs text-muted-foreground">Created</div>
                  <div className="text-xs">{formatDateTime(shipment.createdAt)}</div>
                  {shipment.shippedAt && (
                    <div className="text-xs text-muted-foreground">
                      Shipped {formatDateTime(shipment.shippedAt)}
                    </div>
                  )}
                  {shipment.settledAt && (
                    <div className="text-xs text-muted-foreground">
                      Settled {formatDateTime(shipment.settledAt)}
                    </div>
                  )}
                  {shipment.cancelledAt && (
                    <div className="text-xs text-destructive">
                      Cancelled {formatDateTime(shipment.cancelledAt)}
                    </div>
                  )}
                </div>
              </div>
              {shipment.notes && (
                <div className="flex items-start gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-xs text-muted-foreground">Notes</div>
                    <div className="text-xs whitespace-pre-wrap">{shipment.notes}</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Settlement</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sold value</span>
                <span className="font-medium">{formatCurrency(totalSoldValue, "MYR")}</span>
              </div>
              <div className="flex justify-between text-amber-700">
                <span>
                  Commission ({Number(shipment.commissionRate).toFixed(2)}%)
                </span>
                <span>-{formatCurrency(commission, "MYR")}</span>
              </div>
              <div className="border-t pt-2 flex justify-between font-bold">
                <span>Net to Bentop</span>
                <span>{formatCurrency(netPayable, "MYR")}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
