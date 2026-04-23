import { SessionProvider } from "@/components/providers/session-provider";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
