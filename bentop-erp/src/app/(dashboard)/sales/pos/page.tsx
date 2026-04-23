import { prisma } from "@/lib/db";
import { POSClient } from "@/components/sales/pos-client";

export default async function POSPage() {
  const [locations, channels] = await Promise.all([
    prisma.location.findMany({
      where: { isActive: true },
      orderBy: [{ type: "asc" }, { name: "asc" }],
      select: { id: true, name: true, type: true },
    }),
    prisma.salesChannel.findMany({
      where: { isActive: true, type: { in: ["PHYSICAL_STORE"] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Point of Sale</h2>
        <p className="text-muted-foreground">
          Retail store checkout. Scan a barcode or search a product to start a sale.
        </p>
      </div>

      {locations.length === 0 ? (
        <div className="text-sm text-destructive">
          No active locations configured.
        </div>
      ) : (
        <POSClient locations={locations} channels={channels} />
      )}
    </div>
  );
}
