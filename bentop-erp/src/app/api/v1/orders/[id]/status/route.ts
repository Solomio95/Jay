import { NextRequest } from "next/server";
import type { OrderStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { orderStatusUpdateSchema } from "@/lib/validators/sales";
import { handleApiError } from "@/lib/api-error";

// Allowed transitions. Terminal states (DELIVERED, CANCELLED, RETURNED) can't exit
// except DELIVERED → RETURNED.
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  DRAFT: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["PACKED", "CANCELLED"],
  PACKED: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED", "RETURNED"],
  DELIVERED: ["RETURNED"],
  CANCELLED: [],
  RETURNED: [],
};

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
      return Response.json({ error: { code: "FORBIDDEN", message: "Read-only role" } }, { status: 403 });
    }
  
    const userId = session.user.id;
    const { id } = await params;
  
    const body = await request.json();
    const parsed = orderStatusUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() } },
        { status: 400 }
      );
    }
    const { toStatus, reason } = parsed.data;
  
    const order = await prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!order) {
      return Response.json({ error: { code: "NOT_FOUND", message: "Order not found" } }, { status: 404 });
    }
  
    const fromStatus = order.status;
    const allowed = TRANSITIONS[fromStatus];
    if (!allowed.includes(toStatus)) {
      return Response.json(
        {
          error: {
            code: "INVALID_TRANSITION",
            message: `Cannot transition from ${fromStatus} to ${toStatus}`,
          },
        },
        { status: 409 }
      );
    }
  
    // CANCELLED from SHIPPED onward requires ADMIN/MANAGER
    if (toStatus === "CANCELLED" && (fromStatus === "PROCESSING" || fromStatus === "PACKED")) {
      if (role !== "ADMIN" && role !== "MANAGER") {
        return Response.json(
          { error: { code: "FORBIDDEN", message: "Only managers can cancel after processing" } },
          { status: 403 }
        );
      }
    }
  
    if (!order.locationId) {
      return Response.json(
        { error: { code: "INVALID_STATE", message: "Order has no fulfillment location" } },
        { status: 409 }
      );
    }
    const locationId = order.locationId;
  
    const result = await prisma.$transaction(async (tx) => {
      // Side effects per transition
      if (fromStatus === "DRAFT" && toStatus === "CONFIRMED") {
        // Reserve stock
        for (const item of order.items) {
          const available = await tx.stockLevel.aggregate({
            where: {
              productVariantId: item.productVariantId,
              locationId,
              batchId: { not: null },
            },
            _sum: { quantityOnHand: true },
          });
          const aggregate = await tx.stockLevel.findFirst({
            where: { productVariantId: item.productVariantId, locationId, batchId: null },
          });
          const onHand = available._sum.quantityOnHand ?? 0;
          const reserved = aggregate?.quantityReserved ?? 0;
          if (onHand - reserved < item.quantity) {
            throw new Error(
              `INSUFFICIENT_STOCK:Only ${onHand - reserved} available for variant ${item.productVariantId}, requested ${item.quantity}`
            );
          }
          if (aggregate) {
            await tx.stockLevel.update({
              where: { id: aggregate.id },
              data: { quantityReserved: { increment: item.quantity } },
            });
          } else {
            await tx.stockLevel.create({
              data: {
                productVariantId: item.productVariantId,
                locationId,
                batchId: null,
                quantityOnHand: 0,
                quantityReserved: item.quantity,
              },
            });
          }
        }
      }
  
      if (toStatus === "PROCESSING" && (fromStatus === "CONFIRMED")) {
        // Deduct stock FIFO; movements; decrement aggregate onHand + release reservation
        for (const item of order.items) {
          let remaining = item.quantity;
  
          const sourceRows = await tx.stockLevel.findMany({
            where: item.batchId
              ? {
                  productVariantId: item.productVariantId,
                  locationId,
                  batchId: item.batchId,
                  quantityOnHand: { gt: 0 },
                }
              : {
                  productVariantId: item.productVariantId,
                  locationId,
                  batchId: { not: null },
                  quantityOnHand: { gt: 0 },
                },
            include: { batch: true },
            orderBy: { batch: { productionDate: "asc" } },
          });
  
          for (const row of sourceRows) {
            if (remaining <= 0) break;
            const take = Math.min(remaining, row.quantityOnHand);
            await tx.stockLevel.update({
              where: { id: row.id },
              data: { quantityOnHand: { decrement: take } },
            });
            await tx.stockMovement.create({
              data: {
                productVariantId: item.productVariantId,
                batchId: row.batchId,
                fromLocationId: locationId,
                movementType: "OUTBOUND",
                quantity: take,
                referenceNumber: order.orderNumber,
                reason: "SALE",
                performedById: userId,
              },
            });
            remaining -= take;
          }
  
          if (remaining > 0) {
            throw new Error(
              `INSUFFICIENT_STOCK:Not enough on-hand stock to fulfill variant ${item.productVariantId}`
            );
          }
  
          // Decrement aggregate onHand + release reservation
          const aggregate = await tx.stockLevel.findFirst({
            where: { productVariantId: item.productVariantId, locationId, batchId: null },
          });
          if (aggregate) {
            await tx.stockLevel.update({
              where: { id: aggregate.id },
              data: {
                quantityOnHand: { decrement: item.quantity },
                quantityReserved: { decrement: item.quantity },
              },
            });
          }
        }
      }
  
      if (toStatus === "CANCELLED") {
        // If reservation still exists (CONFIRMED → CANCELLED), release it.
        // If stock was already deducted (PROCESSING → CANCELLED or PACKED → CANCELLED), restore it as an aggregate add.
        const reservationActive = fromStatus === "CONFIRMED";
        const stockAlreadyDeducted = fromStatus === "PROCESSING" || fromStatus === "PACKED";
  
        if (reservationActive) {
          for (const item of order.items) {
            const aggregate = await tx.stockLevel.findFirst({
              where: { productVariantId: item.productVariantId, locationId, batchId: null },
            });
            if (aggregate) {
              await tx.stockLevel.update({
                where: { id: aggregate.id },
                data: { quantityReserved: { decrement: item.quantity } },
              });
            }
          }
        }
  
        if (stockAlreadyDeducted) {
          // Put stock back on aggregate only (we don't know which specific batches to credit back cleanly);
          // record a RETURN movement for audit.
          for (const item of order.items) {
            const aggregate = await tx.stockLevel.findFirst({
              where: { productVariantId: item.productVariantId, locationId, batchId: null },
            });
            if (aggregate) {
              await tx.stockLevel.update({
                where: { id: aggregate.id },
                data: { quantityOnHand: { increment: item.quantity } },
              });
            } else {
              await tx.stockLevel.create({
                data: {
                  productVariantId: item.productVariantId,
                  locationId,
                  batchId: null,
                  quantityOnHand: item.quantity,
                },
              });
            }
            await tx.stockMovement.create({
              data: {
                productVariantId: item.productVariantId,
                toLocationId: locationId,
                movementType: "RETURN",
                quantity: item.quantity,
                referenceNumber: order.orderNumber,
                reason: "ORDER_CANCELLED",
                performedById: userId,
              },
            });
          }
        }
      }
  
      if (toStatus === "RETURNED") {
        // Stock was already deducted in PROCESSING; restore on aggregate + create RETURN movements.
        for (const item of order.items) {
          const aggregate = await tx.stockLevel.findFirst({
            where: { productVariantId: item.productVariantId, locationId, batchId: null },
          });
          if (aggregate) {
            await tx.stockLevel.update({
              where: { id: aggregate.id },
              data: { quantityOnHand: { increment: item.quantity } },
            });
          } else {
            await tx.stockLevel.create({
              data: {
                productVariantId: item.productVariantId,
                locationId,
                batchId: null,
                quantityOnHand: item.quantity,
              },
            });
          }
          await tx.stockMovement.create({
            data: {
              productVariantId: item.productVariantId,
              toLocationId: locationId,
              movementType: "RETURN",
              quantity: item.quantity,
              referenceNumber: order.orderNumber,
              reason: "ORDER_RETURNED",
              performedById: userId,
            },
          });
        }
      }
  
      // Update order
      const updateData: Prisma.OrderUpdateInput = { status: toStatus };
      if (toStatus === "DELIVERED" && order.paymentStatus === "UNPAID") {
        // leave payment alone; UI can manage
      }
      const updated = await tx.order.update({
        where: { id },
        data: updateData,
      });
  
      await tx.orderStatusHistory.create({
        data: {
          orderId: id,
          fromStatus,
          toStatus,
          changedById: userId,
          reason: reason ?? null,
        },
      });
  
      await tx.auditLog.create({
        data: {
          userId,
          action: `ORDER_${toStatus}`,
          entityType: "Order",
          entityId: id,
          oldValue: { status: fromStatus },
          newValue: { status: toStatus, orderNumber: order.orderNumber },
        },
      });
  
      return updated;
    }).catch((e: unknown) => {
      const msg = e instanceof Error ? e.message : "Unknown error";
      if (msg.startsWith("INSUFFICIENT_STOCK:")) {
        return { __error: "INSUFFICIENT_STOCK", message: msg.slice("INSUFFICIENT_STOCK:".length) } as const;
      }
      throw e;
    });
  
    if (result && "__error" in result) {
      return Response.json(
        { error: { code: result.__error, message: result.message } },
        { status: 409 }
      );
    }
  
    return Response.json({ data: result });
  } catch (error) {
    return handleApiError(error);
  }
}
