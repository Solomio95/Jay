import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { locationUpdateSchema } from "@/lib/validators/inventory";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return Response.json(
      { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  const { id } = await params;
  const location = await prisma.location.findUnique({
    where: { id },
    include: { _count: { select: { stockLevels: true } } },
  });

  if (!location) {
    return Response.json({ error: { code: "NOT_FOUND", message: "Location not found" } }, { status: 404 });
  }

  return Response.json({ data: location });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return Response.json(
      { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  const role = (session.user as unknown as { role: string }).role;
  if (role !== "ADMIN" && role !== "MANAGER") {
    return Response.json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.location.findUnique({ where: { id } });
  if (!existing) {
    return Response.json({ error: { code: "NOT_FOUND", message: "Location not found" } }, { status: 404 });
  }

  const body = await request.json();
  const parsed = locationUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() } },
      { status: 400 }
    );
  }

  const updated = await prisma.location.update({ where: { id }, data: parsed.data });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "UPDATE",
      entityType: "Location",
      entityId: id,
      oldValue: { name: existing.name, isActive: existing.isActive },
      newValue: { name: updated.name, isActive: updated.isActive },
    },
  });

  return Response.json({ data: updated });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return Response.json(
      { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  const role = (session.user as unknown as { role: string }).role;
  if (role !== "ADMIN") {
    return Response.json({ error: { code: "FORBIDDEN", message: "Admin only" } }, { status: 403 });
  }

  const { id } = await params;

  // Block deletion if there is any stock
  const stockCount = await prisma.stockLevel.count({
    where: { locationId: id, quantityOnHand: { gt: 0 } },
  });
  if (stockCount > 0) {
    return Response.json(
      {
        error: {
          code: "CONFLICT",
          message: `Cannot delete: location has stock in ${stockCount} records. Move stock out first.`,
        },
      },
      { status: 409 }
    );
  }

  const updated = await prisma.location.update({ where: { id }, data: { isActive: false } });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "DEACTIVATE",
      entityType: "Location",
      entityId: id,
      oldValue: { isActive: true },
      newValue: { isActive: false },
    },
  });

  return Response.json({ data: updated });
}
