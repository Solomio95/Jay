import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getAllowedPromoterLocationIds } from "@/lib/promoter/access";
import { handleApiError } from "@/lib/api-error";

type StockRow = {
  productId: string;
  productName: string;
  parentSku: string;
  variantId: string;
  sku: string;
  barcode: string | null;
  color: string;
  size: string;
  locationId: string;
  locationName: string;
  locationType: string;
  isCurrentLocation: boolean;
  quantityOnHand: number;
  quantityReserved: number;
  available: number;
};

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { temporaryLocations: true },
    });

    if (!user || user.role !== "PROMOTER") {
      return Response.json(
        { error: { code: "FORBIDDEN", message: "Promoter access required" } },
        { status: 403 },
      );
    }

    const url = new URL(request.url);
    const requestedLocationId = url.searchParams.get("locationId") ?? user.defaultLocationId;
    const search = url.searchParams.get("search")?.trim() ?? "";

    const allowedLocationIds = getAllowedPromoterLocationIds({
      now: new Date(),
      defaultLocationId: user.defaultLocationId,
      temporaryLocations: user.temporaryLocations,
    });

    if (!requestedLocationId || !allowedLocationIds.includes(requestedLocationId)) {
      return Response.json(
        { error: { code: "FORBIDDEN", message: "Location is not allowed" } },
        { status: 403 },
      );
    }

    const variantSearch: Prisma.ProductVariantWhereInput | undefined = search
      ? {
          OR: [
            { sku: { contains: search, mode: "insensitive" } },
            { barcode: { contains: search, mode: "insensitive" } },
            { product: { name: { contains: search, mode: "insensitive" } } },
            { product: { skuPrefix: { contains: search, mode: "insensitive" } } },
          ],
        }
      : undefined;

    const levels = await prisma.stockLevel.findMany({
      where: {
        batchId: null,
        location: { isActive: true },
        productVariant: {
          isActive: true,
          ...(variantSearch ?? {}),
        },
      },
      include: {
        location: { select: { id: true, name: true, type: true } },
        productVariant: {
          include: {
            product: { select: { id: true, name: true, skuPrefix: true } },
          },
        },
      },
      orderBy: [
        { productVariant: { product: { skuPrefix: "asc" } } },
        { productVariant: { sku: "asc" } },
        { location: { name: "asc" } },
      ],
      take: 1000,
    });

    const rows: StockRow[] = levels.map((level) => ({
      productId: level.productVariant.product.id,
      productName: level.productVariant.product.name,
      parentSku: level.productVariant.product.skuPrefix,
      variantId: level.productVariant.id,
      sku: level.productVariant.sku,
      barcode: level.productVariant.barcode,
      color: level.productVariant.color,
      size: level.productVariant.size,
      locationId: level.locationId,
      locationName: level.location.name,
      locationType: level.location.type,
      isCurrentLocation: level.locationId === requestedLocationId,
      quantityOnHand: level.quantityOnHand,
      quantityReserved: level.quantityReserved,
      available: Math.max(0, level.quantityOnHand - level.quantityReserved),
    }));

    return Response.json({
      data: {
        currentLocationId: requestedLocationId,
        currentLocationRows: rows.filter((row) => row.isCurrentLocation),
        otherLocationRows: rows.filter((row) => !row.isCurrentLocation),
        products: groupRowsByProduct(rows),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

function groupRowsByProduct(rows: StockRow[]) {
  const products = new Map<
    string,
    {
      productId: string;
      productName: string;
      parentSku: string;
      variants: Array<StockRow & { locations: StockRow[] }>;
    }
  >();

  for (const row of rows) {
    const product = products.get(row.productId) ?? {
      productId: row.productId,
      productName: row.productName,
      parentSku: row.parentSku,
      variants: [],
    };

    const variant = product.variants.find((item) => item.variantId === row.variantId);
    if (variant) {
      variant.locations.push(row);
    } else {
      product.variants.push({ ...row, locations: [row] });
    }

    products.set(row.productId, product);
  }

  return Array.from(products.values());
}
