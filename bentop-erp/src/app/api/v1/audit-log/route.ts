import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";

export async function GET(request: NextRequest) {
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

    const sp = request.nextUrl.searchParams;
    const search = sp.get("search")?.trim() ?? "";
    const entityType = sp.get("entityType");
    const limit = Math.min(parseInt(sp.get("limit") ?? "50", 10), 200);
    const page = Math.max(parseInt(sp.get("page") ?? "1", 10), 1);

    const where: Record<string, unknown> = {};
    if (entityType) where.entityType = entityType;
    if (search) {
      where.OR = [
        { action: { contains: search, mode: "insensitive" } },
        { entityType: { contains: search, mode: "insensitive" } },
        { entityId: { contains: search, mode: "insensitive" } },
        { user: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { user: { select: { name: true, email: true } } },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: (page - 1) * limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return Response.json({ data: items, meta: { total, page, limit } });
  } catch (error) {
    return handleApiError(error);
  }
}
