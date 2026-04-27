import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BatchManagerClient } from "@/components/inventory/batch-manager-client";

export default async function BatchesPage() {
  const session = await auth();
  const role = (session?.user as unknown as { role: string } | undefined)?.role ?? "VIEWER";
  const canEdit = role === "ADMIN" || role === "MANAGER";

  const [batches, variants] = await Promise.all([
    prisma.batch.findMany({
      include: {
        productVariant: {
          select: {
            sku: true, size: true, color: true,
            product: { select: { name: true } },
          },
        },
        _count: { select: { stockLevels: true, movements: true } },
      },
      orderBy: { productionDate: "desc" },
      take: 200,
    }),
    prisma.productVariant.findMany({
      where: { isActive: true, product: { isActive: true } },
      select: {
        id: true, sku: true, size: true, color: true,
        product: { select: { name: true } },
      },
      orderBy: [{ product: { name: "asc" } }, { sku: "asc" }],
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Batch Management</h2>
        <p className="text-muted-foreground">
          Track production batches, lot numbers, and per-unit costs.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Batches</CardTitle>
          <CardDescription>
            {batches.length} batch{batches.length !== 1 ? "es" : ""} recorded
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BatchManagerClient
            initialBatches={batches.map((b) => ({
              ...b,
              costPerUnitMyr: b.costPerUnitMyr.toString(),
              productionDate: b.productionDate.toISOString(),
              expiryDate: b.expiryDate?.toISOString() ?? null,
            }))}
            variants={variants}
            canEdit={canEdit}
          />
        </CardContent>
      </Card>
    </div>
  );
}
