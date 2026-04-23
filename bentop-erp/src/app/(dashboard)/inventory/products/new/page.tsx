import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { ProductForm } from "@/components/inventory/product-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function NewProductPage() {
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  if (categories.length === 0) {
    redirect("/inventory/categories");
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">New Product</h2>
        <p className="text-muted-foreground">
          Add a new product to your catalog. Variants can be generated after creation.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Product Details</CardTitle>
        </CardHeader>
        <CardContent>
          <ProductForm categories={categories} />
        </CardContent>
      </Card>
    </div>
  );
}
