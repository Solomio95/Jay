import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { purchaseReceiptCreateSchema } from "@/lib/validators/purchase";
import { generateBatchNumber, generatePurchaseReceiptNumber } from "@/lib/utils";
import { summarizePurchaseOrderReceiptState } from "@/lib/purchase/receiving";
import { handleApiError } from "@/lib/api-error";

function canReceive(role: string) {
  return role === "ADMIN" || role === "MANAGER" || role === "STAFF";
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
    }

    const role = (session.user as unknown as { role: string }).role;
    if (!canReceive(role)) {
      return Response.json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 });
    }

    const { id } = await params;
    const parsed = purchaseReceiptCreateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        { error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() } },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const location = await prisma.location.findUnique({ where: { id: data.locationId } });
    if (!location || !location.isActive) {
      return Response.json({ error: { code: "NOT_FOUND", message: "Location not found or inactive" } }, { status: 404 });
    }
    if (location.type === "CONSIGNMENT") {
      return Response.json(
        { error: { code: "VALIDATION_ERROR", message: "Purchase receiving must go into warehouse or retail stock first" } },
        { status: 400 }
      );
    }

    const order = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: { supplier: true, items: true },
    });
    if (!order) {
      return Response.json({ error: { code: "NOT_FOUND", message: "Purchase order not found" } }, { status: 404 });
    }
    if (order.status === "CANCELLED" || order.status === "RECEIVED") {
      return Response.json(
        { error: { code: "CONFLICT", message: `Purchase order is ${order.status.toLowerCase()}` } },
        { status: 409 }
      );
    }

    const receiptLines = Array.from(
      data.items
        .reduce((map, item) => {
          const current = map.get(item.purchaseOrderItemId);
          if (current) {
            current.quantityReceived += item.quantityReceived;
            current.binLocation = current.binLocation || item.binLocation;
          } else {
            map.set(item.purchaseOrderItemId, { ...item });
          }
          return map;
        }, new Map<string, (typeof data.items)[number]>())
        .values()
    );

    const itemById = new Map(order.items.map((item) => [item.id, item]));
    for (const line of receiptLines) {
      const poItem = itemById.get(line.purchaseOrderItemId);
      if (!poItem) {
        return Response.json(
          { error: { code: "VALIDATION_ERROR", message: "Receipt line does not belong to this purchase order" } },
          { status: 400 }
        );
      }
      const remaining = poItem.quantityOrdered - poItem.quantityReceived;
      if (line.quantityReceived > remaining) {
        return Response.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: `Cannot receive ${line.quantityReceived}. Remaining quantity is ${remaining}.`,
            },
          },
          { status: 400 }
        );
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const receipt = await tx.purchaseReceipt.create({
        data: {
          receiptNumber: generatePurchaseReceiptNumber(),
          purchaseOrderId: order.id,
          locationId: data.locationId,
          receivedAt: data.receivedAt ? new Date(data.receivedAt) : new Date(),
          supplierName: order.supplier.name,
          referenceNumber: data.referenceNumber,
          notes: data.notes,
          createdById: session.user.id,
        },
      });

      for (const line of receiptLines) {
        const poItem = itemById.get(line.purchaseOrderItemId);
        if (!poItem) continue;

        const batch = await tx.batch.create({
          data: {
            batchNumber: generateBatchNumber(),
            productVariantId: poItem.productVariantId,
            quantityProduced: line.quantityReceived,
            productionDate: data.receivedAt ? new Date(data.receivedAt) : new Date(),
            supplierName: order.supplier.name,
            costPerUnitMyr: poItem.costPerUnitMyr,
            notes: data.notes,
          },
        });

        await tx.purchaseReceiptItem.create({
          data: {
            purchaseReceiptId: receipt.id,
            purchaseOrderItemId: poItem.id,
            productVariantId: poItem.productVariantId,
            batchId: batch.id,
            quantityReceived: line.quantityReceived,
            costPerUnitMyr: poItem.costPerUnitMyr,
            binLocation: line.binLocation,
          },
        });

        await tx.purchaseOrderItem.update({
          where: { id: poItem.id },
          data: { quantityReceived: { increment: line.quantityReceived } },
        });

        await tx.stockMovement.create({
          data: {
            productVariantId: poItem.productVariantId,
            batchId: batch.id,
            toLocationId: data.locationId,
            movementType: "INBOUND",
            quantity: line.quantityReceived,
            referenceNumber: receipt.receiptNumber,
            performedById: session.user.id,
            notes: data.notes,
          },
        });

        await tx.stockLevel.create({
          data: {
            productVariantId: poItem.productVariantId,
            locationId: data.locationId,
            batchId: batch.id,
            quantityOnHand: line.quantityReceived,
            binLocation: line.binLocation,
          },
        });

        const aggregate = await tx.stockLevel.findFirst({
          where: {
            productVariantId: poItem.productVariantId,
            locationId: data.locationId,
            batchId: null,
          },
        });
        if (aggregate) {
          await tx.stockLevel.update({
            where: { id: aggregate.id },
            data: { quantityOnHand: { increment: line.quantityReceived } },
          });
        } else {
          await tx.stockLevel.create({
            data: {
              productVariantId: poItem.productVariantId,
              locationId: data.locationId,
              batchId: null,
              quantityOnHand: line.quantityReceived,
              binLocation: line.binLocation,
            },
          });
        }
      }

      const updatedItems = await tx.purchaseOrderItem.findMany({
        where: { purchaseOrderId: order.id },
        select: { quantityOrdered: true, quantityReceived: true },
      });
      const nextStatus = summarizePurchaseOrderReceiptState(updatedItems);
      const updatedOrder = await tx.purchaseOrder.update({
        where: { id: order.id },
        data: { status: nextStatus },
      });

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "RECEIVE",
          entityType: "PurchaseOrder",
          entityId: order.id,
          newValue: {
            receiptNumber: receipt.receiptNumber,
            status: updatedOrder.status,
            locationId: data.locationId,
            totalUnits: receiptLines.reduce((sum, line) => sum + line.quantityReceived, 0),
          },
        },
      });

      return tx.purchaseReceipt.findUnique({
        where: { id: receipt.id },
        include: { items: { include: { productVariant: true, batch: true } }, location: true },
      });
    });

    return Response.json({ data: result }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
