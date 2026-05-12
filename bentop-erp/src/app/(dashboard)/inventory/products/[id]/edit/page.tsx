import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Grid3x3 } from "lucide-react";
import { ProductForm } from "@/components/inventory/product-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [product, categories] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: {
        variants: { orderBy: [{ color: "asc" }, { size: "asc" }] },
      },
    }),
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  if (!product) notFound();

  const initialData = {
    id: product.id,
    name: product.name,
    slug: product.slug,
    skuPrefix: product.skuPrefix,
    description: product.description || "",
    categoryId: product.categoryId,
    brand: product.brand,
    baseCostMyr: Number(product.baseCostMyr),
    baseCostUsd: product.baseCostUsd ? Number(product.baseCostUsd) : null,
    baseCostRmb: product.baseCostRmb ? Number(product.baseCostRmb) : null,
    weightKg: product.weightKg ? Number(product.weightKg) : null,
    material: product.material || "",
    careInstructions: product.careInstructions || "",
    images: Array.isArray(product.images) ? product.images.filter((image): image is string => typeof image === "string") : [],
    isActive: product.isActive,
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/inventory/products">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">{product.name}</h2>
            <p className="text-sm text-muted-foreground font-mono">{product.skuPrefix}</p>
          </div>
        </div>
        <Button variant="outline" asChild>
          <Link href={`/inventory/products/${product.id}/variants`}>
            <Grid3x3 className="mr-2 h-4 w-4" />
            Manage Variants ({product.variants.length})
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Product Details</CardTitle>
        </CardHeader>
        <CardContent>
          <ProductForm categories={categories} initialData={initialData} />
        </CardContent>
      </Card>
    </div>
  );
}
