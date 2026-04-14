import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { categoryUpdateSchema } from "@/lib/validators/product";
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

  const category = await prisma.category.findUnique({
    where: { id },
    include: {
      parent: true,
      children: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
      _count: { select: { products: true } },
    },
  });

  if (!category) {
    return Response.json({ error: { code: "NOT_FOUND", message: "Category not found" } }, { status: 404 });
  }

  return Response.json({ data: category });
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
  const parsed = categoryUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({
      error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() },
    }, { status: 400 });
  }

  const data = parsed.data;

  // Auto-generate slug if name changed but slug not provided
  if (data.name && !data.slug) {
    data.slug = generateSlug(data.name);
  }

  // Check slug uniqueness if changing
  if (data.slug) {
    const existing = await prisma.category.findFirst({
      where: { slug: data.slug, id: { not: id } },
    });
    if (existing) {
      return Response.json({
        error: { code: "DUPLICATE", message: `Slug "${data.slug}" already in use` },
      }, { status: 409 });
    }
  }

  const category = await prisma.category.update({
    where: { id },
    data,
    include: {
      children: true,
      _count: { select: { products: true } },
    },
  });

  return Response.json({ data: category });
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
    return Response.json({ error: { code: "FORBIDDEN", message: "Only admins can delete categories" } }, { status: 403 });
  }

  const { id } = await params;

  // Soft delete: deactivate instead of hard delete
  const category = await prisma.category.update({
    where: { id },
    data: { isActive: false },
  });

  return Response.json({ data: category });
}
