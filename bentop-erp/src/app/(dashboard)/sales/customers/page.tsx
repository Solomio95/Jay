import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CustomerManagerClient } from "@/components/sales/customer-manager-client";

type SearchParams = Promise<{
  search?: string;
  type?: string;
}>;

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();
  const role = (session?.user as unknown as { role: string } | undefined)?.role ?? "VIEWER";
  const canEdit = role !== "VIEWER";

  const sp = await searchParams;
  const search = sp.search?.trim() ?? "";
  const type = sp.type ?? "";

  const where: Prisma.CustomerWhereInput = { isActive: true };
  if (type === "RETAIL" || type === "WHOLESALE" || type === "CONSIGNMENT") {
    where.customerType = type;
  }
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { phone: { contains: search, mode: "insensitive" } },
      { companyName: { contains: search, mode: "insensitive" } },
    ];
  }

  const customers = await prisma.customer.findMany({
    where,
    include: { _count: { select: { orders: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const totals = {
    total: await prisma.customer.count({ where: { isActive: true } }),
    retail: await prisma.customer.count({ where: { isActive: true, customerType: "RETAIL" } }),
    wholesale: await prisma.customer.count({ where: { isActive: true, customerType: "WHOLESALE" } }),
    consignment: await prisma.customer.count({ where: { isActive: true, customerType: "CONSIGNMENT" } }),
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Customers</h2>
        <p className="text-muted-foreground">
          Manage retail, wholesale, and consignment customers.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-xs">Total</div>
            <div className="text-2xl font-bold mt-1">{totals.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-xs">Retail</div>
            <div className="text-2xl font-bold mt-1">{totals.retail}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-xs">Wholesale</div>
            <div className="text-2xl font-bold mt-1">{totals.wholesale}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-xs">Consignment</div>
            <div className="text-2xl font-bold mt-1">{totals.consignment}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Customer Database</CardTitle>
          <CardDescription>
            Showing up to 100 matching customers. Use search and filter to narrow results.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CustomerManagerClient
            initialSearch={search}
            initialType={type === "RETAIL" || type === "WHOLESALE" || type === "CONSIGNMENT" ? type : ""}
            canEdit={canEdit}
            initialCustomers={customers.map((c) => ({
              id: c.id,
              name: c.name,
              email: c.email,
              phone: c.phone,
              companyName: c.companyName,
              customerType: c.customerType,
              creditLimitMyr: c.creditLimitMyr != null ? Number(c.creditLimitMyr) : null,
              paymentTermsDays: c.paymentTermsDays,
              isActive: c.isActive,
              orderCount: c._count.orders,
              createdAt: c.createdAt.toISOString(),
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
