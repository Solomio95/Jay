import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { transferCreateSchema } from "@/lib/validators/inventory";
import { generateTransferNumber } from "@/lib/utils";
import type { Prisma } from "@prisma/client";
import { handleApiError } from "@/lib/api-error";
import {
  assertEnoughAvailableStock,
  calculateAvailableStock,
  mergeRequestedQuantities,
} from "@/lib/inventory/reservation";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }
  
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { supervisedLocations: { select: { id: true } } },
    });
    if (!user) {
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
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : []),
        { OR: [{ fromLocationId: locationId }, { toLocationId: locationId }] },
      ];
    }

    if (user.role === "PROMOTER") {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : []),
        { requestedById: user.id },
      ];
    } else if (user.role === "SUPERVISOR") {
      const supervisedLocationIds = user.supervisedLocations.map((location) => location.id);
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : []),
        {
          OR: [
            { fromLocationId: { in: supervisedLocationIds } },
            { toLocationId: { in: supervisedLocationIds } },
          ],
        },
      ];
    } else if (user.role !== "ADMIN" && user.role !== "MANAGER") {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : []),
        { requestedById: user.id },
      ];
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
  
    const transfer = await prisma.$transaction(async (tx) => {
      await assertTransferStockAvailable({
        tx,
        fromLocationId: data.fromLocationId,
        items: data.items,
      });

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
  
      for (const [productVariantId, quantity] of mergeRequestedQuantities(data.items)) {
        const aggregate = await tx.stockLevel.findFirst({
          where: {
            productVariantId,
            locationId: data.fromLocationId,
            batchId: null,
          },
        });
        if (aggregate) {
          await tx.stockLevel.update({
            where: { id: aggregate.id },
            data: { quantityReserved: { increment: quantity } },
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
    if (error instanceof Error && error.message.startsWith("INSUFFICIENT_STOCK:")) {
      return Response.json(
        {
          error: {
            code: "INSUFFICIENT_STOCK",
            message: error.message.slice("INSUFFICIENT_STOCK:".length),
          },
        },
        { status: 409 },
      );
    }

    return handleApiError(error);
  }
}

async function assertTransferStockAvailable(input: {
  tx: Prisma.TransactionClient;
  fromLocationId: string;
  items: Array<{ productVariantId: string; quantity: number }>;
}) {
  const requestedQuantities = mergeRequestedQuantities(input.items);

  for (const [productVariantId, quantity] of requestedQuantities) {
    const aggregate = await input.tx.stockLevel.findFirst({
      where: {
        productVariantId,
        locationId: input.fromLocationId,
        batchId: null,
      },
    });
    const available = calculateAvailableStock(
      aggregate?.quantityOnHand ?? 0,
      aggregate?.quantityReserved ?? 0,
    );

    assertEnoughAvailableStock({
      available,
      requested: quantity,
      itemLabel: productVariantId,
    });
  }
}
