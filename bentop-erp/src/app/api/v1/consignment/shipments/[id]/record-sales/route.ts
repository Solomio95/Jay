import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { consignmentRecordSalesSchema } from "@/lib/validators/consignment";
import { handleApiError } from "@/lib/api-error";
import { canManageConsignment, forbiddenResponse } from "@/lib/permissions";

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
    if (!canManageConsignment(role)) {
      return forbiddenResponse();
    }
  
    const userId = session.user.id;
    const { id } = await params;
  
    const body = await request.json();
    const parsed = consignmentRecordSalesSchema.safeParse(body);
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
  
    if (shipment.status !== "SHIPPED" && shipment.status !== "PARTIAL_SETTLED") {
      return Response.json(
        { error: { code: "INVALID_STATE", message: `Cannot record sales in ${shipment.status} state` } },
        { status: 409 }
      );
    }
  
    const itemMap = new Map(shipment.items.map((i) => [i.id, i]));
  
    // Validate each entry
    for (const entry of parsed.data.entries) {
      const item = itemMap.get(entry.itemId);
      if (!item) {
        return Response.json(
          { error: { code: "NOT_FOUND", message: `Item ${entry.itemId} not found in shipment` } },
          { status: 404 }
        );
      }
      const remaining = item.quantityShipped - item.quantitySold - item.quantityReturned;
      if (entry.quantitySold > remaining) {
        return Response.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: `Cannot sell ${entry.quantitySold}; only ${remaining} remaining for this item`,
            },
          },
          { status: 409 }
        );
      }
    }
  
    const result = await prisma.$transaction(async (tx) => {
      for (const entry of parsed.data.entries) {
        if (entry.quantitySold <= 0) continue;
        const item = itemMap.get(entry.itemId)!;
  
        // Update sold count
        await tx.consignmentShipmentItem.update({
          where: { id: entry.itemId },
          data: { quantitySold: { increment: entry.quantitySold } },
        });
  
        // Deduct stock from consignee location (OUTBOUND movement)
        let remaining = entry.quantitySold;
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
  
          await tx.stockMovement.create({
            data: {
              productVariantId: item.productVariantId,
              batchId: rowBatchId,
              fromLocationId: shipment.toLocationId,
              toLocationId: null,
              movementType: "OUTBOUND",
              quantity: take,
              referenceNumber: shipment.shipmentNumber,
              reason: "Consignment sale",
              performedById: userId,
            },
          });
  
          remaining -= take;
        }
  
        // Aggregate adjust on consignee
        const agg = await tx.stockLevel.findFirst({
          where: {
            productVariantId: item.productVariantId,
            locationId: shipment.toLocationId,
            batchId: null,
          },
        });
        if (agg) {
          await tx.stockLevel.update({
            where: { id: agg.id },
            data: { quantityOnHand: { decrement: entry.quantitySold } },
          });
        }
      }
  
      // Recompute status: if any item has partial activity but not all sold+returned == shipped, stay PARTIAL_SETTLED
      const freshItems = await tx.consignmentShipmentItem.findMany({
        where: { shipmentId: id },
      });
      const anySold = freshItems.some((i) => i.quantitySold > 0);
      const allAccountedFor = freshItems.every(
        (i) => i.quantitySold + i.quantityReturned >= i.quantityShipped
      );
      const nextStatus: "SHIPPED" | "PARTIAL_SETTLED" | "SETTLED" = allAccountedFor
        ? "SETTLED"
        : anySold
          ? "PARTIAL_SETTLED"
          : "SHIPPED";
  
      const updated = await tx.consignmentShipment.update({
        where: { id },
        data: {
          status: nextStatus,
          settledAt: nextStatus === "SETTLED" ? new Date() : shipment.settledAt,
        },
      });
  
      await tx.auditLog.create({
        data: {
          userId,
          action: "CONSIGNMENT_SALES_RECORDED",
          entityType: "ConsignmentShipment",
          entityId: id,
          newValue: {
            shipmentNumber: shipment.shipmentNumber,
            entries: parsed.data.entries as unknown as Prisma.InputJsonValue,
            notes: parsed.data.notes,
            newStatus: nextStatus,
          },
        },
      });
  
      return updated;
    });
  
    return Response.json({ data: result });
  } catch (error) {
    return handleApiError(error);
  }
}
