import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export type InventoryReportFilters = {
  locationId?: string | null;
  productId?: string | null;
  productVariantId?: string | null;
  search?: string | null;
};

type InventoryReportStockLevel = {
  quantityOnHand: number;
  quantityReserved: number;
  reorderPoint?: number;
  reorderQuantity?: number;
  productVariant: {
    id: string;
    sku: string;
    size: string | null;
    color: string | null;
    additionalCost: unknown;
    product: {
      id: string;
      name: string;
      skuPrefix?: string | null;
      baseCostMyr: unknown;
      categoryId: string;
    };
  };
  location: { id: string; name: string; type: string };
};

type InventoryReportCategory = { id: string; name: string };

export async function getInventoryReport(filters: InventoryReportFilters = {}) {
  const where = buildInventoryStockWhere(filters);

  const stockLevels = await prisma.stockLevel.findMany({
    where: {
      ...where,
      batchId: null,
      quantityOnHand: { gt: 0 },
    },
    include: {
      productVariant: {
        include: {
          product: {
            select: { id: true, name: true, skuPrefix: true, baseCostMyr: true, categoryId: true },
          },
        },
      },
      location: { select: { id: true, name: true, type: true } },
    },
  });

  const categoryIds = [...new Set(stockLevels.map((level) => level.productVariant.product.categoryId))];
  const categories = await prisma.category.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true, name: true },
  });

  const lowStockLevels = await prisma.stockLevel.findMany({
    where: {
      ...where,
      batchId: null,
      reorderPoint: { gt: 0 },
    },
    include: {
      productVariant: {
        include: {
          product: {
            select: { id: true, name: true, skuPrefix: true, baseCostMyr: true, categoryId: true },
          },
        },
      },
      location: { select: { id: true, name: true, type: true } },
    },
  });

  return buildInventoryReportData({ stockLevels, categories, lowStockLevels });
}

export function buildInventoryStockWhere(filters: InventoryReportFilters) {
  const where: Prisma.StockLevelWhereInput = {};

  if (filters.locationId) where.locationId = filters.locationId;
  if (filters.productVariantId) where.productVariantId = filters.productVariantId;
  if (filters.productId) where.productVariant = { productId: filters.productId };
  if (filters.search) {
    where.productVariant = {
      ...(where.productVariant as object),
      OR: [
        { sku: { contains: filters.search, mode: "insensitive" } },
        { product: { name: { contains: filters.search, mode: "insensitive" } } },
        { product: { skuPrefix: { contains: filters.search, mode: "insensitive" } } },
      ],
    };
  }

  return where;
}

export function buildInventoryReportData({
  stockLevels,
  categories,
  lowStockLevels,
}: {
  stockLevels: InventoryReportStockLevel[];
  categories: InventoryReportCategory[];
  lowStockLevels: InventoryReportStockLevel[];
}) {
  const categoryMap = new Map(categories.map((category) => [category.id, category.name]));
  const rows = stockLevels.map((level) => {
    const unitCost = Number(level.productVariant.product.baseCostMyr) + Number(level.productVariant.additionalCost);
    const onHand = level.quantityOnHand;
    const reserved = level.quantityReserved;
    const available = onHand - reserved;
    const totalValue = onHand * unitCost;

    return {
      variantId: level.productVariant.id,
      productId: level.productVariant.product.id,
      sku: level.productVariant.sku,
      productName: level.productVariant.product.name,
      parentSku: level.productVariant.product.skuPrefix ?? "",
      size: level.productVariant.size,
      color: level.productVariant.color,
      categoryName: categoryMap.get(level.productVariant.product.categoryId) ?? "Uncategorized",
      locationId: level.location.id,
      locationName: level.location.name,
      locationType: level.location.type,
      onHand,
      reserved,
      available,
      unitCost,
      totalValue,
    };
  });

  const totalUnits = rows.reduce((sum, row) => sum + row.onHand, 0);
  const totalReserved = rows.reduce((sum, row) => sum + row.reserved, 0);
  const totalAvailable = rows.reduce((sum, row) => sum + row.available, 0);
  const totalValue = rows.reduce((sum, row) => sum + row.totalValue, 0);

  const byCategory: Record<string, { units: number; reserved: number; available: number; value: number }> = {};
  const byLocation: Record<string, { name: string; type: string; units: number; reserved: number; available: number; value: number }> = {};

  for (const row of rows) {
    const category = byCategory[row.categoryName] ?? { units: 0, reserved: 0, available: 0, value: 0 };
    category.units += row.onHand;
    category.reserved += row.reserved;
    category.available += row.available;
    category.value += row.totalValue;
    byCategory[row.categoryName] = category;

    const location = byLocation[row.locationId] ?? {
      name: row.locationName,
      type: row.locationType,
      units: 0,
      reserved: 0,
      available: 0,
      value: 0,
    };
    location.units += row.onHand;
    location.reserved += row.reserved;
    location.available += row.available;
    location.value += row.totalValue;
    byLocation[row.locationId] = location;
  }

  const lowStock = lowStockLevels
    .filter((level) => level.quantityOnHand - level.quantityReserved <= (level.reorderPoint ?? 0))
    .map((level) => ({
      sku: level.productVariant.sku,
      productName: level.productVariant.product.name,
      size: level.productVariant.size,
      color: level.productVariant.color,
      locationName: level.location.name,
      available: level.quantityOnHand - level.quantityReserved,
      reorderPoint: level.reorderPoint ?? 0,
      reorderQuantity: level.reorderQuantity ?? 0,
    }))
    .sort((a, b) => a.available - b.available);

  return {
    summary: { totalUnits, totalReserved, totalAvailable, totalValue, lowStockCount: lowStock.length },
    byCategory: Object.entries(byCategory)
      .map(([name, values]) => ({ name, ...values }))
      .sort((a, b) => b.value - a.value),
    byLocation: Object.entries(byLocation)
      .map(([id, values]) => ({ id, ...values }))
      .sort((a, b) => b.value - a.value),
    lowStock,
    rows: rows.sort((a, b) => b.totalValue - a.totalValue).slice(0, 50),
  };
}
