import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AuditLogClient } from "@/components/settings/audit-log-client";

export default async function AuditLogPage() {
  const session = await auth();
  const role = (session?.user as unknown as { role: string } | undefined)?.role ?? "VIEWER";

  if (role !== "ADMIN") redirect("/settings");

  const [logs, total, entityTypes] = await Promise.all([
    prisma.auditLog.findMany({
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.auditLog.count(),
    prisma.auditLog.findMany({
      select: { entityType: true },
      distinct: ["entityType"],
      orderBy: { entityType: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Audit Log</h2>
        <p className="text-muted-foreground">
          Full history of all create, update, and delete actions. Admin only.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Activity History</CardTitle>
          <CardDescription>{total.toLocaleString()} total entries</CardDescription>
        </CardHeader>
        <CardContent>
          <AuditLogClient
            initialLogs={logs.map((l) => ({
              ...l,
              createdAt: l.createdAt.toISOString(),
            }))}
            initialTotal={total}
            entityTypes={entityTypes.map((e) => e.entityType)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
