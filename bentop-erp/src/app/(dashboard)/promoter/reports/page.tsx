import { Trophy, TrendingDown, TrendingUp, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export default async function PromoterReportsPage() {
  const data = await getPromoterReport();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Promoter Reports</h2>
        <p className="text-muted-foreground">
          Monthly net sales, returns, quantities, and rank by promoter.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <TrendingUp className="h-3.5 w-3.5" /> Gross Sales
            </div>
            <div className="text-2xl font-bold mt-1">
              {formatCurrency(data.summary.grossSales, "MYR")}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <TrendingDown className="h-3.5 w-3.5" /> Returns
            </div>
            <div className="text-2xl font-bold mt-1">
              {formatCurrency(data.summary.returnAmount, "MYR")}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <Trophy className="h-3.5 w-3.5" /> Net Sales
            </div>
            <div className="text-2xl font-bold mt-1">
              {formatCurrency(data.summary.netSales, "MYR")}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <Users className="h-3.5 w-3.5" /> Promoters
            </div>
            <div className="text-2xl font-bold mt-1">{data.summary.promoterCount}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Monthly Leaderboard</CardTitle>
        </CardHeader>
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
                    <TableCell>
                      <Badge variant={row.rank <= 3 ? "default" : "secondary"}>{row.rank}</Badge>
                    </TableCell>
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
