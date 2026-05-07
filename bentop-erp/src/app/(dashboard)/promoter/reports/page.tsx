import type { ReactNode } from "react";
import { Download, Trophy, TrendingDown, TrendingUp, Users } from "lucide-react";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { getPromoterReport } from "@/lib/reports/promoter";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PromoterReportsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = {
    month: getParam(params, "month") ?? new Date().toISOString().slice(0, 7),
    locationId: getParam(params, "locationId"),
    promoterId: getParam(params, "promoterId"),
  };

  const [data, locations, promoters] = await Promise.all([
    getPromoterReport(filters),
    prisma.location.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { role: "PROMOTER", isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const exportHref = `/api/v1/exports/reports/promoter${toQueryString(filters)}`;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Promoter Reports</h2>
          <p className="text-muted-foreground">Monthly net sales, returns, quantities, and rank by promoter.</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <a href={exportHref}><Download className="mr-2 h-4 w-4" />Report CSV</a>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
          <CardDescription>Filter promoter KPI by month, location, or promoter.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-4">
            <Input type="month" name="month" defaultValue={filters.month} />
            <select name="locationId" defaultValue={filters.locationId ?? ""} className="h-10 rounded-md border bg-background px-3 text-sm">
              <option value="">All locations</option>
              {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
            </select>
            <select name="promoterId" defaultValue={filters.promoterId ?? ""} className="h-10 rounded-md border bg-background px-3 text-sm">
              <option value="">All promoters</option>
              {promoters.map((promoter) => <option key={promoter.id} value={promoter.id}>{promoter.name}</option>)}
            </select>
            <Button type="submit">Apply</Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Metric icon={<TrendingUp className="h-3.5 w-3.5" />} label="Gross Sales" value={formatCurrency(data.summary.grossSales, "MYR")} />
        <Metric icon={<TrendingDown className="h-3.5 w-3.5" />} label="Returns" value={formatCurrency(data.summary.returnAmount, "MYR")} />
        <Metric icon={<Trophy className="h-3.5 w-3.5" />} label="Net Sales" value={formatCurrency(data.summary.netSales, "MYR")} />
        <Metric icon={<Users className="h-3.5 w-3.5" />} label="Promoters" value={data.summary.promoterCount.toLocaleString()} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Monthly Leaderboard</CardTitle></CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rank</TableHead>
                  <TableHead>Promoter</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">Returns</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                  <TableHead className="text-right">Net Qty</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((row) => (
                  <TableRow key={row.promoterId}>
                    <TableCell><Badge variant={row.rank <= 3 ? "default" : "secondary"}>{row.rank}</Badge></TableCell>
                    <TableCell className="font-medium">{row.promoterName}</TableCell>
                    <TableCell className="text-muted-foreground">{row.locationName}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.grossSales, "MYR")}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.returnAmount, "MYR")}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(row.netSales, "MYR")}</TableCell>
                    <TableCell className="text-right">{row.netQuantity}</TableCell>
                    <TableCell className="text-right">{row.orderCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 text-muted-foreground text-xs">{icon} {label}</div>
        <div className="text-2xl font-bold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}

function getParam(params: Awaited<PageProps["searchParams"]>, key: string) {
  const value = params?.[key];
  return Array.isArray(value) ? value[0] : value;
}

function toQueryString(values: Record<string, string | null | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}
