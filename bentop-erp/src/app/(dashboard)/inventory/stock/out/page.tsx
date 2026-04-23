import { prisma } from "@/lib/db";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StockOutFormClient } from "@/components/inventory/stock-out-form-client";

export default async function StockOutPage() {
  const locations = await prisma.location.findMany({
    where: { isActive: true },
    orderBy: [{ type: "asc" }, { name: "asc" }],
    select: { id: true, name: true, type: true },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/inventory/stock">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Stock Out — Manual Deduction</h2>
          <p className="text-sm text-muted-foreground">
            Remove stock for damage, loss, samples, etc. Deductions are FIFO across batches.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">New Deduction</CardTitle>
          <CardDescription>
            Every deduction requires a reason code for auditability.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <StockOutFormClient locations={locations} />
        </CardContent>
      </Card>
    </div>
  );
}
