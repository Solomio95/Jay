import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { UserManagerClient } from "@/components/settings/user-manager-client";

export default async function UsersSettingsPage() {
  const session = await auth();
  const role = (session?.user as unknown as { role: string } | undefined)?.role ?? "VIEWER";

  if (role !== "ADMIN") redirect("/settings");

  const users = await prisma.user.findMany({
    select: {
      id: true, name: true, email: true, role: true,
      phone: true, department: true, isActive: true,
      createdAt: true, lastLoginAt: true,
    },
    orderBy: [{ isActive: "desc" }, { role: "asc" }, { name: "asc" }],
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">User Management</h2>
        <p className="text-muted-foreground">
          Create staff accounts, assign roles, and manage access. Admin only.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Users</CardTitle>
          <CardDescription>
            ADMIN has full access. MANAGER can create/edit records. STAFF can record transactions. VIEWER is read-only.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UserManagerClient
            initialUsers={users.map((u) => ({
              ...u,
              createdAt: u.createdAt.toISOString(),
              lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
            }))}
            currentUserId={session!.user.id}
          />
        </CardContent>
      </Card>
    </div>
  );
}
