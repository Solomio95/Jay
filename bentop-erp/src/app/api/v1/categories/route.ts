import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { categoryCreateSchema } from "@/lib/validators/product";
import { generateSlug } from "@/lib/sku";
import { handleApiError } from "@/lib/api-error";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
    }
  
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      include: {
        children: {
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
        },
        _count: { select: { products: true } },
      },
      orderBy: { sortOrder: "asc" },
    });
  
    return Response.json({ data: categories });
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
  
    const role = (session.user as unknown as { role: string }).role;
    if (role !== "ADMIN" && role !== "MANAGER") {
      return Response.json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 });
    }
  
    const body = await request.json();
    const parsed = categoryCreateSchema.safeParse(body);
  
    if (!parsed.success) {
      return Response.json({
        error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() },
      }, { status: 400 });
    }
  
    const data = parsed.data;
    const slug = data.slug || generateSlug(data.name);
  
    // Check for duplicate slug
    const existing = await prisma.category.findUnique({ where: { slug } });
    if (existing) {
      return Response.json({
        error: { code: "DUPLICATE", message: `Category with slug "${slug}" already exists` },
      }, { status: 409 });
    }
  
    const category = await prisma.category.create({
      data: {
        name: data.name,
        slug,
        parentId: data.parentId ?? null,
        description: data.description,
        sortOrder: data.sortOrder,
        isActive: data.isActive,
      },
      include: {
        children: true,
        _count: { select: { products: true } },
      },
    });
  
    return Response.json({ data: category }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
