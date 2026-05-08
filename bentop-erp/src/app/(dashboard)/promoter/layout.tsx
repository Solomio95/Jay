import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function PromoterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (session?.user.role !== "PROMOTER") {
    redirect("/");
  }

  return children;
}
