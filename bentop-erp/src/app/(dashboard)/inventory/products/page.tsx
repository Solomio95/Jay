import Link from "next/link";
import { prisma } from "@/lib/db";
import { Plus, Package, FolderTree, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProductsTableClient } from "@/components/inventory/products-table-client";

type SearchParams = Promise<{
  search?: string;
  category?: string;
  status?: string;
  page?: string;
}>;

const PAGE_SIZE = 20;

export default async function ProductsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const search = params.search || "";
  const categoryId = params.category || "";
  const status = params.status || "all";
  const page = Math.max(1, parseInt(params.page || "1"));

  const where: Record<string, unknown> = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { skuPrefix: { contains: search, mode: "insensitive" } },
      { variants: { some: { sku: { contains: search, mode: "insensitive" } } } },
    ];
  }
  if (categoryId) where.categoryId = categoryId;
  if (status === "active") where.isActive = true;
  if (status === "inactive") where.isActive = false;

  const [products, total, categories] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        category: { select: { id: true, name: true } },
        variants: {
          where: { isActive: true },
          select: { id: true, sku: true, color: true, colorHex: true, size: true, isActive: true },
          orderBy: { sku: "asc" },
        },
        _count: { select: { variants: true } },
      },
      orderBy: { skuPrefix: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.product.count({ where }),
    prisma.category.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Products</h2>
          <p className="text-muted-foreground">
            {total} total {total === 1 ? "product" : "products"} in catalog
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/inventory/categories">
              <FolderTree className="mr-2 h-4 w-4" />
              Categories
            </Link>
          </Button>
          <Button asChild>
            <Link href="/inventory/products/new">
              <Plus className="mr-2 h-4 w-4" />
              Add Product
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <ProductsTableClient
          products={products.map((p) => ({
            id: p.id,
            name: p.name,
            slug: p.slug,
            skuPrefix: p.skuPrefix,
            category: p.category,
            baseCostMyr: p.baseCostMyr.toString(),
            isActive: p.isActive,
            variantCount: p._count.variants,
            variants: p.variants.map((v) => ({
              id: v.id,
              sku: v.sku,
              color: v.color,
              colorHex: v.colorHex || "#999",
              size: v.size,
              isActive: v.isActive,
            })),
            updatedAt: p.updatedAt.toISOString(),
          }))}
          categories={categories}
          currentSearch={search}
          currentCategory={categoryId}
          currentStatus={status}
          page={page}
          totalPages={totalPages}
          total={total}
        />
      </Card>
    </div>
  );
}
