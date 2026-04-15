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

  const searchParams = request.nextUrl.searchParams;
  const search = searchParams.get("search") || "";
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20")));

  const variants = await prisma.productVariant.findMany({
    where: {
      isActive: true,
      ...(search
        ? {
            OR: [
              { sku: { contains: search, mode: "insensitive" } },
              { barcode: { contains: search, mode: "insensitive" } },
              { product: { name: { contains: search, mode: "insensitive" } } },
              { product: { skuPrefix: { contains: search, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    include: { product: { select: { id: true, name: true, skuPrefix: true } } },
    orderBy: [{ product: { name: "asc" } }, { color: "asc" }, { size: "asc" }],
    take: limit,
  });

  return Response.json({
    data: variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      size: v.size,
      color: v.color,
      colorHex: v.colorHex,
      barcode: v.barcode,
      productId: v.product.id,
      productName: v.product.name,
      productSkuPrefix: v.product.skuPrefix,
    })),
  });
}
