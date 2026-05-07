import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { consignmentShipmentCreateSchema } from "@/lib/validators/consignment";
import { generateConsignmentNumber } from "@/lib/utils";
import { handleApiError } from "@/lib/api-error";
import { canManageConsignment, canViewReports, forbiddenResponse } from "@/lib/permissions";

type ShipmentPartnerFieldsInput = {
  partnerId?: string | null;
  partnerName?: string | null;
};

type ShipmentPartnerIdentity = {
  id: string;
  name: string;
  locationId?: string | null;
};

export function buildActiveShipmentPartnerArgs(partnerId: string) {
  return {
    where: { id: partnerId, isActive: true },
    include: {
      commissionTiers: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  } satisfies Prisma.ConsignmentPartnerFindFirstArgs;
}

export function buildShipmentPartnerCreateFields(
  data: ShipmentPartnerFieldsInput,
  partner?: ShipmentPartnerIdentity | null,
) {
  if (partner) {
    return {
      partnerId: partner.id,
      partnerName: partner.name,
    };
  }

  return {
    partnerId: null,
    partnerName: data.partnerName ?? "",
  };
}

export function getPartnerLocationValidationError(
  toLocationId: string,
  partner?: ShipmentPartnerIdentity | null,
) {
  if (!partner?.locationId || partner.locationId === toLocationId) {
    return null;
  }

  return {
    code: "VALIDATION_ERROR",
    message: "Selected partner must match the consignee location",
  };
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const role = (session.user as unknown as { role: string }).role;
    if (!canViewReports(role) && !canManageConsignment(role)) {
      return forbiddenResponse();
    }
  
    const sp = request.nextUrl.searchParams;
    const search = sp.get("search")?.trim() ?? "";
    const status = sp.get("status");
    const toLocationId = sp.get("toLocationId");
    const from = sp.get("from");
    const to = sp.get("to");
    const limit = Math.min(parseInt(sp.get("limit") ?? "25", 10), 200);
    const page = Math.max(parseInt(sp.get("page") ?? "1", 10), 1);
  
    const where: Prisma.ConsignmentShipmentWhereInput = {};
    if (status) where.status = status as Prisma.ConsignmentShipmentWhereInput["status"];
    if (toLocationId) where.toLocationId = toLocationId;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }
    if (search) {
      where.OR = [
        { shipmentNumber: { contains: search, mode: "insensitive" } },
        { partnerName: { contains: search, mode: "insensitive" } },
        { notes: { contains: search, mode: "insensitive" } },
      ];
    }
  
    const [items, total] = await Promise.all([
      prisma.consignmentShipment.findMany({
        where,
        include: {
          fromLocation: { select: { id: true, name: true } },
          toLocation: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true } },
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: (page - 1) * limit,
      }),
      prisma.consignmentShipment.count({ where }),
    ]);
  
    return Response.json({ data: items, meta: { total, page, limit } });
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
    if (!canManageConsignment(role)) {
      return forbiddenResponse();
    }
  
    const userId = session.user.id;
    const body = await request.json();
    const parsed = consignmentShipmentCreateSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        {
          error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() },
        },
        { status: 400 }
      );
    }
    const data = parsed.data;
    const selectedPartnerId = data.partnerId?.trim() || null;
  
    if (data.fromLocationId === data.toLocationId) {
      return Response.json(
        { error: { code: "VALIDATION_ERROR", message: "Source and consignee must differ" } },
        { status: 400 }
      );
    }
  
    const [fromLoc, toLoc] = await Promise.all([
      prisma.location.findUnique({ where: { id: data.fromLocationId } }),
      prisma.location.findUnique({ where: { id: data.toLocationId } }),
    ]);
    if (!fromLoc || !fromLoc.isActive) {
      return Response.json({ error: { code: "NOT_FOUND", message: "Source location not found" } }, { status: 404 });
    }
    if (!toLoc || !toLoc.isActive) {
      return Response.json({ error: { code: "NOT_FOUND", message: "Consignee location not found" } }, { status: 404 });
    }
    if (toLoc.type !== "CONSIGNMENT") {
      return Response.json(
        { error: { code: "VALIDATION_ERROR", message: "Consignee location must be of type CONSIGNMENT" } },
        { status: 400 }
      );
    }

    const selectedPartner = selectedPartnerId
      ? await prisma.consignmentPartner.findFirst(buildActiveShipmentPartnerArgs(selectedPartnerId))
      : null;
    if (selectedPartnerId && !selectedPartner) {
      return Response.json(
        { error: { code: "NOT_FOUND", message: "Consignment partner not found" } },
        { status: 404 },
      );
    }
    const partnerLocationError = getPartnerLocationValidationError(
      data.toLocationId,
      selectedPartner,
    );
    if (partnerLocationError) {
      return Response.json({ error: partnerLocationError }, { status: 400 });
    }
    const shipmentPartner = buildShipmentPartnerCreateFields(data, selectedPartner);
  
    const variantIds = [...new Set(data.items.map((i) => i.productVariantId))];
    const variants = await prisma.productVariant.findMany({
      where: { id: { in: variantIds } },
      include: { product: true },
    });
    if (variants.length !== variantIds.length) {
      return Response.json({ error: { code: "NOT_FOUND", message: "One or more variants not found" } }, { status: 404 });
    }
    const variantMap = new Map(variants.map((v) => [v.id, v]));
  
    // Pre-flight stock check when shipping immediately
    if (data.ship) {
      for (const item of data.items) {
        const agg = await prisma.stockLevel.aggregate({
          where: {
            productVariantId: item.productVariantId,
            locationId: data.fromLocationId,
            batchId: { not: null },
          },
          _sum: { quantityOnHand: true },
        });
        let onHand = agg._sum.quantityOnHand ?? 0;
        const aggRow = await prisma.stockLevel.findFirst({
          where: {
            productVariantId: item.productVariantId,
            locationId: data.fromLocationId,
            batchId: null,
          },
        });
        if (onHand === 0 && !item.batchId) {
          onHand = aggRow?.quantityOnHand ?? 0;
        }
        const reserved = aggRow?.quantityReserved ?? 0;
        const availableForSale = onHand - reserved;
        if (availableForSale < item.quantityShipped) {
          const v = variantMap.get(item.productVariantId);
          return Response.json(
            {
              error: {
                code: "INSUFFICIENT_STOCK",
                message: `Only ${availableForSale} available for ${v?.sku ?? item.productVariantId}, requested ${item.quantityShipped}`,
              },
            },
            { status: 409 }
          );
        }
      }
    }
  
    const shipmentNumber = generateConsignmentNumber();
    const initialStatus = data.ship ? "SHIPPED" : "DRAFT";
  
    const result = await prisma.$transaction(async (tx) => {
      const shipment = await tx.consignmentShipment.create({
        data: {
          shipmentNumber,
          fromLocationId: data.fromLocationId,
          toLocationId: data.toLocationId,
          partnerId: shipmentPartner.partnerId,
          partnerName: shipmentPartner.partnerName,
          partnerContact: data.partnerContact ?? null,
          commissionRate: new Prisma.Decimal(data.commissionRate ?? 0),
          status: initialStatus,
          notes: data.notes ?? null,
          createdById: userId,
          shippedAt: data.ship ? new Date() : null,
          items: {
            create: data.items.map((i) => {
              const v = variantMap.get(i.productVariantId)!;
              const cost = Number(v.product.baseCostMyr) + Number(v.additionalCost);
              return {
                productVariantId: i.productVariantId,
                batchId: i.batchId || null,
                quantityShipped: i.quantityShipped,
                unitPrice: new Prisma.Decimal(i.unitPrice),
                costAtShipment: new Prisma.Decimal(cost),
              };
            }),
          },
        },
        include: { items: true },
      });
  
      // If shipping immediately, execute FIFO stock move to consignee
      if (data.ship) {
        for (const item of shipment.items) {
          let remaining = item.quantityShipped;
  
          const sourceRows = await tx.stockLevel.findMany({
            where: item.batchId
              ? {
                  productVariantId: item.productVariantId,
                  locationId: data.fromLocationId,
                  batchId: item.batchId,
                  quantityOnHand: { gt: 0 },
                }
              : {
                  productVariantId: item.productVariantId,
                  locationId: data.fromLocationId,
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
                locationId: data.fromLocationId,
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
                locationId: data.toLocationId,
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
                  locationId: data.toLocationId,
                  batchId: null,
                  quantityOnHand: item.quantityShipped,
                },
              });
            }

            await tx.stockMovement.create({
              data: {
                productVariantId: item.productVariantId,
                batchId: null,
                fromLocationId: data.fromLocationId,
                toLocationId: data.toLocationId,
                movementType: "CONSIGNMENT_OUT",
                quantity: item.quantityShipped,
                referenceNumber: shipmentNumber,
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
                locationId: data.toLocationId,
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
                  locationId: data.toLocationId,
                  batchId: rowBatchId,
                  quantityOnHand: take,
                },
              });
            }
  
            await tx.stockMovement.create({
              data: {
                productVariantId: item.productVariantId,
                batchId: rowBatchId,
                fromLocationId: data.fromLocationId,
                toLocationId: data.toLocationId,
                movementType: "CONSIGNMENT_OUT",
                quantity: take,
                referenceNumber: shipmentNumber,
                performedById: userId,
              },
            });
  
            remaining -= take;
          }
  
          // Aggregate adjustments
          const sourceAgg = await tx.stockLevel.findFirst({
            where: {
              productVariantId: item.productVariantId,
              locationId: data.fromLocationId,
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
              locationId: data.toLocationId,
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
                locationId: data.toLocationId,
                batchId: null,
                quantityOnHand: item.quantityShipped,
              },
            });
          }
        }
      }
  
      await tx.auditLog.create({
        data: {
          userId,
          action: data.ship ? "CONSIGNMENT_SHIPPED" : "CONSIGNMENT_DRAFTED",
          entityType: "ConsignmentShipment",
          entityId: shipment.id,
          newValue: {
            shipmentNumber: shipment.shipmentNumber,
            partnerName: shipment.partnerName,
            itemCount: shipment.items.length,
          },
        },
      });
  
      return shipment;
    });
  
    return Response.json({ data: result }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
