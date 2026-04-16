import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { consignmentCancelSchema } from "@/lib/validators/consignment";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return Response.json(
      { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  const role = (session.user as unknown as { role: string }).role;
  if (role !== "ADMIN" && role !== "MANAGER") {
    return Response.json(
      { error: { code: "FORBIDDEN", message: "Only managers can cancel consignments" } },
      { status: 403 }
    );
  }

  const userId = session.user.id;
  const { id } = await params;

  const body = await request.json().catch(() => ({}));
  const parsed = consignmentCancelSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() },
      },
      { status: 400 }
    );
  }

  const shipment = await prisma.consignmentShipment.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!shipment) {
    return Response.json({ error: { code: "NOT_FOUND", message: "Shipment not found" } }, { status: 404 });
  }

  if (shipment.status === "SETTLED" || shipment.status === "CANCELLED") {
    return Response.json(
      { error: { code: "INVALID_STATE", message: `Cannot cancel shipment in ${shipment.status} state` } },
      { status: 409 }
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    // If already shipped (or partial), return remaining (shipped - sold - already-returned) back to source
    if (shipment.status === "SHIPPED" || shipment.status === "PARTIAL_SETTLED") {
      for (const item of shipment.items) {
        const toReturn = item.quantityShipped - item.quantitySold - item.quantityReturned;
        if (toReturn <= 0) continue;

        let remaining = toReturn;

        const sourceRows = await tx.stockLevel.findMany({
          where: item.batchId
            ? {
                productVariantId: item.productVariantId,
                locationId: shipment.toLocationId,
                batchId: item.batchId,
                quantityOnHand: { gt: 0 },
              }
            : {
                productVariantId: item.productVariantId,
                locationId: shipment.toLocationId,
                batchId: { not: null },
                quantityOnHand: { gt: 0 },
              },
          include: { batch: true },
          orderBy: { batch: { productionDate: "asc" } },
        });

        for (const row of sourceRows) {
          if (remaining <= 0) break;
          const take = Math.min(remaining, row.quantityOnHand);
          const rowBatchId = row.batchId as string;

          await tx.stockLevel.update({
            where: { id: row.id },
            data: { quantityOnHand: { decrement: take } },
          });

          const destRow = await tx.stockLevel.findFirst({
            where: {
              productVariantId: item.productVariantId,
              locationId: shipment.fromLocationId,
              batchId: rowBatchId,
            },
          });
          if (destRow) {
            await tx.stockLevel.update({
              where: { id: destRow.id },
              data: { quantityOnHand: { increment: take } },
            });
          } else {
            await tx.stockLevel.create({
              data: {
                productVariantId: item.productVariantId,
                locationId: shipment.fromLocationId,
                batchId: rowBatchId,
                quantityOnHand: take,
              },
            });
          }

          await tx.stockMovement.create({
            data: {
              productVariantId: item.productVariantId,
              batchId: rowBatchId,
              fromLocationId: shipment.toLocationId,
              toLocationId: shipment.fromLocationId,
              movementType: "CONSIGNMENT_RETURN",
              quantity: take,
              referenceNumber: shipment.shipmentNumber,
              reason: "Shipment cancelled",
              performedById: userId,
            },
          });

          remaining -= take;
        }

        const consigneeAgg = await tx.stockLevel.findFirst({
          where: {
            productVariantId: item.productVariantId,
            locationId: shipment.toLocationId,
            batchId: null,
          },
        });
        if (consigneeAgg) {
          await tx.stockLevel.update({
            where: { id: consigneeAgg.id },
            data: { quantityOnHand: { decrement: toReturn } },
          });
        }

        const sourceAgg = await tx.stockLevel.findFirst({
          where: {
            productVariantId: item.productVariantId,
            locationId: shipment.fromLocationId,
            batchId: null,
          },
        });
        if (sourceAgg) {
          await tx.stockLevel.update({
            where: { id: sourceAgg.id },
            data: { quantityOnHand: { increment: toReturn } },
          });
        } else {
          await tx.stockLevel.create({
            data: {
              productVariantId: item.productVariantId,
              locationId: shipment.fromLocationId,
              batchId: null,
              quantityOnHand: toReturn,
            },
          });
        }

        await tx.consignmentShipmentItem.update({
          where: { id: item.id },
          data: { quantityReturned: { increment: toReturn } },
        });
      }
    }

    const updated = await tx.consignmentShipment.update({
      where: { id },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        notes: parsed.data.reason
          ? `${shipment.notes ? shipment.notes + "\n" : ""}Cancelled: ${parsed.data.reason}`
          : shipment.notes,
      },
    });

    await tx.auditLog.create({
      data: {
        userId,
        action: "CONSIGNMENT_CANCELLED",
        entityType: "ConsignmentShipment",
        entityId: id,
        newValue: {
          shipmentNumber: shipment.shipmentNumber,
          reason: parsed.data.reason,
        },
      },
    });

    return updated;
  });

  return Response.json({ data: result });
}
