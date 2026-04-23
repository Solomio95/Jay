import { prisma } from "@/lib/db";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { TransferFormClient } from "@/components/inventory/transfer-form-client";

export default async function NewTransferPage() {
  const locations = await prisma.location.findMany({
    where: { isActive: true },
    orderBy: [{ type: "asc" }, { name: "asc" }],
    select: { id: true, name: true, type: true },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/inventory/transfers">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">New Transfer Request</h2>
          <p className="text-sm text-muted-foreground">
            Stock will be reserved at the source until the transfer is completed or cancelled.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Request</CardTitle>
          <CardDescription>
            Managers can approve from the transfer detail page. Stock is moved on completion.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TransferFormClient locations={locations} />
        </CardContent>
      </Card>
    </div>
  );
}
