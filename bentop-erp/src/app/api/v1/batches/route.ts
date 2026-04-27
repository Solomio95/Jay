import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";

const batchCreateSchema = z.object({
  productVariantId: z.string().min(1),
  batchNumber: z.string().min(1).max(100),
  quantityProduced: z.number().int().positive(),
  productionDate: z.string().datetime({ offset: true }),
  expiryDate: z.string().datetime({ offset: true }).optional(),
  supplierName: z.string().max(200).optional(),
  costPerUnitMyr: z.number().nonnegative(),
  notes: z.string().max(2000).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const sp = request.nextUrl.searchParams;
    const search = sp.get("search")?.trim() ?? "";
    const variantId = sp.get("variantId");
    const limit = Math.min(parseInt(sp.get("limit") ?? "50", 10), 200);
    const page = Math.max(parseInt(sp.get("page") ?? "1", 10), 1);

    const where: Record<string, unknown> = {};
    if (variantId) where.productVariantId = variantId;
    if (search) {
      where.OR = [
        { batchNumber: { contains: search, mode: "insensitive" } },
        { supplierName: { contains: search, mode: "insensitive" } },
        { productVariant: { sku: { contains: search, mode: "insensitive" } } },
        { productVariant: { product: { name: { contains: search, mode: "insensitive" } } } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.batch.findMany({
        where,
        include: {
          productVariant: {
            select: {
              sku: true, size: true, color: true,
              product: { select: { name: true } },
            },
          },
          _count: { select: { stockLevels: true, movements: true } },
        },
        orderBy: { productionDate: "desc" },
        take: limit,
        skip: (page - 1) * limit,
      }),
      prisma.batch.count({ where }),
    ]);

    return Response.json({ data: items, meta: { total, page, limit } });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const role = (session.user as unknown as { role: string }).role;
    if (role === "VIEWER") {
      return Response.json(
        { error: { code: "FORBIDDEN", message: "Read-only role" } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = batchCreateSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() } },
        { status: 400 }
      );
    }

    const existing = await prisma.batch.findUnique({ where: { batchNumber: parsed.data.batchNumber } });
    if (existing) {
      return Response.json(
        { error: { code: "CONFLICT", message: "Batch number already exists" } },
        { status: 409 }
      );
    }

    const { costPerUnitMyr, productionDate, expiryDate, ...rest } = parsed.data;
    const batch = await prisma.batch.create({
      data: {
        ...rest,
        costPerUnitMyr: costPerUnitMyr,
        productionDate: new Date(productionDate),
        expiryDate: expiryDate ? new Date(expiryDate) : null,
      },
      include: {
        productVariant: {
          select: { sku: true, size: true, color: true, product: { select: { name: true } } },
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CREATE",
        entityType: "Batch",
        entityId: batch.id,
        newValue: { batchNumber: batch.batchNumber, quantityProduced: batch.quantityProduced },
      },
    });

    return Response.json({ data: batch }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
