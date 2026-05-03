import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { consignmentShipSchema } from "@/lib/validators/consignment";
import { handleApiError } from "@/lib/api-error";

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
  
    const body = await request.json().catch(() => ({}));
    const parsed = consignmentShipSchema.safeParse(body);
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
  
    if (shipment.status !== "DRAFT") {
      return Response.json(
        { error: { code: "INVALID_STATE", message: `Cannot ship a shipment in ${shipment.status} state` } },
        { status: 409 }
      );
    }
  
    // Pre-flight stock check
    for (const item of shipment.items) {
      const agg = await prisma.stockLevel.aggregate({
        where: {
          productVariantId: item.productVariantId,
          locationId: shipment.fromLocationId,
          batchId: { not: null },
        },
        _sum: { quantityOnHand: true },
      });
      let onHand = agg._sum.quantityOnHand ?? 0;
      const aggRow = await prisma.stockLevel.findFirst({
        where: {
          productVariantId: item.productVariantId,
          locationId: shipment.fromLocationId,
          batchId: null,
        },
      });
      if (onHand === 0 && !item.batchId) {
        onHand = aggRow?.quantityOnHand ?? 0;
      }
      const reserved = aggRow?.quantityReserved ?? 0;
      const availableForSale = onHand - reserved;
      if (availableForSale < item.quantityShipped) {
        return Response.json(
          {
            error: {
              code: "INSUFFICIENT_STOCK",
              message: `Only ${availableForSale} available for variant ${item.productVariantId}, requested ${item.quantityShipped}`,
            },
          },
          { status: 409 }
        );
      }
    }
  
    const result = await prisma.$transaction(async (tx) => {
      for (const item of shipment.items) {
        let remaining = item.quantityShipped;
  
        const sourceRows = await tx.stockLevel.findMany({
          where: item.batchId
            ? {
                productVariantId: item.productVariantId,
                locationId: shipment.fromLocationId,
                batchId: item.batchId,
                quantityOnHand: { gt: 0 },
              }
            : {
                productVariantId: item.productVariantId,
                locationId: shipment.fromLocationId,
                batchId: { not: null },
                quantityOnHand: { gt: 0 },
              },
          include: { batch: true },
          orderBy: { batch: { productionDate: "asc" } },
        });

        if (sourceRows.length === 0 && !item.batchId) {
          const sourceAgg = await tx.stockLevel.findFirst({
            where: {
              productVariantId: item.productVariantId,
              locationId: shipment.fromLocationId,
              batchId: null,
            },
          });

          if (!sourceAgg || sourceAgg.quantityOnHand < item.quantityShipped) {
            throw new Error(`Insufficient aggregate stock for ${item.productVariantId}`);
          }

          await tx.stockLevel.update({
            where: { id: sourceAgg.id },
            data: { quantityOnHand: { decrement: item.quantityShipped } },
          });

          const destAgg = await tx.stockLevel.findFirst({
            where: {
              productVariantId: item.productVariantId,
              locationId: shipment.toLocationId,
              batchId: null,
            },
          });
          if (destAgg) {
            await tx.stockLevel.update({
              where: { id: destAgg.id },
              data: { quantityOnHand: { increment: item.quantityShipped } },
            });
          } else {
            await tx.stockLevel.create({
              data: {
                productVariantId: item.productVariantId,
                locationId: shipment.toLocationId,
                batchId: null,
                quantityOnHand: item.quantityShipped,
              },
            });
          }

          await tx.stockMovement.create({
            data: {
              productVariantId: item.productVariantId,
              batchId: null,
              fromLocationId: shipment.fromLocationId,
              toLocationId: shipment.toLocationId,
              movementType: "CONSIGNMENT_OUT",
              quantity: item.quantityShipped,
              referenceNumber: shipment.shipmentNumber,
              performedById: userId,
            },
          });

          continue;
        }
  
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
              locationId: shipment.toLocationId,
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
                locationId: shipment.toLocationId,
                batchId: rowBatchId,
                quantityOnHand: take,
              },
            });
          }
  
          await tx.stockMovement.create({
            data: {
              productVariantId: item.productVariantId,
              batchId: rowBatchId,
              fromLocationId: shipment.fromLocationId,
              toLocationId: shipment.toLocationId,
              movementType: "CONSIGNMENT_OUT",
              quantity: take,
              referenceNumber: shipment.shipmentNumber,
              performedById: userId,
            },
          });
  
          remaining -= take;
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
            data: { quantityOnHand: { decrement: item.quantityShipped } },
          });
        }
  
        const destAgg = await tx.stockLevel.findFirst({
          where: {
            productVariantId: item.productVariantId,
            locationId: shipment.toLocationId,
            batchId: null,
          },
        });
        if (destAgg) {
          await tx.stockLevel.update({
            where: { id: destAgg.id },
            data: { quantityOnHand: { increment: item.quantityShipped } },
          });
        } else {
          await tx.stockLevel.create({
            data: {
              productVariantId: item.productVariantId,
              locationId: shipment.toLocationId,
              batchId: null,
              quantityOnHand: item.quantityShipped,
            },
          });
        }
      }
  
      const updated = await tx.consignmentShipment.update({
        where: { id },
        data: {
          status: "SHIPPED",
          shippedAt: new Date(),
          notes: parsed.data.notes ?? shipment.notes,
        },
      });
  
      await tx.auditLog.create({
        data: {
          userId,
          action: "CONSIGNMENT_SHIPPED",
          entityType: "ConsignmentShipment",
          entityId: id,
          newValue: { shipmentNumber: shipment.shipmentNumber },
        },
      });
  
      return updated;
    });
  
    return Response.json({ data: result });
  } catch (error) {
    return handleApiError(error);
  }
}
