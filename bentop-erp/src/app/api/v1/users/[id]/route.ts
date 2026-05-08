import { NextRequest } from "next/server";
import { hash } from "bcryptjs";
import { Prisma } from "@prisma/client";

import { auth } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";
import { prisma } from "@/lib/db";
import { userUpdateSchema } from "@/lib/validators/users";

function sanitizeUser<T extends { passwordHash?: string }>(user: T) {
  const safeUser = { ...user };
  delete safeUser.passwordHash;
  return safeUser;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
    }

    if (session.user.role !== "ADMIN") {
      return Response.json({ error: { code: "FORBIDDEN", message: "Admin access required" } }, { status: 403 });
    }

    const { id } = await params;
    const parsed = userUpdateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        { error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() } },
        { status: 400 },
      );
    }

    const data = parsed.data;
    const passwordHash = data.password ? await hash(data.password, 10) : undefined;

    if (id === session.user.id && data.isActive === false) {
      return Response.json(
        { error: { code: "SELF_DEACTIVATE_BLOCKED", message: "You cannot deactivate your own account" } },
        { status: 400 },
      );
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        email: data.email,
        name: data.name,
        phone: data.phone,
        department: data.department,
        role: data.role,
        defaultLocationId: data.defaultLocationId,
        isActive: data.isActive,
        ...(passwordHash ? { passwordHash } : {}),
        ...(data.supervisedLocationIds
          ? {
              supervisedLocations: {
                set: data.supervisedLocationIds.map((locationId) => ({ id: locationId })),
              },
            }
          : {}),
      },
      include: {
        defaultLocation: { select: { id: true, name: true, type: true } },
        supervisedLocations: { select: { id: true, name: true, type: true } },
        temporaryLocations: {
          include: { location: { select: { id: true, name: true, type: true } } },
          orderBy: { startsAt: "desc" },
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "UPDATE",
        entityType: "User",
        entityId: user.id,
        newValue: {
          email: user.email,
          role: user.role,
          defaultLocationId: user.defaultLocationId,
          supervisedLocationIds: user.supervisedLocations.map((location) => location.id),
          isActive: user.isActive,
          passwordChanged: Boolean(passwordHash),
        },
      },
    });

    return Response.json({ data: sanitizeUser(user) });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return Response.json({ error: { code: "DUPLICATE_USER", message: "Email is already registered" } }, { status: 409 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return Response.json({ error: { code: "NOT_FOUND", message: "User not found" } }, { status: 404 });
    }
    return handleApiError(error);
  }
}
