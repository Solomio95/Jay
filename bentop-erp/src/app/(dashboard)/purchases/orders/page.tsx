import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDateTime } from "@/lib/utils";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "success" | "warning" | "destructive"> = {
  DRAFT: "secondary",
  ORDERED: "default",
  PARTIAL_RECEIVED: "warning",
  RECEIVED: "success",
  CANCELLED: "destructive",
};

export default async function PurchaseOrdersPage() {
  const orders = await prisma.purchaseOrder.findMany({
    include: { supplier: true, items: true, _count: { select: { receipts: true } } },
    orderBy: { orderDate: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Purchase Orders</h2>
          <p className="text-muted-foreground">Track ordered, partial received, and completed purchasing.</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/purchases">Purchases Overview</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Purchase Orders</CardTitle>
          <CardDescription>Receiving a PO creates batches, inbound movement, and warehouse stock.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ordered</TableHead>
                <TableHead>Received</TableHead>
                <TableHead>Value</TableHead>
                <TableHead className="text-right">Receipts</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => {
                const ordered = order.items.reduce((sum, item) => sum + item.quantityOrdered, 0);
                const received = order.items.reduce((sum, item) => sum + item.quantityReceived, 0);
                const value = order.items.reduce(
                  (sum, item) => sum + item.quantityOrdered * Number(item.costPerUnitMyr),
                  0
                );

                return (
                  <TableRow key={order.id}>
                    <TableCell>
                      <Link href={`/purchases/orders/${order.id}`} className="font-medium hover:underline">
                        {order.orderNumber}
                      </Link>
                      <div className="text-xs text-muted-foreground">{formatDateTime(order.orderDate)}</div>
                    </TableCell>
                    <TableCell>{order.supplier.name}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[order.status]}>{order.status}</Badge>
                    </TableCell>
                    <TableCell>{ordered.toLocaleString()}</TableCell>
                    <TableCell>{received.toLocaleString()}</TableCell>
                    <TableCell>{formatCurrency(value, "MYR")}</TableCell>
                    <TableCell className="text-right">{order._count.receipts}</TableCell>
                  </TableRow>
                );
              })}
              {orders.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No purchase orders yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
