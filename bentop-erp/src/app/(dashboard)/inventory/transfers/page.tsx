import { prisma } from "@/lib/db";
import Link from "next/link";
import { ArrowLeftRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/utils";
import type { TransferStatus } from "@prisma/client";

type SearchParams = Promise<{ status?: string }>;

const STATUS_META: Record<
  TransferStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "success" | "warning" | "outline" }
> = {
  REQUESTED: { label: "Requested", variant: "warning" },
  APPROVED: { label: "Approved", variant: "default" },
  IN_TRANSIT: { label: "In Transit", variant: "default" },
  COMPLETED: { label: "Completed", variant: "success" },
  CANCELLED: { label: "Cancelled", variant: "secondary" },
};

export default async function TransfersPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const statusFilter = sp.status as TransferStatus | undefined;

  const transfers = await prisma.stockTransfer.findMany({
    where: statusFilter ? { status: statusFilter } : {},
    include: {
      fromLocation: { select: { name: true } },
      toLocation: { select: { name: true } },
      requestedBy: { select: { name: true } },
      _count: { select: { items: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const counts = await prisma.stockTransfer.groupBy({
    by: ["status"],
    _count: true,
  });
  const countByStatus = Object.fromEntries(counts.map((c) => [c.status, c._count])) as Record<
    TransferStatus,
    number
  >;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Stock Transfers</h2>
          <p className="text-muted-foreground">
            Move stock between locations with a request → approve → complete workflow.
          </p>
        </div>
        <Button asChild>
          <Link href="/inventory/transfers/new">
            <Plus className="mr-2 h-4 w-4" /> New Transfer
          </Link>
        </Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Link href="/inventory/transfers">
          <Badge variant={!statusFilter ? "default" : "outline"} className="cursor-pointer">
            All
          </Badge>
        </Link>
        {(["REQUESTED", "APPROVED", "COMPLETED", "CANCELLED"] as TransferStatus[]).map((s) => (
          <Link key={s} href={`/inventory/transfers?status=${s}`}>
            <Badge
              variant={statusFilter === s ? "default" : "outline"}
              className="cursor-pointer"
            >
              {STATUS_META[s].label} ({countByStatus[s] || 0})
            </Badge>
          </Link>
        ))}
      </div>

      <Card>
        <CardContent className="pt-6">
          {transfers.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <ArrowLeftRight className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No transfers found.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Transfer #</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>From → To</TableHead>
                  <TableHead className="text-right">Items</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead>By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfers.map((t) => (
                  <TableRow key={t.id} className="cursor-pointer hover:bg-muted/40">
                    <TableCell>
                      <Link
                        href={`/inventory/transfers/${t.id}`}
                        className="font-mono text-xs font-medium hover:text-primary"
                      >
                        {t.transferNumber}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_META[t.status].variant} className="text-xs">
                        {STATUS_META[t.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {t.fromLocation.name}
                      <span className="text-muted-foreground mx-2">→</span>
                      {t.toLocation.name}
                    </TableCell>
                    <TableCell className="text-right text-sm">{t._count.items}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDateTime(t.requestedAt)}
                    </TableCell>
                    <TableCell className="text-xs">{t.requestedBy.name}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
