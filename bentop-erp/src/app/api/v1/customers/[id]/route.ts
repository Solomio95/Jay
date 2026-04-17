import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { customerUpdateSchema } from "@/lib/validators/sales";
import { handleApiError } from "@/lib/api-error";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }
  
    const { id } = await params;
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        orders: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            totalAmount: true,
            currency: true,
            paymentStatus: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        _count: { select: { orders: true } },
      },
    });
  
    if (!customer) {
      return Response.json(
        { error: { code: "NOT_FOUND", message: "Customer not found" } },
        { status: 404 }
      );
    }
  
    return Response.json({ data: customer });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }
  
    const role = (session.user as unknown as { role: string }).role;
    if (role === "VIEWER") {
      return Response.json({ error: { code: "FORBIDDEN", message: "Read-only role" } }, { status: 403 });
    }
  
    const { id } = await params;
    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) {
      return Response.json(
        { error: { code: "NOT_FOUND", message: "Customer not found" } },
        { status: 404 }
      );
    }
  
    const body = await request.json();
    const parsed = customerUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        {
          error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() },
        },
        { status: 400 }
      );
    }
  
    const { creditLimitMyr, email, ...rest } = parsed.data;
    const data: Prisma.CustomerUpdateInput = { ...rest };
    if (email !== undefined) data.email = email || null;
    if (creditLimitMyr !== undefined) {
      data.creditLimitMyr = creditLimitMyr != null ? new Prisma.Decimal(creditLimitMyr) : null;
    }
  
    const updated = await prisma.customer.update({ where: { id }, data });
  
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "UPDATE",
        entityType: "Customer",
        entityId: id,
        oldValue: { name: existing.name, isActive: existing.isActive },
        newValue: { name: updated.name, isActive: updated.isActive },
      },
    });
  
    return Response.json({ data: updated });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
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
    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) {
      return Response.json(
        { error: { code: "NOT_FOUND", message: "Customer not found" } },
        { status: 404 }
      );
    }
  
    // Soft delete
    const updated = await prisma.customer.update({
      where: { id },
      data: { isActive: false },
    });
  
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "DEACTIVATE",
        entityType: "Customer",
        entityId: id,
        oldValue: { isActive: true },
        newValue: { isActive: false },
      },
    });
  
    return Response.json({ data: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
