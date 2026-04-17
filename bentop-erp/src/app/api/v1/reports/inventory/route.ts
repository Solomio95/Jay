import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return Response.json(
      { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  const sp = request.nextUrl.searchParams;
  const locationId = sp.get("locationId");

  // Stock valuation: aggregate per variant across locations
  const stockLevels = await prisma.stockLevel.findMany({
    where: {
      batchId: null, // aggregate rows only
      quantityOnHand: { gt: 0 },
      ...(locationId ? { locationId } : {}),
    },
    include: {
      productVariant: {
        include: {
          product: {
            select: { id: true, name: true, baseCostMyr: true, categoryId: true },
          },
        },
      },
      location: { select: { id: true, name: true, type: true } },
    },
  });

  // Category lookup
  const categoryIds = [
    ...new Set(stockLevels.map((s) => s.productVariant.product.categoryId)),
  ];
  const categories = await prisma.category.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true, name: true },
  });
  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

  // Build valuation rows
  const rows = stockLevels.map((s) => {
    const unitCost =
      Number(s.productVariant.product.baseCostMyr) +
      Number(s.productVariant.additionalCost);
    const onHand = s.quantityOnHand;
    const reserved = s.quantityReserved;
    const available = onHand - reserved;
    const totalValue = onHand * unitCost;
    return {
      variantId: s.productVariant.id,
      sku: s.productVariant.sku,
      productName: s.productVariant.product.name,
      size: s.productVariant.size,
      color: s.productVariant.color,
      categoryName:
        categoryMap.get(s.productVariant.product.categoryId) ?? "Uncategorized",
      locationId: s.location.id,
      locationName: s.location.name,
      locationType: s.location.type,
      onHand,
      reserved,
      available,
      unitCost,
      totalValue,
    };
  });

  // Summary
  const totalUnits = rows.reduce((s, r) => s + r.onHand, 0);
  const totalValue = rows.reduce((s, r) => s + r.totalValue, 0);
  const totalReserved = rows.reduce((s, r) => s + r.reserved, 0);

  // By category
  const byCategory: Record<string, { units: number; value: number }> = {};
  for (const r of rows) {
    const entry = byCategory[r.categoryName] ?? { units: 0, value: 0 };
    entry.units += r.onHand;
    entry.value += r.totalValue;
    byCategory[r.categoryName] = entry;
  }

  // By location
  const byLocation: Record<string, { name: string; type: string; units: number; value: number }> =
    {};
  for (const r of rows) {
    const entry = byLocation[r.locationId] ?? {
      name: r.locationName,
      type: r.locationType,
      units: 0,
      value: 0,
    };
    entry.units += r.onHand;
    entry.value += r.totalValue;
    byLocation[r.locationId] = entry;
  }

  // Low-stock items (available <= reorderPoint, reorderPoint > 0)
  const lowStockLevels = await prisma.stockLevel.findMany({
    where: {
      batchId: null,
      reorderPoint: { gt: 0 },
      ...(locationId ? { locationId } : {}),
    },
    include: {
      productVariant: {
        select: {
          id: true,
          sku: true,
          size: true,
          color: true,
          product: { select: { name: true } },
        },
      },
      location: { select: { id: true, name: true } },
    },
  });

  const lowStock = lowStockLevels
    .filter((s) => s.quantityOnHand - s.quantityReserved <= s.reorderPoint)
    .map((s) => ({
      sku: s.productVariant.sku,
      productName: s.productVariant.product.name,
      size: s.productVariant.size,
      color: s.productVariant.color,
      locationName: s.location.name,
      available: s.quantityOnHand - s.quantityReserved,
      reorderPoint: s.reorderPoint,
      reorderQuantity: s.reorderQuantity,
    }));

  return Response.json({
    data: {
      summary: { totalUnits, totalValue, totalReserved },
      byCategory: Object.entries(byCategory)
        .map(([name, v]) => ({ name, ...v }))
        .sort((a, b) => b.value - a.value),
      byLocation: Object.entries(byLocation)
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => b.value - a.value),
      lowStock,
      rows: rows.sort((a, b) => b.totalValue - a.totalValue).slice(0, 50),
    },
  });
}
