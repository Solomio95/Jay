import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConsignmentPartnerFormClient } from "@/components/consignment/consignment-partner-form-client";
import { buildPartnerStatementSummary } from "@/lib/consignment/partner-statement";
import { formatCurrency, formatDate } from "@/lib/utils";

export default async function ConsignmentPartnersPage() {
  const session = await auth();
  const role = (session?.user as unknown as { role: string } | undefined)?.role ?? "VIEWER";
  const canEdit = role === "ADMIN" || role === "MANAGER";

  const [partners, locations, products] = await Promise.all([
    prisma.consignmentPartner.findMany({
      where: { isActive: true },
      include: {
        commissionTiers: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
        overrides: { where: { isActive: true } },
        invoices: {
          select: {
            status: true,
            invoiceDate: true,
            dueDate: true,
            grossAmount: true,
            commissionAmount: true,
            netAmount: true,
            payments: { select: { amount: true } },
          },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.location.findMany({
      where: { isActive: true, type: "CONSIGNMENT" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.product.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        variants: {
          where: { isActive: true },
          orderBy: [{ color: "asc" }, { size: "asc" }],
          select: { id: true, sku: true, color: true, size: true },
        },
      },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Consignment Partners</h2>
        <p className="text-muted-foreground">
          Manage partner terms, price-tier commission groups, and item overrides.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Partner Statements</CardTitle>
          <CardDescription>Track each partner invoice collection position.</CardDescription>
        </CardHeader>
        <CardContent>
          {partners.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No active consignment partners yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Partner</TableHead>
                    <TableHead className="text-right">Invoices</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead className="text-right">Overdue</TableHead>
                    <TableHead>Last Invoice</TableHead>
                    <TableHead>Statement</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {partners.map((partner) => {
                    const statement = buildPartnerStatementSummary(partner.invoices);

                    return (
                      <TableRow key={partner.id}>
                        <TableCell>
                          <div className="font-medium">{partner.name}</div>
                          <div className="text-xs text-muted-foreground">{partner.contactPerson ?? partner.contactEmail ?? ""}</div>
                        </TableCell>
                        <TableCell className="text-right">{statement.invoiceCount}</TableCell>
                        <TableCell className="text-right">{formatCurrency(statement.netAmount, "MYR")}</TableCell>
                        <TableCell className="text-right text-emerald-700">{formatCurrency(statement.paidAmount, "MYR")}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(statement.outstandingAmount, "MYR")}</TableCell>
                        <TableCell className="text-right">{statement.overdueCount}</TableCell>
                        <TableCell className="text-xs">
                          {statement.lastInvoiceDate ? formatDate(statement.lastInvoiceDate) : "-"}
                        </TableCell>
                        <TableCell>
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/consignment/partners/${partner.id}/statement`}>Open</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Partner Commission Setup</CardTitle>
          <CardDescription>
            Report lines use partner item overrides first, then actual selling price tiers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ConsignmentPartnerFormClient
            canEdit={canEdit}
            locations={locations}
            products={products}
            initialPartners={partners.map((partner) => ({
              id: partner.id,
              name: partner.name,
              contactPerson: partner.contactPerson,
              contactPhone: partner.contactPhone,
              contactEmail: partner.contactEmail,
              locationId: partner.locationId,
              paymentTermsDays: partner.paymentTermsDays,
              isActive: partner.isActive,
              tiers: partner.commissionTiers.map((tier) => ({
                name: tier.name,
                minPrice: Number(tier.minPrice).toString(),
                maxPrice: tier.maxPrice === null ? "" : Number(tier.maxPrice).toString(),
                commissionRate: Number(tier.commissionRate).toString(),
                sortOrder: tier.sortOrder,
              })),
              overrides: partner.overrides.map((override) => ({
                productId: override.productId ?? "",
                productVariantId: override.productVariantId ?? "",
                tierName: override.tierName,
                commissionRate: Number(override.commissionRate).toString(),
                notes: override.notes ?? "",
              })),
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
