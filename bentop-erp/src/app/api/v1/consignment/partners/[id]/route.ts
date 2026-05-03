import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";
import {
  consignmentPartnerUpsertSchema,
  type ConsignmentPartnerUpsertInput,
} from "@/lib/validators/consignment";
import {
  buildPartnerAuditLogData,
  buildPartnerWriteData,
  canMutateConsignmentPartners,
} from "../route";

export function buildPartnerDetailArgs(id: string) {
  return {
    where: { id },
    include: buildPartnerDetailInclude(),
  } satisfies Prisma.ConsignmentPartnerFindUniqueArgs;
}

export function buildPartnerDetailInclude() {
  return {
    location: true,
    commissionTiers: {
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    },
    overrides: {
      where: { isActive: true },
      include: {
        product: { select: { id: true, name: true, skuPrefix: true } },
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
      },
    },
  } satisfies Prisma.ConsignmentPartnerInclude;
}

export function buildPartnerSetupInactivationArgs(partnerId: string) {
  return {
    tiers: {
      where: { partnerId, isActive: true },
      data: { isActive: false },
    },
    overrides: {
      where: { partnerId, isActive: true },
      data: { isActive: false },
    },
  };
}

export function buildPartnerUpdateData(data: ConsignmentPartnerUpsertInput) {
  return buildPartnerWriteData(data);
}

export async function updatePartnerWithAudit(
  tx: Prisma.TransactionClient,
  id: string,
  data: ConsignmentPartnerUpsertInput,
  userId: string,
) {
  const inactivation = buildPartnerSetupInactivationArgs(id);
  await tx.consignmentCommissionTier.updateMany(inactivation.tiers);
  await tx.consignmentCommissionOverride.updateMany(inactivation.overrides);

  const partner = await tx.consignmentPartner.update({
    where: { id },
    data: buildPartnerUpdateData(data),
    include: buildPartnerDetailInclude(),
  });

  await tx.auditLog.create({
    data: buildPartnerAuditLogData({
      userId,
      action: "CONSIGNMENT_PARTNER_UPDATED",
      entityId: id,
      data,
    }),
  });

  return partner;
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 },
      );
    }

    const { id } = await params;
    const partner = await prisma.consignmentPartner.findUnique(buildPartnerDetailArgs(id));
    if (!partner) {
      return Response.json(
        { error: { code: "NOT_FOUND", message: "Partner not found" } },
        { status: 404 },
      );
    }

    return Response.json({ data: partner });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 },
      );
    }

    const role = (session.user as unknown as { role?: string }).role;
    if (!canMutateConsignmentPartners(role)) {
      return Response.json(
        { error: { code: "FORBIDDEN", message: "Insufficient permissions" } },
        { status: 403 },
      );
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = consignmentPartnerUpsertSchema.safeParse(body);
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

    const existing = await prisma.consignmentPartner.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      return Response.json(
        { error: { code: "NOT_FOUND", message: "Partner not found" } },
        { status: 404 },
      );
    }

    const partner = await prisma.$transaction((tx) =>
      updatePartnerWithAudit(tx, id, parsed.data, session.user.id),
    );

    return Response.json({ data: partner });
  } catch (error) {
    return handleApiError(error);
  }
}
