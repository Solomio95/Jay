import { prisma } from "@/lib/db";
import { FolderTree } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CategoryManagerClient } from "@/components/inventory/category-manager-client";

export default async function CategoriesPage() {
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    include: {
      parent: true,
      children: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
      _count: { select: { products: true } },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  const rootCategories = categories.filter((c) => !c.parentId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Categories</h2>
          <p className="text-muted-foreground">
            Organize your products into hierarchical categories.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderTree className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Category Tree</CardTitle>
            <Badge variant="secondary" className="ml-2">
              {categories.length} total
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <CategoryManagerClient
            initialCategories={categories.map((c) => ({
              id: c.id,
              name: c.name,
              slug: c.slug,
              parentId: c.parentId,
              description: c.description,
              sortOrder: c.sortOrder,
              productCount: c._count.products,
              hasChildren: c.children.length > 0,
            }))}
            rootCategoryIds={rootCategories.map((c) => c.id)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
