import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StockAdjustmentFormClient } from "@/components/inventory/stock-adjustment-form-client";
import { StockMovementHistory } from "@/components/inventory/stock-movement-history";

export default async function AdjustmentsPage() {
  const [locations, recentAdjustments] = await Promise.all([
    prisma.location.findMany({
      where: { isActive: true },
      orderBy: [{ type: "asc" }, { name: "asc" }],
      select: { id: true, name: true, type: true },
    }),
    prisma.stockMovement.findMany({
      where: { movementType: "ADJUSTMENT" },
      include: {
        productVariant: {
          select: {
            sku: true,
            size: true,
            color: true,
            colorHex: true,
            product: { select: { name: true } },
          },
        },
        fromLocation: { select: { name: true } },
        toLocation: { select: { name: true } },
        performedBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Stock Adjustments</h2>
        <p className="text-muted-foreground">
          Physical counts and corrections. Every adjustment is audit-logged.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">New Adjustment</CardTitle>
          <CardDescription>
            Enter the correct current quantity — the system computes the delta and records the movement.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <StockAdjustmentFormClient locations={locations} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Adjustments</CardTitle>
        </CardHeader>
        <CardContent>
          <StockMovementHistory
            movements={recentAdjustments.map((m) => ({
              id: m.id,
              createdAt: m.createdAt.toISOString(),
              sku: m.productVariant.sku,
              productName: m.productVariant.product.name,
              color: m.productVariant.color,
              colorHex: m.productVariant.colorHex,
              size: m.productVariant.size,
              movementType: m.movementType,
              quantity: m.quantity,
              fromLocation: m.fromLocation?.name ?? null,
              toLocation: m.toLocation?.name ?? null,
              reason: m.reason,
              referenceNumber: m.referenceNumber,
              performedBy: m.performedBy.name,
              notes: m.notes,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
