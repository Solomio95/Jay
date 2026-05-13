import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { SupplierManagerClient } from "@/components/purchases/supplier-manager-client";

export default async function SuppliersPage() {
  const suppliers = await prisma.supplier.findMany({
    include: { _count: { select: { purchaseOrders: true } } },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Suppliers</h2>
        <p className="text-muted-foreground">Supplier master data for purchase orders and receiving.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Supplier List</CardTitle>
          <CardDescription>Create suppliers before opening purchase orders and receiving stock.</CardDescription>
        </CardHeader>
        <CardContent>
          <SupplierManagerClient initialSuppliers={suppliers} />
        </CardContent>
      </Card>
    </div>
  );
}
