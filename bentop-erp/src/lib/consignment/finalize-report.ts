import { Prisma, type ConsignmentStatus } from "@prisma/client";

import { generateConsignmentInvoiceNumber } from "@/lib/utils";

type FinalizableReport = {
  id: string;
  reportNumber: string;
  partnerId: string;
  shipmentId: string;
  grossAmount: Prisma.Decimal | string | number;
  commissionAmount: Prisma.Decimal | string | number;
  netAmount: Prisma.Decimal | string | number;
  partner: {
    name: string;
    contactPerson: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    paymentTermsDays: number | null;
  };
  shipment: {
    shipmentNumber: string;
    fromLocationId: string;
    toLocationId: string;
    status: ConsignmentStatus;
    settledAt: Date | null;
    toLocation: {
      address: string | null;
    };
  };
  lines: Array<{
    id: string;
    shipmentItemId: string;
    quantitySold: number;
    quantityReturned: number;
    actualUnitPrice: Prisma.Decimal | string | number;
    commissionTierName: string;
    commissionRate: Prisma.Decimal | string | number;
    grossAmount: Prisma.Decimal | string | number;
    commissionAmount: Prisma.Decimal | string | number;
    netAmount: Prisma.Decimal | string | number;
    shipmentItem: {
      productVariantId: string;
      batchId: string | null;
      productVariant: {
        sku: string;
        color: string;
        size: string;
        product: {
          name: string;
        };
      };
    };
  }>;
};

type ShipmentAccountingRow = {
  quantityShipped: number;
  quantitySold: number;
  quantityReturned: number;
};

export class ConsignmentReportFinalizeError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ConsignmentReportFinalizeError";
  }
}

export function canFinalizeConsignmentReport(role: string | undefined) {
  return role === "ADMIN" || role === "MANAGER";
}

export function isActiveReportShipmentStatus(status: ConsignmentStatus | string) {
  return status === "SHIPPED" || status === "PARTIAL_SETTLED";
}

export function getFinalizedShipmentStatus(items: ShipmentAccountingRow[]) {
  return items.every(
    (item) => item.quantitySold + item.quantityReturned >= item.quantityShipped,
  )
    ? "SETTLED"
    : "PARTIAL_SETTLED";
}

export function getInvoiceDueDate(invoiceDate: Date, paymentTermsDays?: number | null) {
  if (paymentTermsDays === null || paymentTermsDays === undefined) {
    return null;
  }

  const dueDate = new Date(invoiceDate);
  dueDate.setDate(dueDate.getDate() + paymentTermsDays);
  return dueDate;
}

export function getInsufficientConsigneeStockError({
  requested,
  remaining,
  sku,
}: {
  requested: number;
  remaining: number;
  sku: string;
}) {
  return new ConsignmentReportFinalizeError(
    "INSUFFICIENT_STOCK",
    `Only ${requested - remaining} units are available at the consignee location for ${sku}; requested ${requested}`,
    409,
  );
}

export function buildConsignmentInvoiceCreateData({
  invoiceNumber,
  invoiceDate,
  report,
}: {
  invoiceNumber: string;
  invoiceDate: Date;
  report: FinalizableReport;
}) {
  const paymentTermsDays = report.partner.paymentTermsDays ?? null;
  const address: Prisma.InputJsonValue | typeof Prisma.JsonNull = report.shipment
    .toLocation.address
    ? { address: report.shipment.toLocation.address }
    : Prisma.JsonNull;

  return {
    invoiceNumber,
    partnerId: report.partnerId,
    shipmentId: report.shipmentId,
    reportId: report.id,
    status: "ISSUED",
    invoiceDate,
    dueDate: getInvoiceDueDate(invoiceDate, paymentTermsDays),
    billToName: report.partner.name,
    billToContact: report.partner.contactPerson,
    billToEmail: report.partner.contactEmail,
    billToPhone: report.partner.contactPhone,
    billToAddress: address,
    paymentTermsDays,
    grossAmount: toDecimal(report.grossAmount),
    commissionAmount: toDecimal(report.commissionAmount),
    netAmount: toDecimal(report.netAmount),
    issuedAt: invoiceDate,
    lines: {
      create: report.lines.map((line) => {
        const variant = line.shipmentItem.productVariant;
        const description = `${variant.product.name} - ${variant.color} / ${variant.size}`;

        return {
          reportId: report.id,
          reportLineId: line.id,
          description,
          sku: variant.sku,
          productName: variant.product.name,
          color: variant.color,
          size: variant.size,
          quantitySold: line.quantitySold,
          actualUnitPrice: toDecimal(line.actualUnitPrice),
          commissionTierName: line.commissionTierName,
          commissionRate: toDecimal(line.commissionRate),
          grossAmount: toDecimal(line.grossAmount),
          commissionAmount: toDecimal(line.commissionAmount),
          netAmount: toDecimal(line.netAmount),
        };
      }),
    },
  } satisfies Prisma.ConsignmentInvoiceUncheckedCreateInput;
}

export async function finalizeConsignmentReport(
  tx: Prisma.TransactionClient,
  reportId: string,
  userId: string,
) {
  const guardedUpdate = await tx.consignmentReport.updateMany({
    where: { id: reportId, status: "DRAFT" },
    data: {
      status: "FINALIZED",
      finalizedById: userId,
      finalizedAt: new Date(),
    },
  });

  if (guardedUpdate.count === 0) {
    const existing = await tx.consignmentReport.findUnique({
      where: { id: reportId },
      select: { status: true },
    });

    if (!existing) {
      throw new ConsignmentReportFinalizeError(
        "NOT_FOUND",
        "Report not found",
        404,
      );
    }

    throw new ConsignmentReportFinalizeError(
      "INVALID_STATE",
      `Cannot finalize report in ${existing.status} state`,
      409,
    );
  }

  const report = await tx.consignmentReport.findUnique({
    where: { id: reportId },
    include: buildFinalizableReportInclude(),
  });

  if (!report) {
    throw new ConsignmentReportFinalizeError("NOT_FOUND", "Report not found", 404);
  }

  if (!isActiveReportShipmentStatus(report.shipment.status)) {
    throw new ConsignmentReportFinalizeError(
      "INVALID_STATE",
      `Cannot finalize report for shipment in ${report.shipment.status} state`,
      409,
    );
  }

  for (const line of report.lines) {
    await applyReportLineStock(tx, report, line, userId);
  }

  const freshItems = await tx.consignmentShipmentItem.findMany({
    where: { shipmentId: report.shipmentId },
  });
  const nextShipmentStatus = getFinalizedShipmentStatus(freshItems);

  await tx.consignmentShipment.update({
    where: { id: report.shipmentId },
    data: {
      status: nextShipmentStatus,
      settledAt:
        nextShipmentStatus === "SETTLED" ? new Date() : report.shipment.settledAt,
    },
  });

  const invoiceCreateData = buildConsignmentInvoiceCreateData({
    invoiceNumber: generateConsignmentInvoiceNumber(),
    invoiceDate: new Date(),
    report,
  });
  const invoiceLines = invoiceCreateData.lines.create;

  const invoiceHeader = await tx.consignmentInvoice.create({
    data: {
      invoiceNumber: invoiceCreateData.invoiceNumber,
      status: invoiceCreateData.status,
      invoiceDate: invoiceCreateData.invoiceDate,
      dueDate: invoiceCreateData.dueDate,
      billToName: invoiceCreateData.billToName,
      billToContact: invoiceCreateData.billToContact,
      billToEmail: invoiceCreateData.billToEmail,
      billToPhone: invoiceCreateData.billToPhone,
      billToAddress: invoiceCreateData.billToAddress,
      paymentTermsDays: invoiceCreateData.paymentTermsDays,
      grossAmount: invoiceCreateData.grossAmount,
      commissionAmount: invoiceCreateData.commissionAmount,
      netAmount: invoiceCreateData.netAmount,
      issuedAt: invoiceCreateData.issuedAt,
      partner: { connect: { id: report.partnerId } },
      shipment: { connect: { id: report.shipmentId } },
      report: {
        connect: {
          id_partnerId_shipmentId: {
            id: report.id,
            partnerId: report.partnerId,
            shipmentId: report.shipmentId,
          },
        },
      },
    },
  });

  await tx.consignmentInvoiceLine.createMany({
    data: invoiceLines.map((line) => ({
      ...line,
      invoiceId: invoiceHeader.id,
      reportId: report.id,
    })),
  });

  const invoice = await tx.consignmentInvoice.findUniqueOrThrow({
    where: { id: invoiceHeader.id },
    include: { lines: true },
  });

  await tx.auditLog.create({
    data: {
      userId,
      action: "CONSIGNMENT_REPORT_FINALIZED",
      entityType: "ConsignmentReport",
      entityId: report.id,
      newValue: {
        reportNumber: report.reportNumber,
        invoiceNumber: invoice.invoiceNumber,
        shipmentNumber: report.shipment.shipmentNumber,
        newShipmentStatus: nextShipmentStatus,
      },
    },
  });

  return { reportId: report.id, invoice, shipmentStatus: nextShipmentStatus };
}

function buildFinalizableReportInclude() {
  return {
    partner: true,
    shipment: {
      include: {
        toLocation: { select: { address: true } },
      },
    },
    lines: {
      include: {
        shipmentItem: {
          include: {
            productVariant: {
              include: {
                product: { select: { name: true } },
              },
            },
          },
        },
      },
    },
  } satisfies Prisma.ConsignmentReportInclude;
}

async function applyReportLineStock(
  tx: Prisma.TransactionClient,
  report: FinalizableReport,
  line: FinalizableReport["lines"][number],
  userId: string,
) {
  if (line.quantitySold > 0) {
    await tx.consignmentShipmentItem.update({
      where: { id: line.shipmentItemId },
      data: { quantitySold: { increment: line.quantitySold } },
    });

    await moveSoldStock(tx, report, line, userId);
  }

  if (line.quantityReturned > 0) {
    await tx.consignmentShipmentItem.update({
      where: { id: line.shipmentItemId },
      data: { quantityReturned: { increment: line.quantityReturned } },
    });

    await moveReturnedStock(tx, report, line, userId);
  }
}

async function moveSoldStock(
  tx: Prisma.TransactionClient,
  report: FinalizableReport,
  line: FinalizableReport["lines"][number],
  userId: string,
) {
  const stockMode = await decrementConsigneeStock(tx, report, line, line.quantitySold, async (batchId, take) => {
    await tx.stockMovement.create({
      data: {
        productVariantId: line.shipmentItem.productVariantId,
        batchId,
        fromLocationId: report.shipment.toLocationId,
        toLocationId: null,
        movementType: "OUTBOUND",
        quantity: take,
        referenceNumber: report.shipment.shipmentNumber,
        reason: "Consignment sale",
        performedById: userId,
      },
    });
  });

  if (stockMode === "batch") {
    await decrementAggregateStock(
      tx,
      line.shipmentItem.productVariantId,
      report.shipment.toLocationId,
      line.quantitySold,
    );
  }
}

async function moveReturnedStock(
  tx: Prisma.TransactionClient,
  report: FinalizableReport,
  line: FinalizableReport["lines"][number],
  userId: string,
) {
  const stockMode = await decrementConsigneeStock(tx, report, line, line.quantityReturned, async (batchId, take) => {
    if (batchId) {
      await incrementBatchStock(
        tx,
        line.shipmentItem.productVariantId,
        report.shipment.fromLocationId,
        batchId,
        take,
      );
    }

    await tx.stockMovement.create({
      data: {
        productVariantId: line.shipmentItem.productVariantId,
        batchId,
        fromLocationId: report.shipment.toLocationId,
        toLocationId: report.shipment.fromLocationId,
        movementType: "CONSIGNMENT_RETURN",
        quantity: take,
        referenceNumber: report.shipment.shipmentNumber,
        reason: "Consignment return",
        performedById: userId,
      },
    });
  });

  if (stockMode === "batch") {
    await decrementAggregateStock(
      tx,
      line.shipmentItem.productVariantId,
      report.shipment.toLocationId,
      line.quantityReturned,
    );
  }
  await incrementAggregateStock(
    tx,
    line.shipmentItem.productVariantId,
    report.shipment.fromLocationId,
    line.quantityReturned,
  );
}

async function decrementConsigneeStock(
  tx: Prisma.TransactionClient,
  report: FinalizableReport,
  line: FinalizableReport["lines"][number],
  quantity: number,
  onMoved: (batchId: string | null, take: number) => Promise<void>,
) {
  let remaining = quantity;
  const sourceRows = await tx.stockLevel.findMany({
    where: line.shipmentItem.batchId
      ? {
          productVariantId: line.shipmentItem.productVariantId,
          locationId: report.shipment.toLocationId,
          batchId: line.shipmentItem.batchId,
          quantityOnHand: { gt: 0 },
        }
      : {
          productVariantId: line.shipmentItem.productVariantId,
          locationId: report.shipment.toLocationId,
          batchId: { not: null },
          quantityOnHand: { gt: 0 },
        },
    include: { batch: true },
    orderBy: { batch: { productionDate: "asc" } },
  });

  if (sourceRows.length === 0 && !line.shipmentItem.batchId) {
    const aggregateRow = await tx.stockLevel.findFirst({
      where: {
        productVariantId: line.shipmentItem.productVariantId,
        locationId: report.shipment.toLocationId,
        batchId: null,
      },
    });

    const available = aggregateRow?.quantityOnHand ?? 0;
    if (available < quantity) {
      throw getInsufficientConsigneeStockError({
        requested: quantity,
        remaining: quantity - available,
        sku: line.shipmentItem.productVariant.sku,
      });
    }

    await tx.stockLevel.update({
      where: { id: aggregateRow!.id },
      data: { quantityOnHand: { decrement: quantity } },
    });
    await onMoved(null, quantity);
    return "aggregate";
  }

  for (const row of sourceRows) {
    if (remaining <= 0) break;

    const take = Math.min(remaining, row.quantityOnHand);
    const batchId = row.batchId as string;

    await tx.stockLevel.update({
      where: { id: row.id },
      data: { quantityOnHand: { decrement: take } },
    });

    await onMoved(batchId, take);
    remaining -= take;
  }

  if (remaining > 0) {
    throw getInsufficientConsigneeStockError({
      requested: quantity,
      remaining,
      sku: line.shipmentItem.productVariant.sku,
    });
  }

  return "batch";
}

async function decrementAggregateStock(
  tx: Prisma.TransactionClient,
  productVariantId: string,
  locationId: string,
  quantity: number,
) {
  const row = await tx.stockLevel.findFirst({
    where: { productVariantId, locationId, batchId: null },
  });

  if (row) {
    await tx.stockLevel.update({
      where: { id: row.id },
      data: { quantityOnHand: { decrement: quantity } },
    });
  }
}

async function incrementAggregateStock(
  tx: Prisma.TransactionClient,
  productVariantId: string,
  locationId: string,
  quantity: number,
) {
  const row = await tx.stockLevel.findFirst({
    where: { productVariantId, locationId, batchId: null },
  });

  if (row) {
    await tx.stockLevel.update({
      where: { id: row.id },
      data: { quantityOnHand: { increment: quantity } },
    });
  } else {
    await tx.stockLevel.create({
      data: { productVariantId, locationId, batchId: null, quantityOnHand: quantity },
    });
  }
}

async function incrementBatchStock(
  tx: Prisma.TransactionClient,
  productVariantId: string,
  locationId: string,
  batchId: string,
  quantity: number,
) {
  const row = await tx.stockLevel.findFirst({
    where: { productVariantId, locationId, batchId },
  });

  if (row) {
    await tx.stockLevel.update({
      where: { id: row.id },
      data: { quantityOnHand: { increment: quantity } },
    });
  } else {
    await tx.stockLevel.create({
      data: { productVariantId, locationId, batchId, quantityOnHand: quantity },
    });
  }
}

function toDecimal(value: Prisma.Decimal | string | number) {
  return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
}
