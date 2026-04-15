import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { salesChannelUpdateSchema } from "@/lib/validators/sales";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return Response.json(
      { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  const { id } = await params;
  const channel = await prisma.salesChannel.findUnique({
    where: { id },
    include: { _count: { select: { orders: true } } },
  });
  if (!channel) {
    return Response.json({ error: { code: "NOT_FOUND", message: "Channel not found" } }, { status: 404 });
  }
  return Response.json({ data: channel });
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
  const existing = await prisma.salesChannel.findUnique({ where: { id } });
  if (!existing) {
    return Response.json({ error: { code: "NOT_FOUND", message: "Channel not found" } }, { status: 404 });
  }

  const body = await request.json();
  const parsed = salesChannelUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() } },
      { status: 400 }
    );
  }

  const { commissionRate, apiConfig, ...rest } = parsed.data;
  const data: Prisma.SalesChannelUpdateInput = { ...rest };
  if (apiConfig !== undefined) {
    data.apiConfig = (apiConfig ?? Prisma.JsonNull) as Prisma.InputJsonValue | typeof Prisma.JsonNull;
  }
  if (commissionRate !== undefined) {
    data.commissionRate = commissionRate != null ? new Prisma.Decimal(commissionRate) : null;
  }

  const updated = await prisma.salesChannel.update({ where: { id }, data });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "UPDATE",
      entityType: "SalesChannel",
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
  const existing = await prisma.salesChannel.findUnique({ where: { id } });
  if (!existing) {
    return Response.json({ error: { code: "NOT_FOUND", message: "Channel not found" } }, { status: 404 });
  }

  const updated = await prisma.salesChannel.update({ where: { id }, data: { isActive: false } });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "DEACTIVATE",
      entityType: "SalesChannel",
      entityId: id,
      oldValue: { isActive: true },
      newValue: { isActive: false },
    },
  });

  return Response.json({ data: updated });
}
