import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { purchaseOrderUpdateSchema } from "@/lib/validators/purchase";
import { handleApiError } from "@/lib/api-error";

function canMutate(role: string) {
  return role === "ADMIN" || role === "MANAGER";
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
    }

    const { id } = await params;
    const order = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: true,
        createdBy: { select: { id: true, name: true, email: true } },
        items: { include: { productVariant: { include: { product: true } } } },
        receipts: {
          include: { location: true, items: { include: { productVariant: true, batch: true } } },
          orderBy: { receivedAt: "desc" },
        },
      },
    });

    if (!order) {
      return Response.json({ error: { code: "NOT_FOUND", message: "Purchase order not found" } }, { status: 404 });
    }

    return Response.json({ data: order });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
    }

    const role = (session.user as unknown as { role: string }).role;
    if (!canMutate(role)) {
      return Response.json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 });
    }

    const { id } = await params;
    const existing = await prisma.purchaseOrder.findUnique({ where: { id } });
    if (!existing) {
      return Response.json({ error: { code: "NOT_FOUND", message: "Purchase order not found" } }, { status: 404 });
    }
    if (existing.status === "RECEIVED") {
      return Response.json(
        { error: { code: "CONFLICT", message: "Received purchase orders cannot be edited" } },
        { status: 409 }
      );
    }

    const parsed = purchaseOrderUpdateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        { error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() } },
        { status: 400 }
      );
    }

    const order = await prisma.purchaseOrder.update({
      where: { id },
      data: {
        expectedDate: parsed.data.expectedDate ? new Date(parsed.data.expectedDate) : undefined,
        notes: parsed.data.notes,
        status: parsed.data.status,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "UPDATE",
        entityType: "PurchaseOrder",
        entityId: id,
        oldValue: { status: existing.status },
        newValue: { status: order.status },
      },
    });

    return Response.json({ data: order });
  } catch (error) {
    return handleApiError(error);
  }
}
