import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StockAlertsClient } from "@/components/inventory/stock-alerts-client";

export default async function StockAlertsPage() {
  const session = await auth();
  const role = (session?.user as unknown as { role: string } | undefined)?.role ?? "VIEWER";
  const canAcknowledge = role !== "VIEWER";

  const alerts = await prisma.stockAlert.findMany({
    include: {
      productVariant: {
        select: {
          sku: true, size: true, color: true,
          product: { select: { name: true } },
        },
      },
      location: { select: { name: true, type: true } },
      acknowledgedBy: { select: { name: true } },
    },
    orderBy: [{ isAcknowledged: "asc" }, { createdAt: "desc" }],
  });

  const unacknowledged = alerts.filter((a) => !a.isAcknowledged).length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Stock Alerts</h2>
        <p className="text-muted-foreground">
          Low stock, out-of-stock, and overstock alerts that need attention.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Active Alerts</CardTitle>
          <CardDescription>
            {unacknowledged} alert{unacknowledged !== 1 ? "s" : ""} requiring attention
          </CardDescription>
        </CardHeader>
        <CardContent>
          <StockAlertsClient
            initialAlerts={alerts.map((a) => ({
              ...a,
              acknowledgedAt: a.acknowledgedAt?.toISOString() ?? null,
              createdAt: a.createdAt.toISOString(),
            }))}
            canAcknowledge={canAcknowledge}
          />
        </CardContent>
      </Card>
    </div>
  );
}
