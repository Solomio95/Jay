import { NextRequest } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { userUpdateSchema } from "@/lib/validators/user";
import { handleApiError } from "@/lib/api-error";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const role = (session.user as unknown as { role: string }).role;
    if (role !== "ADMIN") {
      return Response.json(
        { error: { code: "FORBIDDEN", message: "Admin access required" } },
        { status: 403 }
      );
    }

    const { id } = await params;
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true, name: true, email: true, role: true,
        phone: true, department: true, isActive: true,
        createdAt: true, lastLoginAt: true,
      },
    });

    if (!user) {
      return Response.json(
        { error: { code: "NOT_FOUND", message: "User not found" } },
        { status: 404 }
      );
    }

    return Response.json({ data: user });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const role = (session.user as unknown as { role: string }).role;
    if (role !== "ADMIN") {
      return Response.json(
        { error: { code: "FORBIDDEN", message: "Admin access required" } },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = userUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() } },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return Response.json(
        { error: { code: "NOT_FOUND", message: "User not found" } },
        { status: 404 }
      );
    }

    // Prevent admin from deactivating themselves
    if (id === session.user.id && parsed.data.isActive === false) {
      return Response.json(
        { error: { code: "FORBIDDEN", message: "Cannot deactivate your own account" } },
        { status: 403 }
      );
    }

    const { password, ...rest } = parsed.data;
    const updateData: Record<string, unknown> = { ...rest };
    if (password) {
      updateData.passwordHash = await hash(password, 12);
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "UPDATE",
        entityType: "User",
        entityId: id,
        oldValue: { role: existing.role, isActive: existing.isActive },
        newValue: { role: user.role, isActive: user.isActive },
      },
    });

    return Response.json({ data: user });
  } catch (error) {
    return handleApiError(error);
  }
}
