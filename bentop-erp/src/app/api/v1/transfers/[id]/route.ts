import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { transferActionSchema } from "@/lib/validators/inventory";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return Response.json(
      { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  const { id } = await params;
  const transfer = await prisma.stockTransfer.findUnique({
    where: { id },
    include: {
      fromLocation: true,
      toLocation: true,
      requestedBy: { select: { id: true, name: true, email: true } },
      approvedBy: { select: { id: true, name: true, email: true } },
      completedBy: { select: { id: true, name: true, email: true } },
      items: {
        include: {
          productVariant: {
            select: {
              id: true,
              sku: true,
              size: true,
              color: true,
              colorHex: true,
              product: { select: { id: true, name: true, skuPrefix: true } },
            },
          },
          batch: { select: { id: true, batchNumber: true } },
        },
      },
    },
  });

  if (!transfer) {
    return Response.json({ error: { code: "NOT_FOUND", message: "Transfer not found" } }, { status: 404 });
  }

  return Response.json({ data: transfer });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return Response.json(
      { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  const role = (session.user as unknown as { role: string }).role;
  const userId = session.user.id;
  const { id } = await params;

  const body = await request.json();
  const parsed = transferActionSchema.safeParse(body);
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

  const { action, notes } = parsed.data;

  const transfer = await prisma.stockTransfer.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!transfer) {
    return Response.json({ error: { code: "NOT_FOUND", message: "Transfer not found" } }, { status: 404 });
  }

  // State machine validation
  if (action === "APPROVE" && transfer.status !== "REQUESTED") {
    return Response.json(
      { error: { code: "INVALID_STATE", message: `Cannot approve transfer in ${transfer.status} state` } },
      { status: 409 }
    );
  }
  if (action === "COMPLETE" && transfer.status !== "APPROVED") {
    return Response.json(
      { error: { code: "INVALID_STATE", message: `Cannot complete transfer in ${transfer.status} state` } },
      { status: 409 }
    );
  }
  if (action === "CANCEL" && (transfer.status === "COMPLETED" || transfer.status === "CANCELLED")) {
    return Response.json(
      { error: { code: "INVALID_STATE", message: `Cannot cancel transfer in ${transfer.status} state` } },
      { status: 409 }
    );
  }

  // Permission: only MANAGER/ADMIN can approve; any non-VIEWER can complete their own approved; only ADMIN/MANAGER cancel
  if (action === "APPROVE" && role !== "ADMIN" && role !== "MANAGER") {
    return Response.json(
      { error: { code: "FORBIDDEN", message: "Only managers can approve transfers" } },
      { status: 403 }
    );
  }
  if (role === "VIEWER") {
    return Response.json({ error: { code: "FORBIDDEN", message: "Read-only role" } }, { status: 403 });
  }

  const result = await prisma.$transaction(async (tx) => {
    if (action === "APPROVE") {
      const updated = await tx.stockTransfer.update({
        where: { id },
        data: {
          status: "APPROVED",
          approvedById: userId,
          approvedAt: new Date(),
          notes: notes ?? transfer.notes,
        },
      });
      await tx.auditLog.create({
        data: {
          userId,
          action: "TRANSFER_APPROVED",
          entityType: "StockTransfer",
          entityId: id,
          newValue: { transferNumber: transfer.transferNumber },
        },
      });
      return updated;
    }

    if (action === "CANCEL") {
      // Release the reservation at source (if still REQUESTED/APPROVED)
      if (transfer.status === "REQUESTED" || transfer.status === "APPROVED") {
        for (const item of transfer.items) {
          const aggregate = await tx.stockLevel.findFirst({
            where: {
              productVariantId: item.productVariantId,
              locationId: transfer.fromLocationId,
              batchId: null,
            },
          });
          if (aggregate) {
            await tx.stockLevel.update({
              where: { id: aggregate.id },
              data: { quantityReserved: { decrement: item.quantity } },
            });
          }
        }
      }

      const updated = await tx.stockTransfer.update({
        where: { id },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          notes: notes ?? transfer.notes,
        },
      });
      await tx.auditLog.create({
        data: {
          userId,
          action: "TRANSFER_CANCELLED",
          entityType: "StockTransfer",
          entityId: id,
          newValue: { transferNumber: transfer.transferNumber },
        },
      });
      return updated;
    }

    // COMPLETE: actually move stock, create movements, release reservations
    for (const item of transfer.items) {
      let remaining = item.quantity;

      // FIFO deduct from source batches
      const sourceRows = await tx.stockLevel.findMany({
        where: item.batchId
          ? {
              productVariantId: item.productVariantId,
              locationId: transfer.fromLocationId,
              batchId: item.batchId,
              quantityOnHand: { gt: 0 },
            }
          : {
              productVariantId: item.productVariantId,
              locationId: transfer.fromLocationId,
              batchId: { not: null },
              quantityOnHand: { gt: 0 },
            },
        include: { batch: true },
        orderBy: { batch: { productionDate: "asc" } },
      });

      for (const row of sourceRows) {
        if (remaining <= 0) break;
        const take = Math.min(remaining, row.quantityOnHand);
        // row.batchId is guaranteed non-null by the where clause above
        const rowBatchId = row.batchId as string;

        // Decrement source
        await tx.stockLevel.update({
          where: { id: row.id },
          data: { quantityOnHand: { decrement: take } },
        });

        // Increment destination (per batch)
        const destRow = await tx.stockLevel.findFirst({
          where: {
            productVariantId: item.productVariantId,
            locationId: transfer.toLocationId,
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
              locationId: transfer.toLocationId,
              batchId: rowBatchId,
              quantityOnHand: take,
            },
          });
        }

        // Create two movements: OUT from source, IN to dest (as TRANSFER)
        await tx.stockMovement.create({
          data: {
            productVariantId: item.productVariantId,
            batchId: row.batchId,
            fromLocationId: transfer.fromLocationId,
            toLocationId: transfer.toLocationId,
            movementType: "TRANSFER",
            quantity: take,
            referenceNumber: transfer.transferNumber,
            performedById: userId,
            approvedById: transfer.approvedById,
          },
        });

        remaining -= take;
      }

      // Adjust aggregate rows on both sides
      const sourceAgg = await tx.stockLevel.findFirst({
        where: {
          productVariantId: item.productVariantId,
          locationId: transfer.fromLocationId,
          batchId: null,
        },
      });
      if (sourceAgg) {
        await tx.stockLevel.update({
          where: { id: sourceAgg.id },
          data: {
            quantityOnHand: { decrement: item.quantity },
            quantityReserved: { decrement: item.quantity },
          },
        });
      }

      const destAgg = await tx.stockLevel.findFirst({
        where: {
          productVariantId: item.productVariantId,
          locationId: transfer.toLocationId,
          batchId: null,
        },
      });
      if (destAgg) {
        await tx.stockLevel.update({
          where: { id: destAgg.id },
          data: { quantityOnHand: { increment: item.quantity } },
        });
      } else {
        await tx.stockLevel.create({
          data: {
            productVariantId: item.productVariantId,
            locationId: transfer.toLocationId,
            batchId: null,
            quantityOnHand: item.quantity,
          },
        });
      }
    }

    const updated = await tx.stockTransfer.update({
      where: { id },
      data: {
        status: "COMPLETED",
        completedById: userId,
        completedAt: new Date(),
        notes: notes ?? transfer.notes,
      },
    });

    await tx.auditLog.create({
      data: {
        userId,
        action: "TRANSFER_COMPLETED",
        entityType: "StockTransfer",
        entityId: id,
        newValue: {
          transferNumber: transfer.transferNumber,
          totalUnits: transfer.items.reduce((s, i) => s + i.quantity, 0),
        },
      },
    });

    return updated;
  });

  return Response.json({ data: result });
}
