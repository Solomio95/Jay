import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import type { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return Response.json(
      { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const movementType = searchParams.get("movementType");
  const locationId = searchParams.get("locationId");
  const productVariantId = searchParams.get("productVariantId");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "30")));

  const where: Prisma.StockMovementWhereInput = {};
  if (movementType) where.movementType = movementType as Prisma.StockMovementWhereInput["movementType"];
  if (locationId) where.OR = [{ fromLocationId: locationId }, { toLocationId: locationId }];
  if (productVariantId) where.productVariantId = productVariantId;

  const [movements, total] = await Promise.all([
    prisma.stockMovement.findMany({
      where,
      include: {
        productVariant: {
          select: {
            id: true,
            sku: true,
            size: true,
            color: true,
            product: { select: { name: true, skuPrefix: true } },
          },
        },
        fromLocation: { select: { id: true, name: true } },
        toLocation: { select: { id: true, name: true } },
        performedBy: { select: { id: true, name: true } },
        batch: { select: { id: true, batchNumber: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.stockMovement.count({ where }),
  ]);

  return Response.json({
    data: movements,
    pagination: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
  });
}
