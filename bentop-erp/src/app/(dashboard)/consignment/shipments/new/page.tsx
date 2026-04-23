import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ConsignmentShipmentFormClient } from "@/components/consignment/consignment-shipment-form-client";

export default async function NewConsignmentShipmentPage() {
  const locations = await prisma.location.findMany({
    where: { isActive: true },
    orderBy: [{ type: "asc" }, { name: "asc" }],
    select: { id: true, name: true, type: true },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/consignment">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">New Consignment Shipment</h2>
          <p className="text-sm text-muted-foreground">
            Create a draft or ship out stock to a consignee partner immediately.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Shipment Details</CardTitle>
          <CardDescription>
            Consignee must be a location of type CONSIGNMENT. Stock moves on ship.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ConsignmentShipmentFormClient locations={locations} />
        </CardContent>
      </Card>
    </div>
  );
}
