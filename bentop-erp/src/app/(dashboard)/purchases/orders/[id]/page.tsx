import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDateTime } from "@/lib/utils";

type PageProps = {
  params: Promise<{ id: string }>;
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "success" | "warning" | "destructive"> = {
  DRAFT: "secondary",
  ORDERED: "default",
  PARTIAL_RECEIVED: "warning",
  RECEIVED: "success",
  CANCELLED: "destructive",
};

export default async function PurchaseOrderDetailPage({ params }: PageProps) {
  const { id } = await params;
  const order = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      supplier: true,
      createdBy: { select: { name: true, email: true } },
      items: { include: { productVariant: { include: { product: true } } } },
      receipts: {
        include: { location: true, items: { include: { productVariant: true, batch: true } } },
        orderBy: { receivedAt: "desc" },
      },
    },
  });

  if (!order) notFound();

  const ordered = order.items.reduce((sum, item) => sum + item.quantityOrdered, 0);
  const received = order.items.reduce((sum, item) => sum + item.quantityReceived, 0);
  const value = order.items.reduce((sum, item) => sum + item.quantityOrdered * Number(item.costPerUnitMyr), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight">{order.orderNumber}</h2>
            <Badge variant={STATUS_VARIANT[order.status]}>{order.status}</Badge>
          </div>
          <p className="text-muted-foreground">
            {order.supplier.name} ordered on {formatDateTime(order.orderDate)}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/purchases/orders">Back to Orders</Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs text-muted-foreground">Ordered Units</div>
            <div className="text-2xl font-bold mt-1">{ordered.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs text-muted-foreground">Received Units</div>
            <div className="text-2xl font-bold mt-1">{received.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs text-muted-foreground">Order Value</div>
            <div className="text-2xl font-bold mt-1">{formatCurrency(value, "MYR")}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Items</CardTitle>
          <CardDescription>Receive remaining quantities through the purchase receiving API.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Ordered</TableHead>
                <TableHead>Received</TableHead>
                <TableHead>Remaining</TableHead>
                <TableHead>Cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.productVariant.sku}</TableCell>
                  <TableCell>{item.productVariant.product.name}</TableCell>
                  <TableCell>{item.quantityOrdered}</TableCell>
                  <TableCell>{item.quantityReceived}</TableCell>
                  <TableCell>{Math.max(0, item.quantityOrdered - item.quantityReceived)}</TableCell>
                  <TableCell>{formatCurrency(Number(item.costPerUnitMyr), "MYR")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Receipts</CardTitle>
          <CardDescription>Each receipt adds stock to the selected receiving location.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {order.receipts.map((receipt) => (
            <div key={receipt.id} className="rounded-md border p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium">{receipt.receiptNumber}</div>
                <div className="text-muted-foreground">{formatDateTime(receipt.receivedAt)}</div>
              </div>
              <div className="text-muted-foreground">Received to {receipt.location.name}</div>
              <div className="mt-2 text-xs text-muted-foreground">
                {receipt.items.reduce((sum, item) => sum + item.quantityReceived, 0)} units, {receipt.items.length} lines
              </div>
            </div>
          ))}
          {order.receipts.length === 0 && <div className="text-sm text-muted-foreground">No receipts yet.</div>}
        </CardContent>
      </Card>
    </div>
  );
}
