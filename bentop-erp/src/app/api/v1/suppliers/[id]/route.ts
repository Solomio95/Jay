import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { supplierUpdateSchema } from "@/lib/validators/purchase";
import { handleApiError } from "@/lib/api-error";

function canMutate(role: string) {
  return role === "ADMIN" || role === "MANAGER";
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
    }

    const { id } = await params;
    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: {
        purchaseOrders: {
          orderBy: { orderDate: "desc" },
          take: 20,
          include: { _count: { select: { items: true, receipts: true } } },
        },
      },
    });

    if (!supplier) {
      return Response.json({ error: { code: "NOT_FOUND", message: "Supplier not found" } }, { status: 404 });
    }

    return Response.json({ data: supplier });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
    }

    const role = (session.user as unknown as { role: string }).role;
    if (!canMutate(role)) {
      return Response.json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 });
    }

    const { id } = await params;
    const existing = await prisma.supplier.findUnique({ where: { id } });
    if (!existing) {
      return Response.json({ error: { code: "NOT_FOUND", message: "Supplier not found" } }, { status: 404 });
    }

    const parsed = supplierUpdateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        { error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() } },
        { status: 400 }
      );
    }

    const supplier = await prisma.supplier.update({ where: { id }, data: parsed.data });
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "UPDATE",
        entityType: "Supplier",
        entityId: id,
        oldValue: { name: existing.name, isActive: existing.isActive },
        newValue: { name: supplier.name, isActive: supplier.isActive },
      },
    });

    return Response.json({ data: supplier });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
    }

    const role = (session.user as unknown as { role: string }).role;
    if (role !== "ADMIN") {
      return Response.json({ error: { code: "FORBIDDEN", message: "Admin only" } }, { status: 403 });
    }

    const { id } = await params;
    const supplier = await prisma.supplier.update({ where: { id }, data: { isActive: false } });
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "DEACTIVATE",
        entityType: "Supplier",
        entityId: id,
        oldValue: { isActive: true },
        newValue: { isActive: false },
      },
    });

    return Response.json({ data: supplier });
  } catch (error) {
    return handleApiError(error);
  }
}
