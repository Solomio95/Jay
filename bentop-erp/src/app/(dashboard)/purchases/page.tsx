import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDateTime } from "@/lib/utils";

export default async function PurchasesPage() {
  const [supplierCount, openOrders, recentOrders, recentReceipts] = await Promise.all([
    prisma.supplier.count({ where: { isActive: true } }),
    prisma.purchaseOrder.count({ where: { status: { in: ["ORDERED", "PARTIAL_RECEIVED"] } } }),
    prisma.purchaseOrder.findMany({
      include: { supplier: true, items: true },
      orderBy: { orderDate: "desc" },
      take: 6,
    }),
    prisma.purchaseReceipt.findMany({
      include: { purchaseOrder: true, location: true, items: true },
      orderBy: { receivedAt: "desc" },
      take: 6,
    }),
  ]);

  const openValue = recentOrders.reduce(
    (sum, order) =>
      sum +
      order.items.reduce(
        (itemSum, item) =>
          itemSum + (item.quantityOrdered - item.quantityReceived) * Number(item.costPerUnitMyr),
        0
      ),
    0
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Purchases</h2>
          <p className="text-muted-foreground">Supplier orders, receiving, and inbound stock control.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/purchases/suppliers">Suppliers</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/purchases/orders">Purchase Orders</Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs text-muted-foreground">Active Suppliers</div>
            <div className="text-2xl font-bold mt-1">{supplierCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs text-muted-foreground">Open Purchase Orders</div>
            <div className="text-2xl font-bold mt-1">{openOrders}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs text-muted-foreground">Recent Open Value</div>
            <div className="text-2xl font-bold mt-1">{formatCurrency(openValue, "MYR")}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Purchase Orders</CardTitle>
            <CardDescription>Open and recent supplier orders.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentOrders.map((order) => (
              <Link
                key={order.id}
                href={`/purchases/orders/${order.id}`}
                className="flex items-center justify-between rounded-md border p-3 text-sm hover:bg-muted/50"
              >
                <div>
                  <div className="font-medium">{order.orderNumber}</div>
                  <div className="text-muted-foreground">{order.supplier.name}</div>
                </div>
                <Badge variant={order.status === "RECEIVED" ? "success" : "secondary"}>{order.status}</Badge>
              </Link>
            ))}
            {recentOrders.length === 0 && <div className="text-sm text-muted-foreground">No purchase orders yet.</div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Receipts</CardTitle>
            <CardDescription>Inbound stock created from purchase receiving.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentReceipts.map((receipt) => (
              <div key={receipt.id} className="rounded-md border p-3 text-sm">
                <div className="font-medium">{receipt.receiptNumber}</div>
                <div className="text-muted-foreground">
                  {receipt.purchaseOrder.orderNumber} to {receipt.location.name}
                </div>
                <div className="text-xs text-muted-foreground mt-1">{formatDateTime(receipt.receivedAt)}</div>
              </div>
            ))}
            {recentReceipts.length === 0 && <div className="text-sm text-muted-foreground">No purchase receipts yet.</div>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
