import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getAllowedPromoterLocationIds, assertPromoterLocationAllowed } from "./access";
import { generateOrderNumber } from "@/lib/utils";
import type { PromoterSaleInput } from "@/lib/validators/promoter";

export async function createPromoterSale(input: {
  userId: string;
  sale: PromoterSaleInput;
}) {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    include: { temporaryLocations: true },
  });

  if (!user || user.role !== "PROMOTER") {
    throw new Error("PROMOTER_ACCESS_REQUIRED");
  }

  const allowedLocationIds = getAllowedPromoterLocationIds({
    now: new Date(),
    defaultLocationId: user.defaultLocationId,
    temporaryLocations: user.temporaryLocations,
  });

  assertPromoterLocationAllowed({
    requestedLocationId: input.sale.locationId,
    allowedLocationIds,
  });

  const location = await prisma.location.findUnique({
    where: { id: input.sale.locationId },
  });

  if (!location || !location.isActive) {
    throw new Error("PROMOTER_LOCATION_NOT_FOUND");
  }

  const variantIds = [...new Set(input.sale.items.map((item) => item.productVariantId))];
  const variants = await prisma.productVariant.findMany({
    where: { id: { in: variantIds }, isActive: true },
    include: { product: true },
  });

  if (variants.length !== variantIds.length) {
    throw new Error("PROMOTER_VARIANT_NOT_FOUND");
  }

  const variantById = new Map(variants.map((variant) => [variant.id, variant]));
  await assertSufficientStock({
    locationId: input.sale.locationId,
    items: input.sale.items,
  });

  const preparedItems = input.sale.items.map((item) => {
    const variant = variantById.get(item.productVariantId);
    if (!variant) throw new Error("PROMOTER_VARIANT_NOT_FOUND");

    const gross = item.unitPrice * item.quantity;
    const totalPrice = roundMoney(Math.max(0, gross - item.discountAmount));
    const effectiveUnitPrice = roundMoney(totalPrice / item.quantity);
    const cost = Number(variant.product.baseCostMyr) + Number(variant.additionalCost);

    return {
      input: item,
      effectiveUnitPrice,
      totalPrice,
      cost,
    };
  });

  const subtotal = roundMoney(preparedItems.reduce((sum, item) => sum + item.totalPrice, 0));
  const orderNumber = generateOrderNumber();

  return prisma.$transaction(async (tx) => {
    const customerId = await resolveCustomerId({
      tx,
      userId: input.userId,
      locationId: input.sale.locationId,
      customerId: input.sale.customerId,
      customer: input.sale.customer,
    });

    const order = await tx.order.create({
      data: {
        orderNumber,
        customerId,
        locationId: input.sale.locationId,
        status: "PROCESSING",
        currency: "MYR",
        exchangeRateToMyr: new Prisma.Decimal(1),
        subtotal: new Prisma.Decimal(subtotal),
        discountAmount: new Prisma.Decimal(0),
        taxAmount: new Prisma.Decimal(0),
        shippingAmount: new Prisma.Decimal(0),
        totalAmount: new Prisma.Decimal(subtotal),
        paymentStatus: "PAID",
        paymentMethod: "Consignment Partner",
        notes: input.sale.notes ?? null,
        internalNotes: "Promoter sale finalized at submission",
        createdById: input.userId,
        items: {
          create: preparedItems.map((item) => ({
            productVariantId: item.input.productVariantId,
            quantity: item.input.quantity,
            unitPrice: new Prisma.Decimal(item.effectiveUnitPrice),
            discountAmount: new Prisma.Decimal(0),
            totalPrice: new Prisma.Decimal(item.totalPrice),
            costAtTimeOfSale: new Prisma.Decimal(item.cost),
            notes: item.input.promotionId
              ? `Promotion applied: ${item.input.promotionId}`
              : null,
          })),
        },
      },
      include: {
        items: true,
        customer: { select: { id: true, name: true, phone: true } },
        location: { select: { id: true, name: true } },
      },
    });

    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id,
        fromStatus: null,
        toStatus: "PROCESSING",
        changedById: input.userId,
        reason: "Promoter sale submitted",
      },
    });

    for (const item of input.sale.items) {
      await deductStockFifo({
        tx,
        userId: input.userId,
        locationId: input.sale.locationId,
        orderNumber,
        productVariantId: item.productVariantId,
        quantity: item.quantity,
      });
    }

    await tx.auditLog.create({
      data: {
        userId: input.userId,
        action: "PROMOTER_SALE_FINALIZED",
        entityType: "Order",
        entityId: order.id,
        newValue: {
          orderNumber: order.orderNumber,
          locationId: input.sale.locationId,
          totalAmount: subtotal,
          itemCount: order.items.length,
        },
      },
    });

    return order;
  });
}

async function assertSufficientStock(input: {
  locationId: string;
  items: PromoterSaleInput["items"];
}) {
  for (const item of input.items) {
    const aggregate = await prisma.stockLevel.findFirst({
      where: {
        productVariantId: item.productVariantId,
        locationId: input.locationId,
        batchId: null,
      },
    });
    const available = (aggregate?.quantityOnHand ?? 0) - (aggregate?.quantityReserved ?? 0);

    if (available < item.quantity) {
      throw new Error(
        `INSUFFICIENT_STOCK:Only ${Math.max(0, available)} available for ${item.productVariantId}, requested ${item.quantity}`,
      );
    }
  }
}

async function resolveCustomerId(input: {
  tx: Prisma.TransactionClient;
  userId: string;
  locationId: string;
  customerId?: string | null;
  customer?: PromoterSaleInput["customer"];
}) {
  if (input.customerId) {
    const customer = await input.tx.customer.findUnique({
      where: { id: input.customerId },
    });

    if (!customer || !customer.isActive) {
      throw new Error("PROMOTER_CUSTOMER_NOT_FOUND");
    }

    return customer.id;
  }

  if (!input.customer) {
    return null;
  }

  const customer = await input.tx.customer.create({
    data: {
      name: input.customer.name,
      phone: input.customer.phone,
      customerType: "RETAIL",
      registeredById: input.userId,
      registeredLocationId: input.locationId,
    },
  });

  return customer.id;
}

async function deductStockFifo(input: {
  tx: Prisma.TransactionClient;
  userId: string;
  locationId: string;
  orderNumber: string;
  productVariantId: string;
  quantity: number;
}) {
  let remaining = input.quantity;
  const sourceRows = await input.tx.stockLevel.findMany({
    where: {
      productVariantId: input.productVariantId,
      locationId: input.locationId,
      batchId: { not: null },
      quantityOnHand: { gt: 0 },
    },
    include: { batch: true },
    orderBy: { batch: { productionDate: "asc" } },
  });

  for (const row of sourceRows) {
    if (remaining <= 0) break;

    const take = Math.min(remaining, row.quantityOnHand);
    await input.tx.stockLevel.update({
      where: { id: row.id },
      data: { quantityOnHand: { decrement: take } },
    });
    await input.tx.stockMovement.create({
      data: {
        productVariantId: input.productVariantId,
        batchId: row.batchId,
        fromLocationId: input.locationId,
        movementType: "OUTBOUND",
        quantity: take,
        referenceNumber: input.orderNumber,
        reason: "PROMOTER_SALE",
        performedById: input.userId,
      },
    });

    remaining -= take;
  }

  if (remaining > 0) {
    throw new Error(
      `INSUFFICIENT_STOCK:Not enough on-hand stock to fulfill ${input.productVariantId}`,
    );
  }

  const aggregate = await input.tx.stockLevel.findFirst({
    where: {
      productVariantId: input.productVariantId,
      locationId: input.locationId,
      batchId: null,
    },
  });

  if (aggregate) {
    await input.tx.stockLevel.update({
      where: { id: aggregate.id },
      data: { quantityOnHand: { decrement: input.quantity } },
    });
  }
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
