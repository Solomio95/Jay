import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";
import { canViewReports, forbiddenResponse } from "@/lib/permissions";

type ConsignmentReportShipment = {
  status: string;
  partnerName: string;
  toLocationId: string;
  toLocation: { id?: string; name: string };
  commissionRate: unknown;
  invoices?: Array<{
    grossAmount: unknown;
    commissionAmount: unknown;
    netAmount: unknown;
  }>;
  items: Array<{
    quantityShipped: number;
    quantitySold: number;
    quantityReturned: number;
    unitPrice: unknown;
    costAtShipment: unknown;
  }>;
};

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
    if (!canViewReports(role)) {
      return forbiddenResponse();
    }
  
    const sp = request.nextUrl.searchParams;
    const days = parseInt(sp.get("days") ?? "90", 10);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  
    const shipments = await prisma.consignmentShipment.findMany({
      where: { createdAt: { gte: since } },
      include: {
        toLocation: { select: { id: true, name: true } },
        invoices: {
          where: { status: { in: ["ISSUED", "PAID"] } },
          select: {
            grossAmount: true,
            commissionAmount: true,
            netAmount: true,
          },
        },
        items: {
          select: {
            quantityShipped: true,
            quantitySold: true,
            quantityReturned: true,
            unitPrice: true,
            costAtShipment: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return Response.json({
      data: buildConsignmentReportData({ days, since, shipments }),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export function buildConsignmentReportData({
  days,
  since,
  shipments,
}: {
  days: number;
  since: Date;
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
        costTotal: number;
      }
    > = {};

  let totalShipped = 0;
  let totalSold = 0;
  let totalReturned = 0;
  let totalRevenueGross = 0;
  let totalCommission = 0;
  let totalCost = 0;

  for (const shipment of shipments) {
    const key = `${shipment.partnerName}__${shipment.toLocationId}`;
    const entry = byPartner[key] ?? {
      partnerName: shipment.partnerName,
      locationName: shipment.toLocation.name,
      shipments: 0,
      unitsShipped: 0,
      unitsSold: 0,
      unitsReturned: 0,
      revenueGross: 0,
      commissionTotal: 0,
      costTotal: 0,
    };
    entry.shipments += 1;

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
      const cost = sold * Number(item.costAtShipment);

      entry.unitsShipped += shipped;
      entry.unitsSold += sold;
      entry.unitsReturned += returned;

      totalShipped += shipped;
      totalSold += sold;
      totalReturned += returned;

      fallbackRevenueGross += revenue;
      fallbackCommission += commission;
      fallbackCost += cost;
    }

    const revenueGross = invoiceMoney?.grossAmount ?? fallbackRevenueGross;
    const commissionTotal = invoiceMoney?.commissionAmount ?? fallbackCommission;

    entry.revenueGross += revenueGross;
    entry.commissionTotal += commissionTotal;
    entry.costTotal += fallbackCost;

    totalRevenueGross += revenueGross;
    totalCommission += commissionTotal;
    totalCost += fallbackCost;
    byPartner[key] = entry;
  }

  const sellThroughRate = totalShipped > 0 ? (totalSold / totalShipped) * 100 : 0;
  const netRevenue = totalRevenueGross - totalCommission;
  const grossProfit = netRevenue - totalCost;
  const statusCounts: Record<string, number> = {};
  for (const shipment of shipments) {
    statusCounts[shipment.status] = (statusCounts[shipment.status] ?? 0) + 1;
  }

  return {
    period: { days, since: since.toISOString() },
    summary: {
      totalShipments: shipments.length,
      totalShipped,
      totalSold,
      totalReturned,
      sellThroughRate,
      totalRevenueGross,
      totalCommission,
      netRevenue,
      totalCost,
      grossProfit,
    },
    statusBreakdown: Object.entries(statusCounts)
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count),
    byPartner: Object.values(byPartner)
      .map((partner) => ({
        ...partner,
        sellThrough:
          partner.unitsShipped > 0
            ? (partner.unitsSold / partner.unitsShipped) * 100
            : 0,
        netRevenue: partner.revenueGross - partner.commissionTotal,
        grossProfit:
          partner.revenueGross - partner.commissionTotal - partner.costTotal,
      }))
      .sort((a, b) => b.revenueGross - a.revenueGross),
  };
}

function getInvoiceMoneySnapshot(
  shipment: ConsignmentReportShipment,
): { grossAmount: number; commissionAmount: number; netAmount: number } | null {
  if (!shipment.invoices || shipment.invoices.length === 0) {
    return null;
  }

  return shipment.invoices.reduce<{
    grossAmount: number;
    commissionAmount: number;
    netAmount: number;
  }>(
    (sum, invoice) => ({
      grossAmount: sum.grossAmount + Number(invoice.grossAmount),
      commissionAmount: sum.commissionAmount + Number(invoice.commissionAmount),
      netAmount: sum.netAmount + Number(invoice.netAmount),
    }),
    { grossAmount: 0, commissionAmount: 0, netAmount: 0 },
  );
}
