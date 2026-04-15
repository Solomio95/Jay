import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LocationManagerClient } from "@/components/inventory/location-manager-client";

export default async function LocationsPage() {
  const locations = await prisma.location.findMany({
    include: { _count: { select: { stockLevels: true } } },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Locations</h2>
        <p className="text-muted-foreground">
          Manage warehouses, retail stores, and consignment partners.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Locations</CardTitle>
          <CardDescription>
            Stock is tracked per location. Deactivate a location only after moving out all stock.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LocationManagerClient
            initialLocations={locations.map((l) => ({
              id: l.id,
              name: l.name,
              type: l.type,
              address: l.address,
              contactPerson: l.contactPerson,
              contactPhone: l.contactPhone,
              isActive: l.isActive,
              stockRecords: l._count.stockLevels,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
