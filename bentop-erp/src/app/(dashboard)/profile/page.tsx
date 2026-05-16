import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ProfileFormClient } from "@/components/profile/profile-form-client";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      defaultLocation: { select: { id: true, name: true, type: true } },
      supervisedLocations: { select: { id: true, name: true, type: true } },
      temporaryLocations: {
        include: { location: { select: { id: true, name: true, type: true } } },
        orderBy: { startsAt: "desc" },
      },
    },
  });

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Profile</h2>
        <p className="text-muted-foreground">
          Employee information, account access, and assigned location coverage.
        </p>
      </div>
      <ProfileFormClient
        user={{
          ...user,
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString(),
          lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
          temporaryLocations: user.temporaryLocations.map((coverage) => ({
            ...coverage,
            startsAt: coverage.startsAt.toISOString(),
            endsAt: coverage.endsAt.toISOString(),
          })),
        }}
      />
    </div>
  );
}
