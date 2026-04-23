import Link from "next/link";
import { Prisma } from "@prisma/client";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { OrdersFilterBar } from "@/components/sales/orders-filter-bar";

type SearchParams = Promise<{
  search?: string;
  status?: string;
  paymentStatus?: string;
  salesChannelId?: string;
}>;

const STATUS_COLOR: Record<string, "default" | "secondary" | "success" | "warning" | "destructive"> = {
  DRAFT: "secondary",
  CONFIRMED: "default",
  PROCESSING: "warning",
  PACKED: "warning",
  SHIPPED: "default",
  DELIVERED: "success",
  CANCELLED: "destructive",
  RETURNED: "destructive",
};

const PAYMENT_COLOR: Record<string, "default" | "secondary" | "success" | "warning" | "destructive"> = {
  UNPAID: "destructive",
  PARTIAL: "warning",
  PAID: "success",
  REFUNDED: "secondary",
};

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const search = sp.search?.trim() ?? "";
  const status = sp.status ?? "";
  const paymentStatus = sp.paymentStatus ?? "";
  const salesChannelId = sp.salesChannelId ?? "";

  const where: Prisma.OrderWhereInput = {};
  if (status) where.status = status as Prisma.OrderWhereInput["status"];
  if (paymentStatus) where.paymentStatus = paymentStatus as Prisma.OrderWhereInput["paymentStatus"];
  if (salesChannelId) where.salesChannelId = salesChannelId;
  if (search) {
    where.OR = [
      { orderNumber: { contains: search, mode: "insensitive" } },
      { customer: { name: { contains: search, mode: "insensitive" } } },
      { customer: { companyName: { contains: search, mode: "insensitive" } } },
    ];
  }

  const [orders, totalCount, channels, summary] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, companyName: true } },
        salesChannel: { select: { id: true, name: true } },
        location: { select: { id: true, name: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.order.count({ where }),
    prisma.salesChannel.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.order.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
  ]);

  const byStatus = Object.fromEntries(summary.map((s) => [s.status, s._count._all]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Orders</h2>
          <p className="text-muted-foreground">Manage sales orders across all channels.</p>
        </div>
        <Button asChild>
          <Link href="/sales/orders/new">
            <Plus className="mr-2 h-4 w-4" />
            New Order
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {(["DRAFT", "CONFIRMED", "PROCESSING", "PACKED", "SHIPPED", "DELIVERED"] as const).map((s) => (
          <Card key={s}>
            <CardContent className="pt-6">
              <div className="text-muted-foreground text-xs">{s}</div>
              <div className="text-2xl font-bold mt-1">{byStatus[s] ?? 0}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Orders</CardTitle>
          <CardDescription>
            Showing {orders.length} of {totalCount} matching orders.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OrdersFilterBar
            initialSearch={search}
            initialStatus={status}
            initialPayment={paymentStatus}
            initialChannel={salesChannelId}
            channels={channels}
          />

          {orders.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No orders match the filters.
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead className="text-right">Items</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell>
                        <Link href={`/sales/orders/${o.id}`} className="font-mono text-xs hover:underline font-medium">
                          {o.orderNumber}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm">
                        {o.customer ? (
                          <Link href={`/sales/customers/${o.customer.id}`} className="hover:underline">
                            {o.customer.name}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">Walk-in</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {o.salesChannel?.name ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_COLOR[o.status]} className="text-xs">
                          {o.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={PAYMENT_COLOR[o.paymentStatus]} className="text-xs">
                          {o.paymentStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{o._count.items}</TableCell>
                      <TableCell className="text-right font-medium">
                        <div>{formatCurrency(Number(o.totalAmount), o.currency)}</div>
                        {o.currency !== "MYR" && (
                          <div className="text-xs text-muted-foreground font-normal">
                            ≈ {formatCurrency(
                              Number(o.totalAmount) * Number(o.exchangeRateToMyr),
                              "MYR"
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDateTime(o.createdAt)}
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
