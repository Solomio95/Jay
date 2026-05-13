import Link from "next/link";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PurchaseOrderFormClient } from "@/components/purchases/purchase-order-form-client";

export default async function NewPurchaseOrderPage() {
  const suppliers = await prisma.supplier.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      code: true,
      paymentTermsDays: true,
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">New Purchase Order</h2>
          <p className="text-muted-foreground">Order stock from suppliers before receiving it into inventory.</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/purchases/orders">Back to Orders</Link>
        </Button>
      </div>

      {suppliers.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">No Active Suppliers</CardTitle>
            <CardDescription>Create at least one supplier before opening a purchase order.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/purchases/suppliers">Create Supplier</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Purchase Details</CardTitle>
            <CardDescription>Add supplier, dates, and SKU lines for this purchase order.</CardDescription>
          </CardHeader>
          <CardContent>
            <PurchaseOrderFormClient suppliers={suppliers} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
