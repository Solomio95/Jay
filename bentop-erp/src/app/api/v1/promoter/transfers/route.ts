import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getAllowedPromoterLocationIds, assertPromoterLocationAllowed } from "@/lib/promoter/access";
import { promoterTransferRequestSchema } from "@/lib/validators/promoter";
import { generateTransferNumber } from "@/lib/utils";
import { handleApiError } from "@/lib/api-error";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 },
      );
    }

    const parsed = promoterTransferRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid input",
            details: parsed.error.flatten(),
          },
        },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { temporaryLocations: true },
    });

    if (!user || user.role !== "PROMOTER") {
      return Response.json(
        { error: { code: "FORBIDDEN", message: "Promoter access required" } },
        { status: 403 },
      );
    }

    const data = parsed.data;
    const allowedLocationIds = getAllowedPromoterLocationIds({
      now: new Date(),
      defaultLocationId: user.defaultLocationId,
      temporaryLocations: user.temporaryLocations,
    });

    assertPromoterLocationAllowed({
      requestedLocationId: data.toLocationId,
      allowedLocationIds,
    });

    if (data.fromLocationId === data.toLocationId) {
      return Response.json(
        { error: { code: "VALIDATION_ERROR", message: "Source and destination must differ" } },
        { status: 400 },
      );
    }

    const [fromLocation, toLocation, variant] = await Promise.all([
      prisma.location.findUnique({ where: { id: data.fromLocationId } }),
      prisma.location.findUnique({
        where: { id: data.toLocationId },
        include: { supervisors: true },
      }),
      prisma.productVariant.findUnique({
        where: { id: data.productVariantId },
        include: { product: { select: { name: true, skuPrefix: true } } },
      }),
    ]);

    if (!fromLocation || !toLocation || !fromLocation.isActive || !toLocation.isActive) {
      return Response.json(
        { error: { code: "NOT_FOUND", message: "Location not found or inactive" } },
        { status: 404 },
      );
    }

    if (!variant || !variant.isActive) {
      return Response.json(
        { error: { code: "NOT_FOUND", message: "Product variant not found or inactive" } },
        { status: 404 },
      );
    }

    const aggregate = await prisma.stockLevel.findFirst({
      where: {
        productVariantId: data.productVariantId,
        locationId: data.fromLocationId,
        batchId: null,
      },
    });
    const available = (aggregate?.quantityOnHand ?? 0) - (aggregate?.quantityReserved ?? 0);

    if (available < data.quantity) {
      return Response.json(
        {
          error: {
            code: "INSUFFICIENT_STOCK",
            message: `Only ${Math.max(0, available)} available at ${fromLocation.name}`,
          },
        },
        { status: 409 },
      );
    }

    const transfer = await prisma.$transaction(async (tx) => {
      const created = await tx.stockTransfer.create({
        data: {
          transferNumber: generateTransferNumber(),
          fromLocationId: data.fromLocationId,
          toLocationId: data.toLocationId,
          requestedById: user.id,
          status: "REQUESTED",
          notes: data.notes ?? "Promoter transfer request",
          items: {
            create: {
              productVariantId: data.productVariantId,
              quantity: data.quantity,
            },
          },
        },
        include: {
          fromLocation: { select: { id: true, name: true } },
          toLocation: { select: { id: true, name: true } },
          items: true,
        },
      });

      if (aggregate) {
        await tx.stockLevel.update({
          where: { id: aggregate.id },
          data: { quantityReserved: { increment: data.quantity } },
        });
      }

      const escalatesAt = new Date(Date.now() + 4 * 60 * 60 * 1000);
      const notificationBody = `${user.name} requested ${data.quantity} unit(s) of ${variant.sku} from ${fromLocation.name} to ${toLocation.name}.`;

      if (toLocation.supervisors.length > 0) {
        await tx.notification.createMany({
          data: toLocation.supervisors.map((supervisor) => ({
            userId: supervisor.id,
            title: "Transfer request pending",
            body: notificationBody,
            entityType: "StockTransfer",
            entityId: created.id,
            escalatesAt,
          })),
        });
      }

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "PROMOTER_TRANSFER_REQUESTED",
          entityType: "StockTransfer",
          entityId: created.id,
          newValue: {
            transferNumber: created.transferNumber,
            fromLocationId: data.fromLocationId,
            toLocationId: data.toLocationId,
            productVariantId: data.productVariantId,
            quantity: data.quantity,
          } satisfies Prisma.InputJsonObject,
        },
      });

      return created;
    });

    return Response.json({ data: transfer }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "PROMOTER_LOCATION_NOT_ALLOWED") {
      return Response.json(
        { error: { code: "FORBIDDEN", message: "Location is not allowed" } },
        { status: 403 },
      );
    }

    return handleApiError(error);
  }
}
