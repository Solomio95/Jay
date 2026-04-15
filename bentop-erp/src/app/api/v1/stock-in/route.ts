import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { stockInSchema } from "@/lib/validators/inventory";
import { generateBatchNumber } from "@/lib/utils";

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
  const parsed = stockInSchema.safeParse(body);
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
  const productionDate = data.productionDate ? new Date(data.productionDate) : new Date();

  // Verify location exists & active
  const location = await prisma.location.findUnique({ where: { id: data.locationId } });
  if (!location || !location.isActive) {
    return Response.json(
      { error: { code: "NOT_FOUND", message: "Location not found or inactive" } },
      { status: 404 }
    );
  }

  // Verify all variants exist
  const variantIds = data.items.map((i) => i.productVariantId);
  const variants = await prisma.productVariant.findMany({
    where: { id: { in: variantIds }, isActive: true },
    select: { id: true, sku: true },
  });
  if (variants.length !== new Set(variantIds).size) {
    return Response.json(
      { error: { code: "NOT_FOUND", message: "One or more variants not found or inactive" } },
      { status: 404 }
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    const batches = [];
    const movements = [];

    for (const item of data.items) {
      // Each item gets its own batch (cost can vary per item)
      const batch = await tx.batch.create({
        data: {
          batchNumber: generateBatchNumber(),
          productVariantId: item.productVariantId,
          quantityProduced: item.quantity,
          productionDate,
          supplierName: data.supplierName,
          costPerUnitMyr: item.costPerUnitMyr,
          notes: data.notes,
        },
      });
      batches.push(batch);

      // Stock movement
      const movement = await tx.stockMovement.create({
        data: {
          productVariantId: item.productVariantId,
          batchId: batch.id,
          toLocationId: data.locationId,
          movementType: "INBOUND",
          quantity: item.quantity,
          referenceNumber: data.referenceNumber,
          performedById: userId,
          notes: data.notes,
        },
      });
      movements.push(movement);

      // Upsert stock level (per variant + location + batch)
      await tx.stockLevel.upsert({
        where: {
          productVariantId_locationId_batchId: {
            productVariantId: item.productVariantId,
            locationId: data.locationId,
            batchId: batch.id,
          },
        },
        update: {
          quantityOnHand: { increment: item.quantity },
          binLocation: item.binLocation,
        },
        create: {
          productVariantId: item.productVariantId,
          locationId: data.locationId,
          batchId: batch.id,
          quantityOnHand: item.quantity,
          binLocation: item.binLocation,
        },
      });

      // Also bump the aggregate (no-batch) level row used for reorder rules
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
          data: { quantityOnHand: { increment: item.quantity } },
        });
      } else {
        await tx.stockLevel.create({
          data: {
            productVariantId: item.productVariantId,
            locationId: data.locationId,
            batchId: null,
            quantityOnHand: item.quantity,
          },
        });
      }
    }

    await tx.auditLog.create({
      data: {
        userId,
        action: "STOCK_IN",
        entityType: "StockMovement",
        entityId: movements[0].id,
        newValue: {
          locationId: data.locationId,
          itemCount: data.items.length,
          totalUnits: data.items.reduce((s, i) => s + i.quantity, 0),
          referenceNumber: data.referenceNumber,
        },
      },
    });

    return { batches, movements };
  });

  return Response.json(
    {
      data: {
        batches: result.batches,
        movements: result.movements,
      },
      meta: {
        itemsReceived: result.movements.length,
        totalUnits: data.items.reduce((s, i) => s + i.quantity, 0),
      },
    },
    { status: 201 }
  );
}
