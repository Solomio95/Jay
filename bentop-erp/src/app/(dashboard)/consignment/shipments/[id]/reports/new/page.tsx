import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConsignmentReportFormClient } from "@/components/consignment/consignment-report-form-client";
import { prisma } from "@/lib/db";

export default async function NewConsignmentReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const shipment = await prisma.consignmentShipment.findUnique({
    where: { id },
    include: {
      partner: {
        include: {
          commissionTiers: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
          overrides: { where: { isActive: true } },
        },
      },
      items: {
        include: {
          productVariant: {
            select: {
              id: true,
              sku: true,
              color: true,
              size: true,
              colorHex: true,
              product: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { id: "asc" },
      },
    },
  });

  if (!shipment || !shipment.partner) {
    notFound();
  }

  const openItems = shipment.items.filter(
    (item) => item.quantityShipped - item.quantitySold - item.quantityReturned > 0,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/consignment/shipments/${shipment.id}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">New Consignment Report</h2>
          <p className="text-sm text-muted-foreground">
            Record partner sales and returns, then generate the partner invoice.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{shipment.partner.name}</CardTitle>
          <CardDescription>
            {shipment.shipmentNumber} has {openItems.length} open SKU lines.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ConsignmentReportFormClient
            shipmentId={shipment.id}
            shipmentNumber={shipment.shipmentNumber}
            partnerName={shipment.partner.name}
            tiers={shipment.partner.commissionTiers.map((tier) => ({
              name: tier.name,
              minPrice: Number(tier.minPrice),
              maxPrice: tier.maxPrice === null ? null : Number(tier.maxPrice),
              commissionRate: Number(tier.commissionRate),
            }))}
            overrides={shipment.partner.overrides.map((override) => ({
              productId: override.productId,
              productVariantId: override.productVariantId,
              tierName: override.tierName,
              commissionRate: Number(override.commissionRate),
            }))}
            items={openItems.map((item) => ({
              id: item.id,
              productId: item.productVariant.product.id,
              productName: item.productVariant.product.name,
              productVariantId: item.productVariant.id,
              sku: item.productVariant.sku,
              color: item.productVariant.color,
              size: item.productVariant.size,
              colorHex: item.productVariant.colorHex,
              quantityShipped: item.quantityShipped,
              quantitySold: item.quantitySold,
              quantityReturned: item.quantityReturned,
              unitPrice: Number(item.unitPrice),
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
