import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { orderPaymentSchema } from "@/lib/validators/sales";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return Response.json(
      { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      customer: true,
      salesChannel: true,
      location: true,
      createdBy: { select: { id: true, name: true, email: true } },
      items: {
        include: {
          productVariant: {
            select: {
              id: true,
              sku: true,
              size: true,
              color: true,
              colorHex: true,
              product: { select: { id: true, name: true, skuPrefix: true } },
            },
          },
          batch: { select: { id: true, batchNumber: true } },
        },
      },
      statusHistory: {
        include: { changedBy: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!order) {
    return Response.json({ error: { code: "NOT_FOUND", message: "Order not found" } }, { status: 404 });
  }

  return Response.json({ data: order });
}

// PATCH only handles payment updates (other edits would go through status transition or item-level edits)
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return Response.json(
      { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  const role = (session.user as unknown as { role: string }).role;
  if (role === "VIEWER") {
    return Response.json({ error: { code: "FORBIDDEN", message: "Read-only role" } }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.order.findUnique({ where: { id } });
  if (!existing) {
    return Response.json({ error: { code: "NOT_FOUND", message: "Order not found" } }, { status: 404 });
  }

  const body = await request.json();
  const parsed = orderPaymentSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() } },
      { status: 400 }
    );
  }

  const data: Prisma.OrderUpdateInput = {
    paymentStatus: parsed.data.paymentStatus,
  };
  if (parsed.data.paymentMethod !== undefined) data.paymentMethod = parsed.data.paymentMethod;
  if (parsed.data.paymentReference !== undefined) data.paymentReference = parsed.data.paymentReference;

  const updated = await prisma.order.update({ where: { id }, data });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "ORDER_PAYMENT_UPDATED",
      entityType: "Order",
      entityId: id,
      oldValue: { paymentStatus: existing.paymentStatus },
      newValue: { paymentStatus: updated.paymentStatus },
    },
  });

  return Response.json({ data: updated });
}
