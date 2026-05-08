import { NextRequest } from "next/server";
import { hash } from "bcryptjs";
import { Prisma } from "@prisma/client";

import { auth } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";
import { prisma } from "@/lib/db";
import { userCreateSchema } from "@/lib/validators/users";

function sanitizeUser<T extends { passwordHash?: string }>(user: T) {
  const safeUser = { ...user };
  delete safeUser.passwordHash;
  return safeUser;
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
    }

    if (session.user.role !== "ADMIN") {
      return Response.json({ error: { code: "FORBIDDEN", message: "Admin access required" } }, { status: 403 });
    }

    const search = request.nextUrl.searchParams.get("search")?.trim();
    const role = request.nextUrl.searchParams.get("role");
    const includeInactive = request.nextUrl.searchParams.get("includeInactive") === "true";

    const where: Prisma.UserWhereInput = {
      ...(includeInactive ? {} : { isActive: true }),
      ...(role ? { role: role as Prisma.EnumUserRoleFilter["equals"] } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
              { phone: { contains: search, mode: "insensitive" } },
              { department: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const users = await prisma.user.findMany({
      where,
      include: {
        defaultLocation: { select: { id: true, name: true, type: true } },
        supervisedLocations: { select: { id: true, name: true, type: true } },
        temporaryLocations: {
          include: { location: { select: { id: true, name: true, type: true } } },
          orderBy: { startsAt: "desc" },
        },
      },
      orderBy: [{ isActive: "desc" }, { role: "asc" }, { name: "asc" }],
    });

    return Response.json({ data: users.map(sanitizeUser) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
    }

    if (session.user.role !== "ADMIN") {
      return Response.json({ error: { code: "FORBIDDEN", message: "Admin access required" } }, { status: 403 });
    }

    const parsed = userCreateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        { error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() } },
        { status: 400 },
      );
    }

    const data = parsed.data;
    const passwordHash = await hash(data.password, 10);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        phone: data.phone,
        department: data.department,
        role: data.role,
        defaultLocationId: data.defaultLocationId,
        isActive: data.isActive,
        passwordHash,
        supervisedLocations: data.supervisedLocationIds.length
          ? { connect: data.supervisedLocationIds.map((id) => ({ id })) }
          : undefined,
      },
      include: {
        defaultLocation: { select: { id: true, name: true, type: true } },
        supervisedLocations: { select: { id: true, name: true, type: true } },
        temporaryLocations: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CREATE",
        entityType: "User",
        entityId: user.id,
        newValue: { email: user.email, role: user.role, defaultLocationId: user.defaultLocationId },
      },
    });

    return Response.json({ data: sanitizeUser(user) }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return Response.json({ error: { code: "DUPLICATE_USER", message: "Email is already registered" } }, { status: 409 });
    }
    return handleApiError(error);
  }
}
