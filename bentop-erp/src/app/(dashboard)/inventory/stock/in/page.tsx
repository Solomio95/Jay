import { prisma } from "@/lib/db";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StockInFormClient } from "@/components/inventory/stock-in-form-client";

export default async function StockInPage() {
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
          <h2 className="text-2xl font-bold tracking-tight">Stock In — Receive Goods</h2>
          <p className="text-sm text-muted-foreground">
            Record incoming inventory. Each line creates a batch with its own cost.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">New Receipt</CardTitle>
          <CardDescription>
            Choose a destination location, then add one line per SKU.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <StockInFormClient locations={locations} />
        </CardContent>
      </Card>
    </div>
  );
}
