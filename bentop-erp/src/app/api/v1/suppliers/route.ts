import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { supplierCreateSchema } from "@/lib/validators/purchase";
import { handleApiError } from "@/lib/api-error";

function canMutate(role: string) {
  return role === "ADMIN" || role === "MANAGER";
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
    }

    const includeInactive = request.nextUrl.searchParams.get("includeInactive") === "true";
    const suppliers = await prisma.supplier.findMany({
      where: includeInactive ? {} : { isActive: true },
      include: { _count: { select: { purchaseOrders: true } } },
      orderBy: { name: "asc" },
    });

    return Response.json({ data: suppliers });
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
    if (!canMutate(role)) {
      return Response.json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } }, { status: 403 });
    }

    const parsed = supplierCreateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        { error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() } },
        { status: 400 }
      );
    }

    const supplier = await prisma.supplier.create({ data: parsed.data });
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CREATE",
        entityType: "Supplier",
        entityId: supplier.id,
        newValue: { name: supplier.name, code: supplier.code },
      },
    });

    return Response.json({ data: supplier }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
