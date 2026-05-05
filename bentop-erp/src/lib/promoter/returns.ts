import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getAllowedPromoterLocationIds } from "./access";
import type { PromoterReturnInput } from "@/lib/validators/promoter";

export async function createPromoterReturn(input: {
  userId: string;
  data: PromoterReturnInput;
}) {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    include: { temporaryLocations: true },
  });

  if (!user || user.role !== "PROMOTER") {
    throw new Error("PROMOTER_ACCESS_REQUIRED");
  }

  const order = await prisma.order.findUnique({
    where: { id: input.data.orderId },
    include: {
      items: true,
    },
  });

  if (!order || !order.locationId) {
    throw new Error("PROMOTER_ORDER_NOT_FOUND");
  }

  const allowedLocationIds = getAllowedPromoterLocationIds({
    now: new Date(),
    defaultLocationId: user.defaultLocationId,
    temporaryLocations: user.temporaryLocations,
  });

  if (order.createdById !== input.userId && !allowedLocationIds.includes(order.locationId)) {
    throw new Error("PROMOTER_RETURN_NOT_ALLOWED");
  }

  const orderItem = order.items.find((item) => item.id === input.data.orderItemId);
  if (!orderItem) {
    throw new Error("PROMOTER_ORDER_ITEM_NOT_FOUND");
  }

  const existingReturns = await prisma.promoterReturn.aggregate({
    where: { orderItemId: orderItem.id, orderId: order.id },
    _sum: { quantity: true },
  });
  const alreadyReturned = existingReturns._sum.quantity ?? 0;
  const remainingReturnable = orderItem.quantity - alreadyReturned;

  if (input.data.quantity > remainingReturnable) {
    throw new Error(
      `RETURN_QUANTITY_EXCEEDED:Only ${remainingReturnable} returnable for this item`,
    );
  }

  const unitAmount = Number(orderItem.totalPrice) / orderItem.quantity;
  const amount = roundMoney(unitAmount * input.data.quantity);

  return prisma.$transaction(async (tx) => {
    const promoterReturn = await tx.promoterReturn.create({
      data: {
        orderId: order.id,
        orderItemId: orderItem.id,
        productVariantId: orderItem.productVariantId,
        locationId: order.locationId!,
        promoterId: input.userId,
        quantity: input.data.quantity,
        amount: new Prisma.Decimal(amount),
        reason: input.data.reason ?? null,
      },
      include: {
        order: { select: { id: true, orderNumber: true } },
        orderItem: true,
        productVariant: {
          select: {
            id: true,
            sku: true,
            product: { select: { name: true, skuPrefix: true } },
          },
        },
      },
    });

    const aggregate = await tx.stockLevel.findFirst({
      where: {
        productVariantId: orderItem.productVariantId,
        locationId: order.locationId!,
        batchId: null,
      },
    });

    if (aggregate) {
      await tx.stockLevel.update({
        where: { id: aggregate.id },
        data: { quantityOnHand: { increment: input.data.quantity } },
      });
    } else {
      await tx.stockLevel.create({
        data: {
          productVariantId: orderItem.productVariantId,
          locationId: order.locationId!,
          batchId: null,
          quantityOnHand: input.data.quantity,
        },
      });
    }

    await tx.stockMovement.create({
      data: {
        productVariantId: orderItem.productVariantId,
        toLocationId: order.locationId!,
        movementType: "RETURN",
        quantity: input.data.quantity,
        referenceNumber: order.orderNumber,
        reason: "PROMOTER_RETURN",
        notes: input.data.reason ?? null,
        performedById: input.userId,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: input.userId,
        action: "PROMOTER_RETURN_FINALIZED",
        entityType: "PromoterReturn",
        entityId: promoterReturn.id,
        newValue: {
          orderNumber: order.orderNumber,
          orderItemId: orderItem.id,
          quantity: input.data.quantity,
          amount,
        },
      },
    });

    return promoterReturn;
  });
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
