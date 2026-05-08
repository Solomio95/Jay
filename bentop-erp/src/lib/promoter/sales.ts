import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getAllowedPromoterLocationIds, assertPromoterLocationAllowed } from "./access";
import { generateOrderNumber } from "@/lib/utils";
import type { PromoterSaleInput } from "@/lib/validators/promoter";
import { calculatePromoterSaleLinePrices, type PromotionCandidate } from "./promotions";
import {
  assertEnoughAvailableStock,
  calculateAvailableStock,
  mergeRequestedQuantities,
} from "@/lib/inventory/reservation";

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

  const activePromotions = await getActivePromotions(input.sale.locationId);
  const calculatedPrices = calculatePromoterSaleLinePrices({
    items: input.sale.items.map((item) => {
      const variant = variantById.get(item.productVariantId);
      if (!variant) throw new Error("PROMOTER_VARIANT_NOT_FOUND");

      return {
        productVariantId: item.productVariantId,
        productId: variant.productId,
        quantity: item.quantity,
        sellingPriceMyr: Number(variant.sellingPriceMyr),
      };
    }),
    promotions: activePromotions,
  });
  const calculatedPriceByVariantId = new Map(
    calculatedPrices.map((item) => [item.productVariantId, item]),
  );

  const preparedItems = input.sale.items.map((item) => {
    const variant = variantById.get(item.productVariantId);
    if (!variant) throw new Error("PROMOTER_VARIANT_NOT_FOUND");
    const calculatedPrice = calculatedPriceByVariantId.get(item.productVariantId);
    if (!calculatedPrice) throw new Error("PROMOTER_PRICE_NOT_FOUND");

    const totalPrice = calculatedPrice.totalPrice;
    const effectiveUnitPrice = calculatedPrice.unitPrice;
    const cost = Number(variant.product.baseCostMyr) + Number(variant.additionalCost);

    return {
      input: item,
      effectiveUnitPrice,
      totalPrice,
      cost,
      promotionId: calculatedPrice.promotionId,
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
            notes: item.promotionId ? `Promotion applied: ${item.promotionId}` : null,
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

export async function getPromoterSalesHistory(input: {
  userId: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
}) {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
  });

  if (!user || user.role !== "PROMOTER") {
    throw new Error("PROMOTER_ACCESS_REQUIRED");
  }

  const limit = Number.isFinite(input.limit) ? input.limit : 50;

  const orders = await prisma.order.findMany({
    where: buildPromoterSalesHistoryWhere(input),
    include: {
      customer: { select: { id: true, name: true, phone: true } },
      location: { select: { id: true, name: true } },
      items: {
        include: {
          promoterReturns: { select: { amount: true, quantity: true } },
          productVariant: {
            select: {
              id: true,
              sku: true,
              color: true,
              size: true,
              product: { select: { id: true, name: true, skuPrefix: true } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(limit ?? 50, 1), 100),
  });

  return orders.map((order) => {
    const items = order.items.map((item) => ({
      id: item.id,
      quantity: item.quantity,
      ...summarizePromoterSaleHistoryItem({
        quantity: item.quantity,
        totalPrice: Number(item.totalPrice),
        promoterReturns: item.promoterReturns,
      }),
      unitPrice: Number(item.unitPrice),
      totalPrice: Number(item.totalPrice),
      notes: item.notes,
      productVariant: item.productVariant,
    }));
    const returnedAmount = roundMoney(
      items.reduce((sum, item) => sum + item.returnedAmount, 0),
    );
    const netAmount = roundMoney(Math.max(0, Number(order.totalAmount) - returnedAmount));

    return {
    id: order.id,
    orderNumber: order.orderNumber,
    createdAt: order.createdAt.toISOString(),
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    location: order.location,
    customer: order.customer,
    subtotal: Number(order.subtotal),
    totalAmount: Number(order.totalAmount),
    returnedAmount,
    netAmount,
    itemCount: order.items.length,
    quantity: order.items.reduce((sum, item) => sum + item.quantity, 0),
    returnedQuantity: items.reduce((sum, item) => sum + item.returnedQuantity, 0),
    netQuantity: items.reduce((sum, item) => sum + item.returnableQuantity, 0),
    items,
    };
  });
}

export function summarizePromoterSaleHistoryItem(input: {
  quantity: number;
  totalPrice: number;
  promoterReturns: Array<{ amount: unknown; quantity: number }>;
}) {
  const returnedQuantity = input.promoterReturns.reduce(
    (sum, promoterReturn) => sum + promoterReturn.quantity,
    0,
  );
  const returnedAmount = roundMoney(
    input.promoterReturns.reduce(
      (sum, promoterReturn) => sum + Number(promoterReturn.amount),
      0,
    ),
  );

  return {
    returnedQuantity,
    returnableQuantity: Math.max(0, input.quantity - returnedQuantity),
    returnedAmount,
    netAmount: roundMoney(Math.max(0, input.totalPrice - returnedAmount)),
  };
}

export function buildPromoterSalesHistoryWhere(input: {
  userId: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}): Prisma.OrderWhereInput {
  const where: Prisma.OrderWhereInput = {
    createdById: input.userId,
    internalNotes: { contains: "Promoter sale finalized at submission" },
  };

  const createdAt = buildDateRange(input.dateFrom, input.dateTo);
  if (createdAt) {
    where.createdAt = createdAt;
  }

  const search = input.search?.trim();
  if (search) {
    where.OR = [
      { orderNumber: { contains: search, mode: "insensitive" } },
      { customer: { name: { contains: search, mode: "insensitive" } } },
      { location: { name: { contains: search, mode: "insensitive" } } },
      {
        items: {
          some: {
            productVariant: {
              OR: [
                { sku: { contains: search, mode: "insensitive" } },
                {
                  product: {
                    name: { contains: search, mode: "insensitive" },
                  },
                },
              ],
            },
          },
        },
      },
    ];
  }

  return where;
}

function buildDateRange(dateFrom?: string, dateTo?: string) {
  const range: { gte?: Date; lte?: Date } = {};

  if (dateFrom) {
    range.gte = new Date(`${dateFrom}T00:00:00.000Z`);
  }

  if (dateTo) {
    range.lte = new Date(`${dateTo}T23:59:59.999Z`);
  }

  return range.gte || range.lte ? range : null;
}

async function assertSufficientStock(input: {
  locationId: string;
  items: PromoterSaleInput["items"];
}) {
  const requestedQuantities = mergeRequestedQuantities(input.items);

  for (const [productVariantId, quantity] of requestedQuantities) {
    const aggregate = await prisma.stockLevel.findFirst({
      where: {
        productVariantId,
        locationId: input.locationId,
        batchId: null,
      },
    });
    const available = calculateAvailableStock(
      aggregate?.quantityOnHand ?? 0,
      aggregate?.quantityReserved ?? 0,
    );

    assertEnoughAvailableStock({
      available,
      requested: quantity,
      itemLabel: productVariantId,
    });
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
  const aggregate = await input.tx.stockLevel.findFirst({
    where: {
      productVariantId: input.productVariantId,
      locationId: input.locationId,
      batchId: null,
    },
  });

  const plan = buildPromoterStockDeductionPlan({
    quantity: input.quantity,
    batchRows: sourceRows.map((row) => ({
      id: row.id,
      batchId: row.batchId,
      quantityOnHand: row.quantityOnHand,
    })),
    aggregateRow: aggregate
      ? { id: aggregate.id, quantityOnHand: aggregate.quantityOnHand }
      : null,
  });

  for (const deduction of plan.batchDeductions) {
    await input.tx.stockLevel.update({
      where: { id: deduction.id },
      data: { quantityOnHand: { decrement: deduction.quantity } },
    });
  }

  for (const movement of plan.movements) {
    await input.tx.stockMovement.create({
      data: {
        productVariantId: input.productVariantId,
        batchId: movement.batchId,
        fromLocationId: input.locationId,
        movementType: "OUTBOUND",
        quantity: movement.quantity,
        referenceNumber: input.orderNumber,
        reason: "PROMOTER_SALE",
        performedById: input.userId,
      },
    });
  }

  if (plan.aggregateDeduction) {
    await input.tx.stockLevel.update({
      where: { id: plan.aggregateDeduction.id },
      data: { quantityOnHand: { decrement: plan.aggregateDeduction.quantity } },
    });
  }
}

export function buildPromoterStockDeductionPlan(input: {
  quantity: number;
  batchRows: Array<{ id: string; batchId: string | null; quantityOnHand: number }>;
  aggregateRow: { id: string; quantityOnHand: number } | null;
}) {
  let remaining = input.quantity;
  const batchDeductions: Array<{ id: string; quantity: number }> = [];
  const movements: Array<{ batchId: string | null; quantity: number }> = [];

  for (const row of input.batchRows) {
    if (remaining <= 0) break;

    const quantity = Math.min(remaining, row.quantityOnHand);
    if (quantity <= 0) continue;

    batchDeductions.push({ id: row.id, quantity });
    movements.push({ batchId: row.batchId, quantity });
    remaining -= quantity;
  }

  if (remaining > 0) {
    const aggregateAvailable = input.aggregateRow?.quantityOnHand ?? 0;
    const fallbackAvailable =
      aggregateAvailable - (input.quantity - remaining);

    if (fallbackAvailable < remaining) {
      throw new Error("INSUFFICIENT_STOCK:Not enough on-hand stock to fulfill item");
    }

    movements.push({ batchId: null, quantity: remaining });
    remaining = 0;
  }

  return {
    batchDeductions,
    aggregateDeduction: input.aggregateRow
      ? { id: input.aggregateRow.id, quantity: input.quantity }
      : null,
    movements,
  };
}

async function getActivePromotions(locationId: string): Promise<PromotionCandidate[]> {
  const now = new Date();
  const promotions = await prisma.promotion.findMany({
    where: {
      isActive: true,
      startsAt: { lte: now },
      endsAt: { gte: now },
      locations: { some: { locationId } },
    },
    include: {
      products: { select: { productId: true } },
      variants: { select: { productVariantId: true } },
    },
    orderBy: { startsAt: "desc" },
  });

  return promotions.map((promotion) => ({
    id: promotion.id,
    ruleMode: promotion.ruleMode,
    bundleQuantity: promotion.bundleQuantity,
    bundlePrice: Number(promotion.bundlePrice),
    productIds: promotion.products.map((product) => product.productId),
    productVariantIds: promotion.variants.map((variant) => variant.productVariantId),
  }));
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
