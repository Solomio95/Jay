import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConsignmentPartnerFormClient } from "@/components/consignment/consignment-partner-form-client";

export default async function ConsignmentPartnersPage() {
  const session = await auth();
  const role = (session?.user as unknown as { role: string } | undefined)?.role ?? "VIEWER";
  const canEdit = role === "ADMIN" || role === "MANAGER";

  const [partners, locations, products] = await Promise.all([
    prisma.consignmentPartner.findMany({
      where: { isActive: true },
      include: {
        commissionTiers: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
        overrides: { where: { isActive: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.location.findMany({
      where: { isActive: true, type: "CONSIGNMENT" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.product.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        variants: {
          where: { isActive: true },
          orderBy: [{ color: "asc" }, { size: "asc" }],
          select: { id: true, sku: true, color: true, size: true },
        },
      },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Consignment Partners</h2>
        <p className="text-muted-foreground">
          Manage partner terms, price-tier commission groups, and item overrides.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Partner Commission Setup</CardTitle>
          <CardDescription>
            Report lines use partner item overrides first, then actual selling price tiers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ConsignmentPartnerFormClient
            canEdit={canEdit}
            locations={locations}
            products={products}
            initialPartners={partners.map((partner) => ({
              id: partner.id,
              name: partner.name,
              contactPerson: partner.contactPerson,
              contactPhone: partner.contactPhone,
              contactEmail: partner.contactEmail,
              locationId: partner.locationId,
              paymentTermsDays: partner.paymentTermsDays,
              isActive: partner.isActive,
              tiers: partner.commissionTiers.map((tier) => ({
                name: tier.name,
                minPrice: Number(tier.minPrice).toString(),
                maxPrice: tier.maxPrice === null ? "" : Number(tier.maxPrice).toString(),
                commissionRate: Number(tier.commissionRate).toString(),
                sortOrder: tier.sortOrder,
              })),
              overrides: partner.overrides.map((override) => ({
                productId: override.productId ?? "",
                productVariantId: override.productVariantId ?? "",
                tierName: override.tierName,
                commissionRate: Number(override.commissionRate).toString(),
                notes: override.notes ?? "",
              })),
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
