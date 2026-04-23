import { NextRequest } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { userCreateSchema } from "@/lib/validators/user";
import { handleApiError } from "@/lib/api-error";

function requireAdmin(role: string) {
  if (role !== "ADMIN") {
    return Response.json(
      { error: { code: "FORBIDDEN", message: "Admin access required" } },
      { status: 403 }
    );
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const role = (session.user as unknown as { role: string }).role;
    const denied = requireAdmin(role);
    if (denied) return denied;

    const sp = request.nextUrl.searchParams;
    const search = sp.get("search")?.trim() ?? "";
    const includeInactive = sp.get("includeInactive") === "true";

    const where: Record<string, unknown> = {};
    if (!includeInactive) where.isActive = true;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { department: { contains: search, mode: "insensitive" } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        department: true,
        isActive: true,
        createdAt: true,
        lastLoginAt: true,
      },
      orderBy: [{ isActive: "desc" }, { role: "asc" }, { name: "asc" }],
    });

    return Response.json({ data: users });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const role = (session.user as unknown as { role: string }).role;
    const denied = requireAdmin(role);
    if (denied) return denied;

    const body = await request.json();
    const parsed = userCreateSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() } },
        { status: 400 }
      );
    }

    const { password, ...rest } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email: rest.email } });
    if (existing) {
      return Response.json(
        { error: { code: "CONFLICT", message: "Email already in use" } },
        { status: 409 }
      );
    }

    const passwordHash = await hash(password, 12);
    const user = await prisma.user.create({
      data: { ...rest, passwordHash },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CREATE",
        entityType: "User",
        entityId: user.id,
        newValue: { name: user.name, email: user.email, role: user.role },
      },
    });

    return Response.json({ data: user }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
