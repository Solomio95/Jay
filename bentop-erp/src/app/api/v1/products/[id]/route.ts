import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { productUpdateSchema } from "@/lib/validators/product";
import { generateSlug } from "@/lib/sku";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
  }

  const { id } = await params;

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      category: { select: { id: true, name: true, slug: true } },
      variants: {
        orderBy: [{ color: "asc" }, { size: "asc" }],
        include: {
          _count: {
            select: { stockLevels: true, orderItems: true },
          },
        },
      },
    },
  });

  if (!product) {
    return Response.json({ error: { code: "NOT_FOUND", message: "Product not found" } }, { status: 404 });
  }

  return Response.json({ data: product });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
  }

  const role = (session.user as unknown as { role: string }).role;
  if (role !== "ADMIN" && role !== "MANAGER") {
    return Response.json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = productUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({
      error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() },
    }, { status: 400 });
  }

  const data = parsed.data;

  // Fetch old values for audit
  const oldProduct = await prisma.product.findUnique({ where: { id } });
  if (!oldProduct) {
    return Response.json({ error: { code: "NOT_FOUND", message: "Product not found" } }, { status: 404 });
  }

  if (data.name && !data.slug) {
    data.slug = generateSlug(data.name);
  }

  if (data.slug) {
    const existing = await prisma.product.findFirst({
      where: { slug: data.slug, id: { not: id } },
    });
    if (existing) {
      return Response.json({
        error: { code: "DUPLICATE", message: `Slug "${data.slug}" already in use` },
      }, { status: 409 });
    }
  }

  const product = await prisma.product.update({
    where: { id },
    data: {
      ...data,
      baseCostMyr: data.baseCostMyr !== undefined ? data.baseCostMyr : undefined,
      baseCostUsd: data.baseCostUsd !== undefined ? data.baseCostUsd : undefined,
      baseCostRmb: data.baseCostRmb !== undefined ? data.baseCostRmb : undefined,
      weightKg: data.weightKg !== undefined ? data.weightKg : undefined,
    },
    include: {
      category: { select: { id: true, name: true, slug: true } },
      variants: { orderBy: [{ color: "asc" }, { size: "asc" }] },
    },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "UPDATE",
      entityType: "Product",
      entityId: product.id,
      oldValue: { name: oldProduct.name, baseCostMyr: oldProduct.baseCostMyr },
      newValue: { name: product.name, baseCostMyr: product.baseCostMyr },
    },
  });

  return Response.json({ data: product });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
  }

  const role = (session.user as unknown as { role: string }).role;
  if (role !== "ADMIN") {
    return Response.json({ error: { code: "FORBIDDEN", message: "Only admins can delete products" } }, { status: 403 });
  }

  const { id } = await params;

  // Soft delete
  const product = await prisma.product.update({
    where: { id },
    data: { isActive: false },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "SOFT_DELETE",
      entityType: "Product",
      entityId: id,
      oldValue: { name: product.name },
    },
  });

  return Response.json({ data: { id, deleted: true } });
}
