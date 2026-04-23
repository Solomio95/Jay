import { prisma } from "@/lib/db";
import {
  TrendingUp,
  DollarSign,
  Boxes,
  Truck,
  Users,
  BarChart3,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";

export default async function ConsignmentReportsPage() {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const shipments = await prisma.consignmentShipment.findMany({
    where: { createdAt: { gte: ninetyDaysAgo } },
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
      const rev = i.quantitySold * Number(i.unitPrice);
      const com = (rev * Number(s.commissionRate)) / 100;
      const cost = i.quantitySold * Number(i.costAtShipment);

      entry.unitsShipped += i.quantityShipped;
      entry.unitsSold += i.quantitySold;
      entry.unitsReturned += i.quantityReturned;
      entry.revenueGross += rev;
      entry.commissionTotal += com;
      entry.costTotal += cost;

      totalShipped += i.quantityShipped;
      totalSold += i.quantitySold;
      totalReturned += i.quantityReturned;
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

  const partnerRows = Object.values(byPartner)
    .map((p) => ({
      ...p,
      sellThrough: p.unitsShipped > 0 ? (p.unitsSold / p.unitsShipped) * 100 : 0,
      netRevenue: p.revenueGross - p.commissionTotal,
      grossProfit: p.revenueGross - p.commissionTotal - p.costTotal,
    }))
    .sort((a, b) => b.revenueGross - a.revenueGross);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Consignment Reports</h2>
        <p className="text-muted-foreground">
          Partner performance, sell-through rates, and settlement summary (last 90 days).
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <Truck className="h-3.5 w-3.5" /> Shipments
            </div>
            <div className="text-2xl font-bold mt-1">{shipments.length}</div>
            <div className="text-xs text-muted-foreground">total consignments</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <Boxes className="h-3.5 w-3.5" /> Units Shipped
            </div>
            <div className="text-2xl font-bold mt-1">{totalShipped.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">
              {totalSold.toLocaleString()} sold
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <BarChart3 className="h-3.5 w-3.5" /> Sell-Through
            </div>
            <div className="text-2xl font-bold mt-1">{sellThroughRate.toFixed(1)}%</div>
            <div className="text-xs text-muted-foreground">{totalReturned} returned</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <DollarSign className="h-3.5 w-3.5" /> Gross Revenue
            </div>
            <div className="text-2xl font-bold mt-1">
              {formatCurrency(totalRevenueGross, "MYR")}
            </div>
            <div className="text-xs text-muted-foreground">before commission</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <TrendingUp className="h-3.5 w-3.5" /> Net Revenue
            </div>
            <div className="text-2xl font-bold mt-1">
              {formatCurrency(netRevenue, "MYR")}
            </div>
            <div className="text-xs text-muted-foreground">
              {formatCurrency(totalCommission, "MYR")} commission
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <Users className="h-3.5 w-3.5" /> Partners
            </div>
            <div className="text-2xl font-bold mt-1">{partnerRows.length}</div>
            <div className="text-xs text-muted-foreground">active consignees</div>
          </CardContent>
        </Card>
      </div>

      {/* Status breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Shipment Status</CardTitle>
        </CardHeader>
        <CardContent>
          {Object.keys(statusCounts).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No data.</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {Object.entries(statusCounts)
                .sort(([, a], [, b]) => b - a)
                .map(([status, count]) => (
                  <div key={status} className="border rounded-lg p-3 min-w-[120px]">
                    <div className="text-xs text-muted-foreground uppercase">
                      {status.replace(/_/g, " ")}
                    </div>
                    <div className="text-xl font-bold mt-1">{count}</div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Partner performance table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Partner Performance</CardTitle>
          <CardDescription>
            Revenue, sell-through, and profitability by consignment partner
          </CardDescription>
        </CardHeader>
        <CardContent>
          {partnerRows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No data.</p>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Partner</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-right">Shipments</TableHead>
                    <TableHead className="text-right">Shipped</TableHead>
                    <TableHead className="text-right">Sold</TableHead>
                    <TableHead className="text-right">Returned</TableHead>
                    <TableHead className="text-right">Sell-Through</TableHead>
                    <TableHead className="text-right">Gross Rev.</TableHead>
                    <TableHead className="text-right">Commission</TableHead>
                    <TableHead className="text-right">Net to Bentop</TableHead>
                    <TableHead className="text-right">Profit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {partnerRows.map((p) => (
                    <TableRow key={`${p.partnerName}__${p.locationName}`}>
                      <TableCell className="font-medium">{p.partnerName}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {p.locationName}
                      </TableCell>
                      <TableCell className="text-right">{p.shipments}</TableCell>
                      <TableCell className="text-right">{p.unitsShipped}</TableCell>
                      <TableCell className="text-right">{p.unitsSold}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {p.unitsReturned}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant={
                            p.sellThrough >= 70
                              ? "success"
                              : p.sellThrough >= 40
                                ? "warning"
                                : "destructive"
                          }
                          className="text-xs"
                        >
                          {p.sellThrough.toFixed(1)}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(p.revenueGross, "MYR")}
                      </TableCell>
                      <TableCell className="text-right text-amber-700">
                        {formatCurrency(p.commissionTotal, "MYR")}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(p.netRevenue, "MYR")}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(p.grossProfit, "MYR")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
