import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, Phone, Building2, FileText } from "lucide-react";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDateTime } from "@/lib/utils";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      orders: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          totalAmount: true,
          currency: true,
          paymentStatus: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      },
      _count: { select: { orders: true } },
    },
  });

  if (!customer) notFound();

  const totalSpent = customer.orders
    .filter((o) => o.status !== "CANCELLED" && o.status !== "DRAFT")
    .reduce((s, o) => s + Number(o.totalAmount) * (o.currency === "MYR" ? 1 : 1), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
            <Link href="/sales/customers">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Customers
            </Link>
          </Button>
          <h2 className="text-2xl font-bold tracking-tight">{customer.name}</h2>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant={customer.customerType === "WHOLESALE" ? "default" : "secondary"}>
              {customer.customerType}
            </Badge>
            {!customer.isActive && <Badge variant="secondary">Inactive</Badge>}
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/sales/orders/new?customerId=${customer.id}`}>
              <FileText className="h-4 w-4 mr-2" />
              New Order
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contact</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            {customer.companyName && (
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                {customer.companyName}
              </div>
            )}
            {customer.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <a href={`mailto:${customer.email}`} className="hover:underline">{customer.email}</a>
              </div>
            )}
            {customer.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                {customer.phone}
              </div>
            )}
            {customer.taxId && (
              <div className="text-xs text-muted-foreground">Tax ID: {customer.taxId}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Credit</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Credit limit</span>
              <span className="font-medium">
                {customer.creditLimitMyr != null
                  ? formatCurrency(Number(customer.creditLimitMyr), "MYR")
                  : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Payment terms</span>
              <span className="font-medium">
                {customer.paymentTermsDays != null ? `${customer.paymentTermsDays} days` : "—"}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Activity</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total orders</span>
              <span className="font-medium">{customer._count.orders}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total spent (MYR-eq)</span>
              <span className="font-medium">{formatCurrency(totalSpent, "MYR")}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Since</span>
              <span className="font-medium">{formatDateTime(customer.createdAt)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {customer.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{customer.notes}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Order History</CardTitle>
          <CardDescription>Latest 50 orders</CardDescription>
        </CardHeader>
        <CardContent>
          {customer.orders.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-6">
              No orders yet.
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order #</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customer.orders.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell>
                        <Link href={`/sales/orders/${o.id}`} className="font-mono text-xs hover:underline">
                          {o.orderNumber}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">{o.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">{o.paymentStatus}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(Number(o.totalAmount), o.currency)}
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
