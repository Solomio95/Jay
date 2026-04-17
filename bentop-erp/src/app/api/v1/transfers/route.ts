import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { transferCreateSchema } from "@/lib/validators/inventory";
import { generateTransferNumber } from "@/lib/utils";
import type { Prisma } from "@prisma/client";
import { handleApiError } from "@/lib/api-error";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }
  
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status");
    const locationId = searchParams.get("locationId");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "20")));
  
    const where: Prisma.StockTransferWhereInput = {};
    if (status) where.status = status as Prisma.StockTransferWhereInput["status"];
    if (locationId) {
      where.OR = [{ fromLocationId: locationId }, { toLocationId: locationId }];
    }
  
    const [transfers, total] = await Promise.all([
      prisma.stockTransfer.findMany({
        where,
        include: {
          fromLocation: { select: { id: true, name: true } },
          toLocation: { select: { id: true, name: true } },
          requestedBy: { select: { id: true, name: true } },
          approvedBy: { select: { id: true, name: true } },
          completedBy: { select: { id: true, name: true } },
          items: {
            include: {
              productVariant: {
                select: {
                  id: true,
                  sku: true,
                  size: true,
                  color: true,
                  product: { select: { name: true } },
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.stockTransfer.count({ where }),
    ]);
  
    return Response.json({
      data: transfers,
      pagination: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

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
    if (role === "VIEWER") {
      return Response.json(
        { error: { code: "FORBIDDEN", message: "Insufficient permissions" } },
        { status: 403 }
      );
    }
  
    const body = await request.json();
    const parsed = transferCreateSchema.safeParse(body);
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
  
    // Verify locations
    const [fromLoc, toLoc] = await Promise.all([
      prisma.location.findUnique({ where: { id: data.fromLocationId } }),
      prisma.location.findUnique({ where: { id: data.toLocationId } }),
    ]);
    if (!fromLoc || !toLoc || !fromLoc.isActive || !toLoc.isActive) {
      return Response.json(
        { error: { code: "NOT_FOUND", message: "Location not found or inactive" } },
        { status: 404 }
      );
    }
  
    // Verify available stock at source
    for (const item of data.items) {
      const available = await prisma.stockLevel.aggregate({
        where: item.batchId
          ? {
              productVariantId: item.productVariantId,
              locationId: data.fromLocationId,
              batchId: item.batchId,
            }
          : {
              productVariantId: item.productVariantId,
              locationId: data.fromLocationId,
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
              message: `Only ${onHand} available at source for variant ${item.productVariantId}, requested ${item.quantity}`,
            },
          },
          { status: 409 }
        );
      }
    }
  
    const transfer = await prisma.$transaction(async (tx) => {
      const created = await tx.stockTransfer.create({
        data: {
          transferNumber: generateTransferNumber(),
          fromLocationId: data.fromLocationId,
          toLocationId: data.toLocationId,
          notes: data.notes,
          requestedById: userId,
          status: "REQUESTED",
          items: {
            create: data.items.map((i) => ({
              productVariantId: i.productVariantId,
              batchId: i.batchId,
              quantity: i.quantity,
            })),
          },
        },
        include: {
          items: true,
          fromLocation: true,
          toLocation: true,
        },
      });
  
      // Reserve stock at source: bump quantityReserved on aggregate rows
      for (const item of data.items) {
        const aggregate = await tx.stockLevel.findFirst({
          where: {
            productVariantId: item.productVariantId,
            locationId: data.fromLocationId,
            batchId: null,
          },
        });
        if (aggregate) {
          await tx.stockLevel.update({
            where: { id: aggregate.id },
            data: { quantityReserved: { increment: item.quantity } },
          });
        }
      }
  
      await tx.auditLog.create({
        data: {
          userId,
          action: "TRANSFER_REQUESTED",
          entityType: "StockTransfer",
          entityId: created.id,
          newValue: {
            transferNumber: created.transferNumber,
            from: fromLoc.name,
            to: toLoc.name,
            itemCount: data.items.length,
          },
        },
      });
  
      return created;
    });
  
    return Response.json({ data: transfer }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
