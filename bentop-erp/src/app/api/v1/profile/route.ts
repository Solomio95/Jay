import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";
import { prisma } from "@/lib/db";
import { profileUpdateSchema } from "@/lib/validators/users";

function sanitizeUser<T extends { passwordHash?: string }>(user: T) {
  const safeUser = { ...user };
  delete safeUser.passwordHash;
  return safeUser;
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
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
      return Response.json({ error: { code: "NOT_FOUND", message: "Profile not found" } }, { status: 404 });
    }

    return Response.json({ data: sanitizeUser(user) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
    }

    const parsed = profileUpdateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        { error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() } },
        { status: 400 }
      );
    }

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: parsed.data,
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
        action: "UPDATE_PROFILE",
        entityType: "User",
        entityId: user.id,
        newValue: {
          name: user.name,
          phone: user.phone,
          department: user.department,
        },
      },
    });

    return Response.json({ data: sanitizeUser(user) });
  } catch (error) {
    return handleApiError(error);
  }
}
