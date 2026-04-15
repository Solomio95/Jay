import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { orderCreateSchema } from "@/lib/validators/sales";
import { generateOrderNumber } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return Response.json(
      { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  const sp = request.nextUrl.searchParams;
  const search = sp.get("search")?.trim() ?? "";
  const status = sp.get("status");
  const paymentStatus = sp.get("paymentStatus");
  const customerId = sp.get("customerId");
  const salesChannelId = sp.get("salesChannelId");
  const locationId = sp.get("locationId");
  const from = sp.get("from");
  const to = sp.get("to");
  const limit = Math.min(parseInt(sp.get("limit") ?? "25", 10), 200);
  const page = Math.max(parseInt(sp.get("page") ?? "1", 10), 1);

  const where: Prisma.OrderWhereInput = {};
  if (status) where.status = status as Prisma.OrderWhereInput["status"];
  if (paymentStatus) where.paymentStatus = paymentStatus as Prisma.OrderWhereInput["paymentStatus"];
  if (customerId) where.customerId = customerId;
  if (salesChannelId) where.salesChannelId = salesChannelId;
  if (locationId) where.locationId = locationId;
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to);
  }
  if (search) {
    where.OR = [
      { orderNumber: { contains: search, mode: "insensitive" } },
      { customer: { name: { contains: search, mode: "insensitive" } } },
      { customer: { companyName: { contains: search, mode: "insensitive" } } },
      { notes: { contains: search, mode: "insensitive" } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, companyName: true } },
        salesChannel: { select: { id: true, name: true, type: true } },
        location: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: (page - 1) * limit,
    }),
    prisma.order.count({ where }),
  ]);

  return Response.json({ data: items, meta: { total, page, limit } });
}

export async function POST(request: NextRequest) {
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
  const body = await request.json();
  const parsed = orderCreateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() },
      },
      { status: 400 }
    );
  }
  const data = parsed.data;

  // Verify location
  const location = await prisma.location.findUnique({ where: { id: data.locationId } });
  if (!location || !location.isActive) {
    return Response.json({ error: { code: "NOT_FOUND", message: "Location not found or inactive" } }, { status: 404 });
  }

  // Verify customer if provided
  if (data.customerId) {
    const customer = await prisma.customer.findUnique({ where: { id: data.customerId } });
    if (!customer || !customer.isActive) {
      return Response.json({ error: { code: "NOT_FOUND", message: "Customer not found or inactive" } }, { status: 404 });
    }
  }

  // Verify variants + compute cost at time of sale
  const variantIds = [...new Set(data.items.map((i) => i.productVariantId))];
  const variants = await prisma.productVariant.findMany({
    where: { id: { in: variantIds } },
    include: { product: true },
  });
  if (variants.length !== variantIds.length) {
    return Response.json({ error: { code: "NOT_FOUND", message: "One or more variants not found" } }, { status: 404 });
  }
  const variantMap = new Map(variants.map((v) => [v.id, v]));

  // If confirming, pre-flight stock check at the given location
  if (data.confirm) {
    for (const item of data.items) {
      const available = await prisma.stockLevel.aggregate({
        where: {
          productVariantId: item.productVariantId,
          locationId: data.locationId,
          batchId: { not: null },
        },
        _sum: { quantityOnHand: true },
      });
      const onHand = available._sum.quantityOnHand ?? 0;
      // Also consider currently reserved in other confirmed orders via stockLevel.quantityReserved on aggregate
      const aggregate = await prisma.stockLevel.findFirst({
        where: {
          productVariantId: item.productVariantId,
          locationId: data.locationId,
          batchId: null,
        },
      });
      const reserved = aggregate?.quantityReserved ?? 0;
      const availableForSale = onHand - reserved;
      if (availableForSale < item.quantity) {
        const v = variantMap.get(item.productVariantId);
        return Response.json(
          {
            error: {
              code: "INSUFFICIENT_STOCK",
              message: `Only ${availableForSale} available for ${v?.sku ?? item.productVariantId}, requested ${item.quantity}`,
            },
          },
          { status: 409 }
        );
      }
    }
  }

  // Compute totals
  const itemLines = data.items.map((item) => {
    const v = variantMap.get(item.productVariantId)!;
    const gross = item.unitPrice * item.quantity;
    const totalPrice = Math.max(0, gross - (item.discountAmount ?? 0));
    const cost = Number(v.product.baseCostMyr) + Number(v.additionalCost);
    return { item, variant: v, totalPrice, cost };
  });

  const subtotal = itemLines.reduce((s, l) => s + l.totalPrice, 0);
  let orderDiscount = data.discountAmount ?? 0;
  if (data.discountType === "PERCENTAGE") {
    orderDiscount = (subtotal * orderDiscount) / 100;
  }
  const totalAmount = Math.max(0, subtotal - orderDiscount + (data.taxAmount ?? 0) + (data.shippingAmount ?? 0));

  const orderNumber = generateOrderNumber();
  const initialStatus = data.confirm ? "CONFIRMED" : "DRAFT";

  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        orderNumber,
        customerId: data.customerId || null,
        salesChannelId: data.salesChannelId || null,
        locationId: data.locationId,
        status: initialStatus,
        currency: data.currency,
        exchangeRateToMyr: new Prisma.Decimal(data.exchangeRateToMyr),
        subtotal: new Prisma.Decimal(subtotal),
        discountAmount: new Prisma.Decimal(data.discountAmount ?? 0),
        discountType: data.discountType ?? null,
        taxAmount: new Prisma.Decimal(data.taxAmount ?? 0),
        shippingAmount: new Prisma.Decimal(data.shippingAmount ?? 0),
        totalAmount: new Prisma.Decimal(totalAmount),
        paymentStatus: data.paymentStatus,
        paymentMethod: data.paymentMethod ?? null,
        paymentReference: data.paymentReference ?? null,
        shippingAddress: (data.shippingAddress ?? Prisma.JsonNull) as Prisma.InputJsonValue | typeof Prisma.JsonNull,
        billingAddress: (data.billingAddress ?? Prisma.JsonNull) as Prisma.InputJsonValue | typeof Prisma.JsonNull,
        notes: data.notes ?? null,
        internalNotes: data.internalNotes ?? null,
        createdById: userId,
        items: {
          create: itemLines.map((l) => ({
            productVariantId: l.item.productVariantId,
            batchId: l.item.batchId || null,
            quantity: l.item.quantity,
            unitPrice: new Prisma.Decimal(l.item.unitPrice),
            discountAmount: new Prisma.Decimal(l.item.discountAmount ?? 0),
            totalPrice: new Prisma.Decimal(l.totalPrice),
            costAtTimeOfSale: new Prisma.Decimal(l.cost),
            notes: l.item.notes ?? null,
          })),
        },
      },
      include: {
        items: true,
        customer: { select: { id: true, name: true } },
        salesChannel: { select: { id: true, name: true } },
      },
    });

    // Initial status history
    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id,
        fromStatus: null,
        toStatus: initialStatus,
        changedById: userId,
        reason: "Order created",
      },
    });

    // Reserve stock if confirmed (on aggregate row)
    if (data.confirm) {
      for (const item of data.items) {
        const aggregate = await tx.stockLevel.findFirst({
          where: {
            productVariantId: item.productVariantId,
            locationId: data.locationId,
            batchId: null,
          },
        });
        if (aggregate) {
          await tx.stockLevel.update({
            where: { id: aggregate.id },
            data: { quantityReserved: { increment: item.quantity } },
          });
        } else {
          await tx.stockLevel.create({
            data: {
              productVariantId: item.productVariantId,
              locationId: data.locationId,
              batchId: null,
              quantityOnHand: 0,
              quantityReserved: item.quantity,
            },
          });
        }
      }
    }

    await tx.auditLog.create({
      data: {
        userId,
        action: data.confirm ? "ORDER_CONFIRMED" : "ORDER_DRAFTED",
        entityType: "Order",
        entityId: order.id,
        newValue: {
          orderNumber: order.orderNumber,
          totalAmount: order.totalAmount.toString(),
          itemCount: order.items.length,
        },
      },
    });

    return order;
  });

  return Response.json({ data: result }, { status: 201 });
}
