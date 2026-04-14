import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { VariantManagerClient } from "@/components/inventory/variant-manager-client";

export default async function VariantsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      category: { select: { name: true } },
      variants: {
        orderBy: [{ color: "asc" }, { size: "asc" }],
        include: {
          _count: {
            select: { stockLevels: true, orderItems: true },
          },
        },
      },
    },
  });

  if (!product) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/inventory/products/${id}/edit`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{product.name}</h2>
          <p className="text-sm text-muted-foreground">
            <span className="font-mono">{product.skuPrefix}</span> &middot; {product.category.name}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Variant Matrix</CardTitle>
          <CardDescription>
            Generate variants by selecting sizes and colors. Each size × color combination creates one variant with a unique SKU and barcode.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <VariantManagerClient
            productId={product.id}
            skuPrefix={product.skuPrefix}
            existingVariants={product.variants.map((v) => ({
              id: v.id,
              sku: v.sku,
              size: v.size,
              color: v.color,
              colorHex: v.colorHex,
              barcode: v.barcode,
              isActive: v.isActive,
              stockLevelsCount: v._count.stockLevels,
              orderItemsCount: v._count.orderItems,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
