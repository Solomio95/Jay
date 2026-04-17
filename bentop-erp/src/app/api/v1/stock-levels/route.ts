import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { reorderPointSchema } from "@/lib/validators/inventory";
import type { Prisma } from "@prisma/client";
import { handleApiError } from "@/lib/api-error";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }
  
    const searchParams = request.nextUrl.searchParams;
    const locationId = searchParams.get("locationId") || "";
    const productVariantId = searchParams.get("productVariantId") || "";
    const productId = searchParams.get("productId") || "";
    const search = searchParams.get("search") || "";
    const lowStockOnly = searchParams.get("lowStockOnly") === "true";
    const outOfStockOnly = searchParams.get("outOfStockOnly") === "true";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const pageSize = Math.min(200, Math.max(1, parseInt(searchParams.get("pageSize") || "50")));
  
    const where: Prisma.StockLevelWhereInput = {};
    if (locationId) where.locationId = locationId;
    if (productVariantId) where.productVariantId = productVariantId;
    if (productId) where.productVariant = { productId };
    if (outOfStockOnly) where.quantityOnHand = { lte: 0 };
  
    if (search) {
      where.productVariant = {
        ...(where.productVariant as object),
        OR: [
          { sku: { contains: search, mode: "insensitive" } },
          { product: { name: { contains: search, mode: "insensitive" } } },
          { product: { skuPrefix: { contains: search, mode: "insensitive" } } },
        ],
      };
    }
  
    const [rawLevels, total] = await Promise.all([
      prisma.stockLevel.findMany({
        where,
        include: {
          productVariant: {
            include: {
              product: { select: { id: true, name: true, skuPrefix: true } },
            },
          },
          location: { select: { id: true, name: true, type: true } },
          batch: { select: { id: true, batchNumber: true, expiryDate: true } },
        },
        orderBy: [{ location: { name: "asc" } }, { productVariant: { sku: "asc" } }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.stockLevel.count({ where }),
    ]);
  
    // Filter for low stock if requested (Prisma cannot compare two columns natively)
    const levels = lowStockOnly
      ? rawLevels.filter(
          (l) => l.reorderPoint > 0 && l.quantityOnHand <= l.reorderPoint && l.quantityOnHand > 0
        )
      : rawLevels;
  
    return Response.json({
      data: levels,
      pagination: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }
  
    const role = (session.user as unknown as { role: string }).role;
    if (role !== "ADMIN" && role !== "MANAGER") {
      return Response.json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 });
    }
  
    const body = await request.json();
    const parsed = reorderPointSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() } },
        { status: 400 }
      );
    }
  
    const { productVariantId, locationId, reorderPoint, reorderQuantity, binLocation } = parsed.data;
  
    // Upsert a stock level row with no batch scope (batchId: null reserved slot)
    const existing = await prisma.stockLevel.findFirst({
      where: { productVariantId, locationId, batchId: null },
    });
  
    const updated = existing
      ? await prisma.stockLevel.update({
          where: { id: existing.id },
          data: { reorderPoint, reorderQuantity, binLocation: binLocation ?? existing.binLocation },
        })
      : await prisma.stockLevel.create({
          data: {
            productVariantId,
            locationId,
            reorderPoint,
            reorderQuantity,
            binLocation,
          },
        });
  
    return Response.json({ data: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
