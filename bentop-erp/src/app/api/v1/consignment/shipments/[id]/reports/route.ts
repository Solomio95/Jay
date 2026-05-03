import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

import { auth } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";
import { calculateCommission } from "@/lib/consignment/commission";
import {
  ConsignmentReportFinalizeError,
  finalizeConsignmentReport,
} from "@/lib/consignment/finalize-report";
import { prisma } from "@/lib/db";
import { generateConsignmentReportNumber } from "@/lib/utils";
import {
  consignmentReportCreateSchema,
  type ConsignmentReportCreateInput,
} from "@/lib/validators/consignment";

type ReportLineInput = ConsignmentReportCreateInput["lines"][number];

type CommissionOverrideSnapshot = {
  productId: string | null;
  productVariantId: string | null;
  tierName: string;
  commissionRate: Prisma.Decimal | number | string;
};

type CommissionTierSnapshot = {
  name: string;
  minPrice: Prisma.Decimal | number | string;
  maxPrice: Prisma.Decimal | number | string | null;
  commissionRate: Prisma.Decimal | number | string;
};

type ShipmentItemForReport = {
  id: string;
  quantityShipped: number;
  quantitySold: number;
  quantityReturned: number;
};

export function canCreateConsignmentReport(role: string | undefined) {
  return role !== undefined && role !== "VIEWER";
}

export function buildShipmentReportListArgs(shipmentId: string) {
  return {
    where: { shipmentId },
    include: {
      lines: {
        include: {
          shipmentItem: {
            include: {
              productVariant: {
                include: {
                  product: { select: { id: true, name: true, skuPrefix: true } },
                },
              },
            },
          },
        },
      },
      invoices: {
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          invoiceDate: true,
          dueDate: true,
          grossAmount: true,
          commissionAmount: true,
          netAmount: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  } satisfies Prisma.ConsignmentReportFindManyArgs;
}

export function buildActivePartnerCommissionArgs(partnerId: string, now = new Date()) {
  return {
    where: { id: partnerId, isActive: true },
    include: {
      commissionTiers: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
      },
      overrides: {
        where: {
          isActive: true,
          OR: [{ startsAt: null }, { startsAt: { lte: now } }],
          AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
        },
      },
    },
  } satisfies Prisma.ConsignmentPartnerFindFirstArgs;
}

export function findApplicableOverride(
  productVariantId: string,
  productId: string,
  overrides: CommissionOverrideSnapshot[],
) {
  const override =
    overrides.find((item) => item.productVariantId === productVariantId) ??
    overrides.find((item) => item.productId === productId);

  if (!override) {
    return null;
  }

  return {
    tierName: override.tierName,
    commissionRate: Number(override.commissionRate),
  };
}

export function getReportLineQuantityValidationError(
  item: ShipmentItemForReport,
  line: ReportLineInput,
) {
  const reported = line.quantitySold + line.quantityReturned;
  const remaining = item.quantityShipped - item.quantitySold - item.quantityReturned;

  if (reported > remaining) {
    return {
      code: "VALIDATION_ERROR",
      message: `Cannot report ${reported} units; only ${remaining} remaining for this item`,
    };
  }

  return null;
}

export function buildReportLineCreateData({
  reportId,
  shipmentId,
  shipmentItemId,
  productVariantId,
  productId,
  quantitySold,
  quantityReturned,
  actualUnitPrice,
  tiers,
  overrides,
}: {
  reportId: string;
  shipmentId: string;
  shipmentItemId: string;
  productVariantId: string;
  productId: string;
  quantitySold: number;
  quantityReturned: number;
  actualUnitPrice: number;
  tiers: CommissionTierSnapshot[];
  overrides: CommissionOverrideSnapshot[];
}) {
  const commission = calculateCommission({
    actualUnitPrice,
    quantitySold,
    override: findApplicableOverride(productVariantId, productId, overrides),
    tiers: tiers.map((tier) => ({
      name: tier.name,
      minPrice: Number(tier.minPrice),
      maxPrice: tier.maxPrice === null ? null : Number(tier.maxPrice),
      commissionRate: Number(tier.commissionRate),
    })),
  });

  return {
    reportId,
    shipmentId,
    shipmentItemId,
    quantitySold,
    quantityReturned,
    actualUnitPrice: new Prisma.Decimal(actualUnitPrice),
    commissionTierName: commission.tierName,
    commissionRate: new Prisma.Decimal(commission.commissionRate),
    grossAmount: new Prisma.Decimal(commission.grossAmount),
    commissionAmount: new Prisma.Decimal(commission.commissionAmount),
    netAmount: new Prisma.Decimal(commission.netAmount),
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 },
      );
    }

    const { id } = await params;
    const reports = await prisma.consignmentReport.findMany(
      buildShipmentReportListArgs(id),
    );

    return Response.json({ data: reports });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 },
      );
    }

    const role = (session.user as unknown as { role?: string }).role;
    if (!canCreateConsignmentReport(role)) {
      return Response.json(
        { error: { code: "FORBIDDEN", message: "Read-only role" } },
        { status: 403 },
      );
    }

    const userId = session.user.id;
    const { id } = await params;
    const body = await request.json();
    const parsed = consignmentReportCreateSchema.safeParse(body);
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

    const periodStart = new Date(parsed.data.periodStart);
    const periodEnd = new Date(parsed.data.periodEnd);
    if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime())) {
      return Response.json(
        { error: { code: "VALIDATION_ERROR", message: "Invalid report period" } },
        { status: 400 },
      );
    }
    if (periodStart > periodEnd) {
      return Response.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Period start must be before period end",
          },
        },
        { status: 400 },
      );
    }

    const shipment = await prisma.consignmentShipment.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            productVariant: {
              include: {
                product: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });
    if (!shipment) {
      return Response.json(
        { error: { code: "NOT_FOUND", message: "Shipment not found" } },
        { status: 404 },
      );
    }

    if (shipment.status !== "SHIPPED" && shipment.status !== "PARTIAL_SETTLED") {
      return Response.json(
        {
          error: {
            code: "INVALID_STATE",
            message: `Cannot create report for shipment in ${shipment.status} state`,
          },
        },
        { status: 409 },
      );
    }

    if (!shipment.partnerId) {
      return Response.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Shipment must be linked to a consignment partner before reporting",
          },
        },
        { status: 400 },
      );
    }

    const partner = await prisma.consignmentPartner.findFirst(
      buildActivePartnerCommissionArgs(shipment.partnerId),
    );
    if (!partner) {
      return Response.json(
        { error: { code: "NOT_FOUND", message: "Consignment partner not found" } },
        { status: 404 },
      );
    }

    const itemMap = new Map(shipment.items.map((item) => [item.id, item]));
    const reportedByItem = new Map<string, number>();
    for (const line of parsed.data.lines) {
      const item = itemMap.get(line.shipmentItemId);
      if (!item) {
        return Response.json(
          {
            error: {
              code: "NOT_FOUND",
              message: `Item ${line.shipmentItemId} not found in shipment`,
            },
          },
          { status: 404 },
        );
      }

      const priorReported = reportedByItem.get(line.shipmentItemId) ?? 0;
      reportedByItem.set(
        line.shipmentItemId,
        priorReported + line.quantitySold + line.quantityReturned,
      );
      const quantityError = getReportLineQuantityValidationError(
        {
          id: item.id,
          quantityShipped: item.quantityShipped,
          quantitySold: item.quantitySold + priorReported,
          quantityReturned: item.quantityReturned,
        },
        line,
      );
      if (quantityError) {
        return Response.json({ error: quantityError }, { status: 409 });
      }
    }

    const created = await prisma.$transaction(async (tx) => {
      const report = await tx.consignmentReport.create({
        data: {
          reportNumber: generateConsignmentReportNumber(),
          partnerId: shipment.partnerId as string,
          shipmentId: shipment.id,
          periodStart,
          periodEnd,
          grossAmount: new Prisma.Decimal(0),
          commissionAmount: new Prisma.Decimal(0),
          netAmount: new Prisma.Decimal(0),
          notes: parsed.data.notes ?? null,
          createdById: userId,
        },
      });

      const lines = parsed.data.lines.map((line) => {
        const item = itemMap.get(line.shipmentItemId)!;

        return buildReportLineCreateData({
          reportId: report.id,
          shipmentId: shipment.id,
          shipmentItemId: line.shipmentItemId,
          productVariantId: item.productVariantId,
          productId: item.productVariant.product.id,
          quantitySold: line.quantitySold,
          quantityReturned: line.quantityReturned,
          actualUnitPrice: line.actualUnitPrice,
          tiers: partner.commissionTiers,
          overrides: partner.overrides,
        });
      });

      await tx.consignmentReportLine.createMany({ data: lines });

      const totals = lines.reduce(
        (sum, line) => ({
          grossAmount: sum.grossAmount.plus(line.grossAmount),
          commissionAmount: sum.commissionAmount.plus(line.commissionAmount),
          netAmount: sum.netAmount.plus(line.netAmount),
        }),
        {
          grossAmount: new Prisma.Decimal(0),
          commissionAmount: new Prisma.Decimal(0),
          netAmount: new Prisma.Decimal(0),
        },
      );

      await tx.consignmentReport.update({
        where: { id: report.id },
        data: totals,
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: "CONSIGNMENT_REPORT_CREATED",
          entityType: "ConsignmentReport",
          entityId: report.id,
          newValue: {
            reportNumber: report.reportNumber,
            shipmentNumber: shipment.shipmentNumber,
            lineCount: lines.length,
            finalize: parsed.data.finalize,
          },
        },
      });

      if (parsed.data.finalize) {
        await finalizeConsignmentReport(tx, report.id, userId);
      }

      return tx.consignmentReport.findUnique({
        where: { id: report.id },
        include: {
          lines: true,
          invoices: {
            select: {
              id: true,
              invoiceNumber: true,
              status: true,
              invoiceDate: true,
              dueDate: true,
              grossAmount: true,
              commissionAmount: true,
              netAmount: true,
            },
          },
        },
      });
    });

    return Response.json({ data: created }, { status: 201 });
  } catch (error) {
    if (error instanceof ConsignmentReportFinalizeError) {
      return Response.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status },
      );
    }

    return handleApiError(error);
  }
}
