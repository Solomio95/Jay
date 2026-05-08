import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export type ConsignmentReportFilters = {
  days?: number;
  from?: string | null;
  to?: string | null;
  partnerId?: string | null;
  locationId?: string | null;
  productId?: string | null;
  productVariantId?: string | null;
};

export type ConsignmentReportShipment = {
  status: string;
  partnerId?: string | null;
  partnerName: string;
  toLocationId: string;
  toLocation: { id?: string; name: string };
  commissionRate: unknown;
  invoices?: Array<{
    grossAmount: unknown;
    commissionAmount: unknown;
    netAmount: unknown;
    payments?: Array<{ amount: unknown }>;
  }>;
  items: Array<{
    quantityShipped: number;
    quantitySold: number;
    quantityReturned: number;
    unitPrice: unknown;
    costAtShipment: unknown;
    productVariant?: {
      id: string;
      sku: string;
      product: { id: string; name: string };
    };
  }>;
};

export async function getConsignmentReport(filters: ConsignmentReportFilters = {}, now = new Date()) {
  const period = resolveConsignmentReportPeriod(filters, now);
  const shipments = await prisma.consignmentShipment.findMany({
    where: buildConsignmentShipmentWhere(filters, period.since, period.until),
    include: {
      toLocation: { select: { id: true, name: true } },
      invoices: {
        where: { status: { in: ["ISSUED", "PAID"] } },
        select: {
          grossAmount: true,
          commissionAmount: true,
          netAmount: true,
          payments: { select: { amount: true } },
        },
      },
      items: {
        select: {
          quantityShipped: true,
          quantitySold: true,
          quantityReturned: true,
          unitPrice: true,
          costAtShipment: true,
          productVariant: { select: { id: true, sku: true, product: { select: { id: true, name: true } } } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return buildConsignmentReportData({ days: period.days, since: period.since, until: period.until, shipments });
}

export function resolveConsignmentReportPeriod(filters: ConsignmentReportFilters, now = new Date()) {
  const days = Number.isFinite(filters.days) && filters.days ? Math.max(1, filters.days) : 90;
  const since = filters.from ? new Date(filters.from) : new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const until = filters.to ? new Date(filters.to) : now;
  return { days, since, until };
}

export function buildConsignmentShipmentWhere(filters: ConsignmentReportFilters, since: Date, until: Date) {
  const itemFilters: Prisma.ConsignmentShipmentItemWhereInput[] = [];
  if (filters.productVariantId) itemFilters.push({ productVariantId: filters.productVariantId });
  if (filters.productId) itemFilters.push({ productVariant: { productId: filters.productId } });

  return {
    createdAt: { gte: since, lte: until },
    ...(filters.partnerId ? { partnerId: filters.partnerId } : {}),
    ...(filters.locationId ? { toLocationId: filters.locationId } : {}),
    ...(itemFilters.length > 0 ? { items: { some: { AND: itemFilters } } } : {}),
  } satisfies Prisma.ConsignmentShipmentWhereInput;
}

export function buildConsignmentReportData({
  days,
  since,
  until,
  shipments,
}: {
  days: number;
  since: Date;
  until?: Date;
  shipments: ConsignmentReportShipment[];
}) {
  const byPartner: Record<
    string,
    {
      partnerName: string;
      locationName: string;
      shipments: number;
      unitsShipped: number;
      unitsSold: number;
      unitsReturned: number;
      revenueGross: number;
      commissionTotal: number;
      netRevenue: number;
      outstandingAmount: number;
      costTotal: number;
    }
  > = {};
  const byProduct: Record<string, { name: string; sku: string; shipped: number; sold: number; returned: number; gross: number; net: number }> = {};

  let totalShipped = 0;
  let totalSold = 0;
  let totalReturned = 0;
  let totalRevenueGross = 0;
  let totalCommission = 0;
  let totalCost = 0;
  let outstandingAmount = 0;

  for (const shipment of shipments) {
    const partnerKey = `${shipment.partnerName}__${shipment.toLocationId}`;
    const partner = byPartner[partnerKey] ?? {
      partnerName: shipment.partnerName,
      locationName: shipment.toLocation.name,
      shipments: 0,
      unitsShipped: 0,
      unitsSold: 0,
      unitsReturned: 0,
      revenueGross: 0,
      commissionTotal: 0,
      netRevenue: 0,
      outstandingAmount: 0,
      costTotal: 0,
    };
    partner.shipments += 1;

    const invoiceMoney = getInvoiceMoneySnapshot(shipment);
    let fallbackRevenueGross = 0;
    let fallbackCommission = 0;
    let fallbackCost = 0;

    for (const item of shipment.items) {
      const shipped = item.quantityShipped;
      const sold = item.quantitySold;
      const returned = item.quantityReturned;
      const revenue = sold * Number(item.unitPrice);
      const commission = (revenue * Number(shipment.commissionRate)) / 100;
      const net = revenue - commission;
      const cost = sold * Number(item.costAtShipment);

      partner.unitsShipped += shipped;
      partner.unitsSold += sold;
      partner.unitsReturned += returned;

      totalShipped += shipped;
      totalSold += sold;
      totalReturned += returned;

      fallbackRevenueGross += revenue;
      fallbackCommission += commission;
      fallbackCost += cost;

      const productKey = item.productVariant?.product.id ?? item.productVariant?.id ?? "unknown";
      const product = byProduct[productKey] ?? {
        name: item.productVariant?.product.name ?? "Unknown product",
        sku: item.productVariant?.sku ?? "",
        shipped: 0,
        sold: 0,
        returned: 0,
        gross: 0,
        net: 0,
      };
      product.shipped += shipped;
      product.sold += sold;
      product.returned += returned;
      product.gross += revenue;
      product.net += net;
      byProduct[productKey] = product;
    }

    const revenueGross = invoiceMoney?.grossAmount ?? fallbackRevenueGross;
    const commissionTotal = invoiceMoney?.commissionAmount ?? fallbackCommission;
    const netRevenue = invoiceMoney?.netAmount ?? revenueGross - commissionTotal;
    const invoiceOutstanding = invoiceMoney?.outstandingAmount ?? 0;

    partner.revenueGross += revenueGross;
    partner.commissionTotal += commissionTotal;
    partner.netRevenue += netRevenue;
    partner.outstandingAmount += invoiceOutstanding;
    partner.costTotal += fallbackCost;

    totalRevenueGross += revenueGross;
    totalCommission += commissionTotal;
    totalCost += fallbackCost;
    outstandingAmount += invoiceOutstanding;
    byPartner[partnerKey] = partner;
  }

  const sellThroughRate = totalShipped > 0 ? (totalSold / totalShipped) * 100 : 0;
  const netRevenue = totalRevenueGross - totalCommission;
  const grossProfit = netRevenue - totalCost;
  const statusCounts: Record<string, number> = {};
  for (const shipment of shipments) {
    statusCounts[shipment.status] = (statusCounts[shipment.status] ?? 0) + 1;
  }

  return {
    period: { days, since: since.toISOString(), until: until?.toISOString() },
    summary: {
      totalShipments: shipments.length,
      totalShipped,
      totalSold,
      totalReturned,
      sellThroughRate,
      totalRevenueGross,
      totalCommission,
      netRevenue,
      outstandingAmount,
      totalCost,
      grossProfit,
    },
    statusBreakdown: Object.entries(statusCounts)
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count),
    byPartner: Object.values(byPartner)
      .map((partner) => ({
        ...partner,
        sellThrough: partner.unitsShipped > 0 ? (partner.unitsSold / partner.unitsShipped) * 100 : 0,
        grossProfit: partner.netRevenue - partner.costTotal,
      }))
      .sort((a, b) => b.revenueGross - a.revenueGross),
    byProduct: Object.entries(byProduct)
      .map(([id, product]) => ({ id, ...product }))
      .sort((a, b) => b.gross - a.gross)
      .slice(0, 20),
  };
}

function getInvoiceMoneySnapshot(
  shipment: ConsignmentReportShipment,
): { grossAmount: number; commissionAmount: number; netAmount: number; outstandingAmount: number } | null {
  if (!shipment.invoices || shipment.invoices.length === 0) {
    return null;
  }

  return shipment.invoices.reduce<{
    grossAmount: number;
    commissionAmount: number;
    netAmount: number;
    outstandingAmount: number;
  }>(
    (sum, invoice) => {
      const paid = (invoice.payments ?? []).reduce((paymentSum, payment) => paymentSum + Number(payment.amount), 0);
      const netAmount = Number(invoice.netAmount);
      return {
        grossAmount: sum.grossAmount + Number(invoice.grossAmount),
        commissionAmount: sum.commissionAmount + Number(invoice.commissionAmount),
        netAmount: sum.netAmount + netAmount,
        outstandingAmount: sum.outstandingAmount + Math.max(0, netAmount - paid),
      };
    },
    { grossAmount: 0, commissionAmount: 0, netAmount: 0, outstandingAmount: 0 },
  );
}
