import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return Response.json(
      { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  const sp = request.nextUrl.searchParams;
  const days = parseInt(sp.get("days") ?? "90", 10);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const shipments = await prisma.consignmentShipment.findMany({
    where: { createdAt: { gte: since } },
    include: {
      toLocation: { select: { id: true, name: true } },
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

  // Per-partner aggregation
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

  for (const s of shipments) {
    const key = `${s.partnerName}__${s.toLocationId}`;
    const entry = byPartner[key] ?? {
      partnerName: s.partnerName,
      locationName: s.toLocation.name,
      shipments: 0,
      unitsShipped: 0,
      unitsSold: 0,
      unitsReturned: 0,
      revenueGross: 0,
      commissionTotal: 0,
      costTotal: 0,
    };
    entry.shipments += 1;

    for (const i of s.items) {
      const shipped = i.quantityShipped;
      const sold = i.quantitySold;
      const returned = i.quantityReturned;
      const rev = sold * Number(i.unitPrice);
      const com = (rev * Number(s.commissionRate)) / 100;
      const cost = sold * Number(i.costAtShipment);

      entry.unitsShipped += shipped;
      entry.unitsSold += sold;
      entry.unitsReturned += returned;
      entry.revenueGross += rev;
      entry.commissionTotal += com;
      entry.costTotal += cost;

      totalShipped += shipped;
      totalSold += sold;
      totalReturned += returned;
      totalRevenueGross += rev;
      totalCommission += com;
      totalCost += cost;
    }

    byPartner[key] = entry;
  }

  const sellThroughRate = totalShipped > 0 ? (totalSold / totalShipped) * 100 : 0;
  const netRevenue = totalRevenueGross - totalCommission;
  const grossProfit = netRevenue - totalCost;

  // Status breakdown
  const statusCounts: Record<string, number> = {};
  for (const s of shipments) {
    statusCounts[s.status] = (statusCounts[s.status] ?? 0) + 1;
  }

  return Response.json({
    data: {
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
        .map((p) => ({
          ...p,
          sellThrough:
            p.unitsShipped > 0 ? (p.unitsSold / p.unitsShipped) * 100 : 0,
          netRevenue: p.revenueGross - p.commissionTotal,
          grossProfit: p.revenueGross - p.commissionTotal - p.costTotal,
        }))
        .sort((a, b) => b.revenueGross - a.revenueGross),
    },
  });
}
