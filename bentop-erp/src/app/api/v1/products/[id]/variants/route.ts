import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { variantGenerateSchema, variantUpdateSchema } from "@/lib/validators/product";
import { generateSku, generateBarcode } from "@/lib/sku";
import { handleApiError } from "@/lib/api-error";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
  }

  const { id } = await params;

  const variants = await prisma.productVariant.findMany({
    where: { productId: id },
    include: {
      _count: { select: { stockLevels: true, orderItems: true } },
    },
    orderBy: [{ color: "asc" }, { size: "asc" }],
  });

  return Response.json({ data: variants });
}

// Generate variants from size × color matrix
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
  }

  const role = (session.user as unknown as { role: string }).role;
  if (role !== "ADMIN" && role !== "MANAGER") {
    return Response.json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = variantGenerateSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({
      error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() },
    }, { status: 400 });
  }

  const product = await prisma.product.findUnique({
    where: { id },
    select: { id: true, skuPrefix: true },
  });

  if (!product) {
    return Response.json({ error: { code: "NOT_FOUND", message: "Product not found" } }, { status: 404 });
  }

  const { sizes, colors } = parsed.data;
  const created: string[] = [];
  const skipped: string[] = [];

  for (const color of colors) {
    for (const size of sizes) {
      // Use explicit code if provided, otherwise derive from first 3 letters of name
      const colorCode = color.code ?? color.name.substring(0, 3).toUpperCase();
      const sku = generateSku(product.skuPrefix, colorCode, size);

      // Check if variant already exists
      const existing = await prisma.productVariant.findUnique({ where: { sku } });
      if (existing) {
        skipped.push(sku);
        continue;
      }

      await prisma.productVariant.create({
        data: {
          productId: id,
          sku,
          size,
          color: color.name,
          colorHex: color.hex,
          barcode: generateBarcode(),
        },
      });
      created.push(sku);
    }
  }

  const variants = await prisma.productVariant.findMany({
    where: { productId: id },
    orderBy: [{ color: "asc" }, { size: "asc" }],
  });

  return Response.json({
    data: variants,
    meta: { created: created.length, skipped: skipped.length, skippedSkus: skipped },
  }, { status: 201 });
}

// Update a single variant
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
  }

  const role = (session.user as unknown as { role: string }).role;
  if (role !== "ADMIN" && role !== "MANAGER") {
    return Response.json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 });
  }

  const body = await request.json();
  const { variantId, ...updates } = body;

  if (!variantId) {
    return Response.json({ error: { code: "VALIDATION_ERROR", message: "variantId is required" } }, { status: 400 });
  }

  const parsed = variantUpdateSchema.safeParse(updates);
  if (!parsed.success) {
    return Response.json({
      error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() },
    }, { status: 400 });
  }

  const variant = await prisma.productVariant.update({
    where: { id: variantId },
    data: parsed.data,
  });

  return Response.json({ data: variant });
}
