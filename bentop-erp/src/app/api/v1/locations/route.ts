import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { locationCreateSchema } from "@/lib/validators/inventory";
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
  
    const searchParams = request.nextUrl.searchParams;
    const includeInactive = searchParams.get("includeInactive") === "true";
    const type = searchParams.get("type");
  
    const where: Record<string, unknown> = {};
    if (!includeInactive) where.isActive = true;
    if (type) where.type = type;
  
    const locations = await prisma.location.findMany({
      where,
      include: {
        _count: { select: { stockLevels: true } },
      },
      orderBy: [{ type: "asc" }, { name: "asc" }],
    });
  
    return Response.json({ data: locations });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
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
      return Response.json(
        { error: { code: "FORBIDDEN", message: "Insufficient permissions" } },
        { status: 403 }
      );
    }
  
    const body = await request.json();
    const parsed = locationCreateSchema.safeParse(body);
  
    if (!parsed.success) {
      return Response.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid input",
            details: parsed.error.flatten(),
          },
        },
        { status: 400 }
      );
    }
  
    const location = await prisma.location.create({ data: parsed.data });
  
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CREATE",
        entityType: "Location",
        entityId: location.id,
        newValue: { name: location.name, type: location.type },
      },
    });
  
    return Response.json({ data: location }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
