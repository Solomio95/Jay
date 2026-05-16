import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SessionProvider } from "@/components/providers/session-provider";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const latestUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      email: true,
      role: true,
    },
  });

  if (!latestUser) {
    redirect("/login");
  }

  return (
    <SessionProvider>
      <DashboardShell
        user={{
          name: latestUser.name,
          email: latestUser.email,
          role: latestUser.role,
        }}
      >
        {children}
      </DashboardShell>
    </SessionProvider>
  );
}
