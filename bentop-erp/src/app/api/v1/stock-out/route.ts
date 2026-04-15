import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { stockOutSchema } from "@/lib/validators/inventory";

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
    return Response.json(
      { error: { code: "FORBIDDEN", message: "Insufficient permissions" } },
      { status: 403 }
    );
  }

  const body = await request.json();
  const parsed = stockOutSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid input",
          details: parsed.error.flatten(),
        },
      },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const userId = session.user.id;

  const location = await prisma.location.findUnique({ where: { id: data.locationId } });
  if (!location || !location.isActive) {
    return Response.json(
      { error: { code: "NOT_FOUND", message: "Location not found or inactive" } },
      { status: 404 }
    );
  }

  // Pre-flight: verify stock is available (per variant+location, summed across batches or targeted batch)
  for (const item of data.items) {
    const available = await prisma.stockLevel.aggregate({
      where: item.batchId
        ? {
            productVariantId: item.productVariantId,
            locationId: data.locationId,
            batchId: item.batchId,
          }
        : {
            productVariantId: item.productVariantId,
            locationId: data.locationId,
            batchId: { not: null },
          },
      _sum: { quantityOnHand: true },
    });
    const onHand = available._sum.quantityOnHand ?? 0;
    if (onHand < item.quantity) {
      return Response.json(
        {
          error: {
            code: "INSUFFICIENT_STOCK",
            message: `Only ${onHand} available for variant ${item.productVariantId}, requested ${item.quantity}`,
          },
        },
        { status: 409 }
      );
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    const movements = [];

    for (const item of data.items) {
      let remaining = item.quantity;

      // Select batch rows FIFO by batch.productionDate (oldest first)
      const batchRows = await tx.stockLevel.findMany({
        where: item.batchId
          ? {
              productVariantId: item.productVariantId,
              locationId: data.locationId,
              batchId: item.batchId,
              quantityOnHand: { gt: 0 },
            }
          : {
              productVariantId: item.productVariantId,
              locationId: data.locationId,
              batchId: { not: null },
              quantityOnHand: { gt: 0 },
            },
        include: { batch: true },
        orderBy: { batch: { productionDate: "asc" } },
      });

      for (const row of batchRows) {
        if (remaining <= 0) break;
        const take = Math.min(remaining, row.quantityOnHand);
        await tx.stockLevel.update({
          where: { id: row.id },
          data: { quantityOnHand: { decrement: take } },
        });

        const movement = await tx.stockMovement.create({
          data: {
            productVariantId: item.productVariantId,
            batchId: row.batchId,
            fromLocationId: data.locationId,
            movementType: "OUTBOUND",
            quantity: take,
            reason: data.reason,
            referenceNumber: data.referenceNumber,
            performedById: userId,
            notes: data.notes,
          },
        });
        movements.push(movement);
        remaining -= take;
      }

      // Decrement the aggregate (batchId: null) row
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
          data: { quantityOnHand: { decrement: item.quantity } },
        });
      }
    }

    await tx.auditLog.create({
      data: {
        userId,
        action: "STOCK_OUT",
        entityType: "StockMovement",
        entityId: movements[0]?.id ?? "unknown",
        newValue: {
          locationId: data.locationId,
          reason: data.reason,
          itemCount: data.items.length,
          totalUnits: data.items.reduce((s, i) => s + i.quantity, 0),
        },
      },
    });

    return { movements };
  });

  return Response.json(
    {
      data: { movements: result.movements },
      meta: {
        totalUnits: data.items.reduce((s, i) => s + i.quantity, 0),
      },
    },
    { status: 201 }
  );
}
