import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
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

  return (
    <SessionProvider>
      <DashboardShell
        user={{
          name: session.user.name || "",
          email: session.user.email || "",
          role: session.user.role,
        }}
      >
        {children}
      </DashboardShell>
    </SessionProvider>
  );
}
