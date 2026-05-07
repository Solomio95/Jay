import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";
import { csvResponse } from "@/lib/csv/response";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
    }

    const locationId = request.nextUrl.searchParams.get("locationId") || undefined;
    const rows = await prisma.stockLevel.findMany({
      where: { batchId: null, ...(locationId ? { locationId } : {}) },
      include: {
        location: true,
        productVariant: { include: { product: { include: { category: true } } } },
      },
      orderBy: [{ location: { name: "asc" } }, { productVariant: { sku: "asc" } }],
    });

    return csvResponse(
      `bentop-stock-${dateStamp()}.csv`,
      rows.map((row) => ({
        locationName: row.location.name,
        locationType: row.location.type,
        productName: row.productVariant.product.name,
        parentSku: row.productVariant.product.skuPrefix,
        sku: row.productVariant.sku,
        barcode: row.productVariant.barcode,
        category: row.productVariant.product.category.name,
        size: row.productVariant.size,
        color: row.productVariant.color,
        onHand: row.quantityOnHand,
        reserved: row.quantityReserved,
        available: row.quantityOnHand - row.quantityReserved,
        reorderPoint: row.reorderPoint,
        reorderQuantity: row.reorderQuantity,
        binLocation: row.binLocation,
      }))
    );
  } catch (error) {
    return handleApiError(error);
  }
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}
