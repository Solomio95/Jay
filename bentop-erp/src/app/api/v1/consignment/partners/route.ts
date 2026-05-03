import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";
import {
  consignmentPartnerUpsertSchema,
  type ConsignmentPartnerUpsertInput,
} from "@/lib/validators/consignment";

export function canMutateConsignmentPartners(role: string | undefined) {
  return role === "ADMIN" || role === "MANAGER";
}

export function buildPartnerListArgs() {
  return {
    where: { isActive: true },
    include: {
      location: true,
      commissionTiers: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
      },
      overrides: {
        where: { isActive: true },
      },
    },
    orderBy: { name: "asc" },
  } satisfies Prisma.ConsignmentPartnerFindManyArgs;
}

export function buildPartnerWriteData(data: ConsignmentPartnerUpsertInput) {
  return {
    name: data.name,
    contactPerson: data.contactPerson ?? null,
    contactPhone: data.contactPhone ?? null,
    contactEmail: data.contactEmail ?? null,
    locationId: data.locationId ?? null,
    paymentTermsDays: data.paymentTermsDays ?? null,
    commissionTiers: {
      create: data.tiers.map((tier) => ({
        name: tier.name,
        minPrice: new Prisma.Decimal(tier.minPrice),
        maxPrice: tier.maxPrice === null ? null : new Prisma.Decimal(tier.maxPrice),
        commissionRate: new Prisma.Decimal(tier.commissionRate),
        sortOrder: tier.sortOrder,
        isActive: true,
      })),
    },
    overrides: {
      create: data.overrides.map((override) => ({
        productId: override.productId ?? null,
        productVariantId: override.productVariantId ?? null,
        tierName: override.tierName,
        commissionRate: new Prisma.Decimal(override.commissionRate),
        notes: override.notes ?? null,
        isActive: true,
      })),
    },
  };
}

export function buildPartnerMutationInclude() {
  return {
    location: true,
    commissionTiers: {
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    },
    overrides: {
      where: { isActive: true },
    },
  } satisfies Prisma.ConsignmentPartnerInclude;
}

export function buildPartnerAuditLogData({
  userId,
  action,
  entityId,
  data,
}: {
  userId: string;
  action: "CONSIGNMENT_PARTNER_CREATED" | "CONSIGNMENT_PARTNER_UPDATED";
  entityId: string;
  data: ConsignmentPartnerUpsertInput;
}) {
  return {
    userId,
    action,
    entityType: "ConsignmentPartner",
    entityId,
    newValue: {
      name: data.name,
      tierCount: data.tiers.length,
      overrideCount: data.overrides.length,
    },
  };
}

export async function createPartnerWithAudit(
  tx: Prisma.TransactionClient,
  data: ConsignmentPartnerUpsertInput,
  userId: string,
) {
  const partner = await tx.consignmentPartner.create({
    data: buildPartnerWriteData(data),
    include: buildPartnerMutationInclude(),
  });

  await tx.auditLog.create({
    data: buildPartnerAuditLogData({
      userId,
      action: "CONSIGNMENT_PARTNER_CREATED",
      entityId: partner.id,
      data,
    }),
  });

  return partner;
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 },
      );
    }

    const partners = await prisma.consignmentPartner.findMany(buildPartnerListArgs());

    return Response.json({ data: partners });
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

    const partner = await prisma.$transaction((tx) =>
      createPartnerWithAudit(tx, parsed.data, session.user.id),
    );

    return Response.json({ data: partner }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
