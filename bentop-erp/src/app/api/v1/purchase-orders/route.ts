import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { purchaseOrderCreateSchema } from "@/lib/validators/purchase";
import { generatePurchaseOrderNumber } from "@/lib/utils";
import { handleApiError } from "@/lib/api-error";
import { canManagePurchases, forbiddenResponse } from "@/lib/permissions";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
    }

    const status = request.nextUrl.searchParams.get("status") || undefined;
    const supplierId = request.nextUrl.searchParams.get("supplierId") || undefined;

    const orders = await prisma.purchaseOrder.findMany({
      where: {
        ...(status ? { status: status as never } : {}),
        ...(supplierId ? { supplierId } : {}),
      },
      include: {
        supplier: { select: { id: true, name: true } },
        items: {
          include: {
            productVariant: {
              include: { product: { select: { name: true, skuPrefix: true } } },
            },
          },
        },
        _count: { select: { receipts: true } },
      },
      orderBy: { orderDate: "desc" },
      take: 100,
    });

    return Response.json({ data: orders });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
    }

    const role = (session.user as unknown as { role: string }).role;
    if (!canManagePurchases(role)) {
      return forbiddenResponse();
    }

    const parsed = purchaseOrderCreateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        { error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() } },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const supplier = await prisma.supplier.findUnique({ where: { id: data.supplierId } });
    if (!supplier || !supplier.isActive) {
      return Response.json({ error: { code: "NOT_FOUND", message: "Supplier not found or inactive" } }, { status: 404 });
    }

    const variantIds = [...new Set(data.items.map((item) => item.productVariantId))];
    const variants = await prisma.productVariant.findMany({
      where: { id: { in: variantIds }, isActive: true },
      select: { id: true },
    });
    if (variants.length !== variantIds.length) {
      return Response.json(
        { error: { code: "NOT_FOUND", message: "One or more variants not found or inactive" } },
        { status: 404 }
      );
    }

    const mergedItems = Array.from(
      data.items
        .reduce((map, item) => {
          const existing = map.get(item.productVariantId);
          if (existing) {
            existing.quantityOrdered += item.quantityOrdered;
            existing.notes = [existing.notes, item.notes].filter(Boolean).join("; ") || undefined;
          } else {
            map.set(item.productVariantId, { ...item });
          }
          return map;
        }, new Map<string, (typeof data.items)[number]>())
        .values()
    );

    const order = await prisma.purchaseOrder.create({
      data: {
        orderNumber: generatePurchaseOrderNumber(),
        supplierId: data.supplierId,
        status: "ORDERED",
        orderDate: data.orderDate ? new Date(data.orderDate) : new Date(),
        expectedDate: data.expectedDate ? new Date(data.expectedDate) : undefined,
        notes: data.notes,
        createdById: session.user.id,
        items: {
          create: mergedItems.map((item) => ({
            productVariantId: item.productVariantId,
            quantityOrdered: item.quantityOrdered,
            costPerUnitMyr: item.costPerUnitMyr,
            notes: item.notes,
          })),
        },
      },
      include: {
        supplier: true,
        items: { include: { productVariant: { include: { product: true } } } },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CREATE",
        entityType: "PurchaseOrder",
        entityId: order.id,
        newValue: {
          orderNumber: order.orderNumber,
          supplierId: order.supplierId,
          totalUnits: mergedItems.reduce((sum, item) => sum + item.quantityOrdered, 0),
        },
      },
    });

    return Response.json({ data: order }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
