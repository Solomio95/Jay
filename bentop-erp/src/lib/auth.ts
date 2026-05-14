import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/db";
import type { UserRole } from "@prisma/client";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user || !user.isActive) {
          return null;
        }

        const isPasswordValid = await compare(
          credentials.password as string,
          user.passwordHash
        );

        if (!isPasswordValid) {
          return null;
        }

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          defaultLocationId: user.defaultLocationId,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = (user as { role: UserRole }).role;
        token.defaultLocationId = (user as { defaultLocationId?: string | null }).defaultLocationId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const latestUser = token.id
          ? await prisma.user.findUnique({
              where: { id: token.id as string },
              select: {
                email: true,
                name: true,
                role: true,
                defaultLocationId: true,
              },
            })
          : null;

        (session.user as unknown as Record<string, unknown>).id = token.id as string;
        session.user.name = latestUser?.name ?? session.user.name;
        session.user.email = latestUser?.email ?? session.user.email;
        (session.user as unknown as Record<string, unknown>).role =
          latestUser?.role ?? (token.role as string);
        (session.user as unknown as Record<string, unknown>).defaultLocationId =
          latestUser?.defaultLocationId ?? (token.defaultLocationId as string | null | undefined);
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 hours
  },
});
