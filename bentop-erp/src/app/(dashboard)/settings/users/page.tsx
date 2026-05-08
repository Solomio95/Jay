import { ShieldAlert } from "lucide-react";

import { UserManagerClient } from "@/components/settings/user-manager-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function UsersSettingsPage() {
  const session = await auth();

  if (session?.user.role !== "ADMIN") {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Users & Roles</h2>
          <p className="text-muted-foreground">Only admin users can register and manage ERP accounts.</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldAlert className="h-4 w-4" />
              Admin access required
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Please sign in with an admin account to create promoters, supervisors, staff, managers, or viewers.
          </CardContent>
        </Card>
      </div>
    );
  }

  const [users, locations] = await Promise.all([
    prisma.user.findMany({
      include: {
        defaultLocation: { select: { id: true, name: true, type: true } },
        supervisedLocations: { select: { id: true, name: true, type: true } },
        temporaryLocations: {
          include: { location: { select: { id: true, name: true, type: true } } },
          orderBy: { startsAt: "desc" },
        },
      },
      orderBy: [{ isActive: "desc" }, { role: "asc" }, { name: "asc" }],
    }),
    prisma.location.findMany({
      where: { isActive: true },
      select: { id: true, name: true, type: true },
      orderBy: [{ type: "asc" }, { name: "asc" }],
    }),
  ]);

  const safeUsers = users.map((user) => {
    const { passwordHash, ...safeUser } = user;
    void passwordHash;
    return safeUser;
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Users & Roles</h2>
        <p className="text-muted-foreground">
          Register ERP accounts, assign roles, and lock promoters or supervisors to locations.
        </p>
      </div>
      <UserManagerClient initialUsers={safeUsers} locations={locations} />
    </div>
  );
}
