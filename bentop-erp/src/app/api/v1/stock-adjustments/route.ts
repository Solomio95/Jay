import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { stockAdjustmentSchema } from "@/lib/validators/inventory";
import { handleApiError } from "@/lib/api-error";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }
  
    const role = (session.user as unknown as { role: string }).role;
    // Adjustments require MANAGER or ADMIN — they rewrite counts
    if (role !== "ADMIN" && role !== "MANAGER") {
      return Response.json(
        { error: { code: "FORBIDDEN", message: "Only managers can perform adjustments" } },
        { status: 403 }
      );
    }
  
    const body = await request.json();
    const parsed = stockAdjustmentSchema.safeParse(body);
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
    if (!location) {
      return Response.json({ error: { code: "NOT_FOUND", message: "Location not found" } }, { status: 404 });
    }
  
    const result = await prisma.$transaction(async (tx) => {
      const movements = [];
      const changes = [];
  
      for (const item of data.items) {
        // Find current quantity (scope: per batch if batchId given, else aggregate row)
        const row = item.batchId
          ? await tx.stockLevel.findFirst({
              where: {
                productVariantId: item.productVariantId,
                locationId: data.locationId,
                batchId: item.batchId,
              },
            })
          : await tx.stockLevel.findFirst({
              where: {
                productVariantId: item.productVariantId,
                locationId: data.locationId,
                batchId: null,
              },
            });
  
        const currentQty = row?.quantityOnHand ?? 0;
        const delta = item.newQuantity - currentQty;
  
        if (delta === 0) continue;
  
        if (row) {
          await tx.stockLevel.update({
            where: { id: row.id },
            data: { quantityOnHand: item.newQuantity },
          });
        } else {
          await tx.stockLevel.create({
            data: {
              productVariantId: item.productVariantId,
              locationId: data.locationId,
              batchId: item.batchId ?? null,
              quantityOnHand: item.newQuantity,
            },
          });
        }
  
        // If aggregate adjustment, also adjust aggregate (else leave batch-level change in place
        // and keep aggregate consistent)
        if (item.batchId) {
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
              data: { quantityOnHand: { increment: delta } },
            });
          }
        }
  
        const movement = await tx.stockMovement.create({
          data: {
            productVariantId: item.productVariantId,
            batchId: item.batchId,
            fromLocationId: delta < 0 ? data.locationId : null,
            toLocationId: delta > 0 ? data.locationId : null,
            movementType: "ADJUSTMENT",
            quantity: Math.abs(delta),
            reason: data.reason,
            performedById: userId,
            approvedById: userId,
            notes: data.notes,
          },
        });
        movements.push(movement);
        changes.push({
          productVariantId: item.productVariantId,
          batchId: item.batchId ?? null,
          from: currentQty,
          to: item.newQuantity,
          delta,
        });
      }
  
      await tx.auditLog.create({
        data: {
          userId,
          action: "STOCK_ADJUSTMENT",
          entityType: "StockLevel",
          entityId: data.locationId,
          oldValue: { changes: changes.map((c) => ({ ...c, qty: c.from })) },
          newValue: {
            locationId: data.locationId,
            reason: data.reason,
            changes: changes.map((c) => ({ ...c, qty: c.to })),
          },
        },
      });
  
      return { movements, changes };
    });
  
    return Response.json(
      {
        data: result,
        meta: {
          itemsAdjusted: result.changes.length,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
