import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { productCreateSchema } from "@/lib/validators/product";
import { generateSlug } from "@/lib/sku";
import { handleApiError } from "@/lib/api-error";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
    }
  
    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "20")));
    const search = searchParams.get("search") || "";
    const categoryId = searchParams.get("categoryId") || "";
    const isActive = searchParams.get("isActive");
    const sortBy = searchParams.get("sortBy") || "updatedAt";
    const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" as const : "desc" as const;
  
    const where: Record<string, unknown> = {};
  
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { skuPrefix: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { variants: { some: { sku: { contains: search, mode: "insensitive" } } } },
      ];
    }
  
    if (categoryId) {
      where.categoryId = categoryId;
    }
  
    if (isActive !== null && isActive !== undefined && isActive !== "") {
      where.isActive = isActive === "true";
    }
  
    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          category: { select: { id: true, name: true, slug: true } },
          variants: {
            where: { isActive: true },
            select: { id: true, sku: true, size: true, color: true, colorHex: true, isActive: true },
            orderBy: [{ color: "asc" }, { size: "asc" }],
          },
          _count: { select: { variants: true } },
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.product.count({ where }),
    ]);
  
    return Response.json({
      data: products,
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    });
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
    const parsed = productCreateSchema.safeParse(body);
  
    if (!parsed.success) {
      return Response.json({
        error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() },
      }, { status: 400 });
    }
  
    const data = parsed.data;
    const slug = data.slug || generateSlug(data.name);
  
    // Check slug uniqueness
    const existing = await prisma.product.findUnique({ where: { slug } });
    if (existing) {
      return Response.json({
        error: { code: "DUPLICATE", message: `Product with slug "${slug}" already exists` },
      }, { status: 409 });
    }
  
    const product = await prisma.product.create({
      data: {
        name: data.name,
        slug,
        skuPrefix: data.skuPrefix,
        description: data.description,
        categoryId: data.categoryId,
        brand: data.brand,
        baseCostMyr: data.baseCostMyr,
        baseCostUsd: data.baseCostUsd ?? null,
        baseCostRmb: data.baseCostRmb ?? null,
        weightKg: data.weightKg ?? null,
        material: data.material,
        careInstructions: data.careInstructions,
        isActive: data.isActive,
      },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        variants: true,
      },
    });
  
    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CREATE",
        entityType: "Product",
        entityId: product.id,
        newValue: { name: product.name, sku: product.skuPrefix },
      },
    });
  
    return Response.json({ data: product }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
