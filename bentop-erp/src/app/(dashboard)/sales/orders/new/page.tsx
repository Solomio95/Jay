import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { OrderFormClient } from "@/components/sales/order-form-client";

type SearchParams = Promise<{ customerId?: string }>;

export default async function NewOrderPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;

  const [locations, channels, customer] = await Promise.all([
    prisma.location.findMany({
      where: { isActive: true },
      orderBy: [{ type: "asc" }, { name: "asc" }],
      select: { id: true, name: true, type: true },
    }),
    prisma.salesChannel.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, type: true },
    }),
    sp.customerId
      ? prisma.customer.findUnique({
          where: { id: sp.customerId },
          select: {
            id: true,
            name: true,
            email: true,
            companyName: true,
            customerType: true,
          },
        })
      : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
          <Link href="/sales/orders">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Orders
          </Link>
        </Button>
        <h2 className="text-2xl font-bold tracking-tight">New Order</h2>
        <p className="text-muted-foreground">
          Build a sales order. Save as draft for later editing, or confirm to reserve stock.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Order Details</CardTitle>
          <CardDescription>
            Stock is reserved on confirmation. Confirm only once the customer has committed to buy.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {locations.length === 0 ? (
            <div className="text-sm text-destructive">
              No active locations configured. Create one under Settings → Locations first.
            </div>
          ) : (
            <OrderFormClient
              locations={locations}
              channels={channels}
              defaultCustomerId={customer?.id}
              defaultCustomer={customer}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
