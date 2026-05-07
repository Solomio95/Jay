import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";
import { csvResponse } from "@/lib/csv/response";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
    }

    const variants = await prisma.productVariant.findMany({
      include: { product: { include: { category: true } } },
      orderBy: [{ product: { skuPrefix: "asc" } }, { sku: "asc" }],
    });

    return csvResponse(
      `bentop-products-${new Date().toISOString().slice(0, 10)}.csv`,
      variants.map((variant) => ({
        productName: variant.product.name,
        parentSku: variant.product.skuPrefix,
        categoryName: variant.product.category.name,
        sku: variant.sku,
        barcode: variant.barcode,
        size: variant.size,
        color: variant.color,
        sellingPriceMyr: Number(variant.sellingPriceMyr).toFixed(2),
        baseCostMyr: Number(variant.product.baseCostMyr).toFixed(2),
        additionalCostMyr: Number(variant.additionalCost).toFixed(2),
        active: variant.isActive,
      }))
    );
  } catch (error) {
    return handleApiError(error);
  }
}
