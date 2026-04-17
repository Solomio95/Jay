import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { salesChannelCreateSchema } from "@/lib/validators/sales";
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
  
    const sp = request.nextUrl.searchParams;
    const includeInactive = sp.get("includeInactive") === "true";
  
    const where: Prisma.SalesChannelWhereInput = {};
    if (!includeInactive) where.isActive = true;
  
    const channels = await prisma.salesChannel.findMany({
      where,
      include: { _count: { select: { orders: true } } },
      orderBy: [{ type: "asc" }, { name: "asc" }],
    });
  
    return Response.json({ data: channels });
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
    const parsed = salesChannelCreateSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        {
          error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() },
        },
        { status: 400 }
      );
    }
  
    const { commissionRate, apiConfig, ...rest } = parsed.data;
    const channel = await prisma.salesChannel.create({
      data: {
        ...rest,
        apiConfig: (apiConfig ?? Prisma.JsonNull) as Prisma.InputJsonValue | typeof Prisma.JsonNull,
        commissionRate: commissionRate != null ? new Prisma.Decimal(commissionRate) : null,
      },
    });
  
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CREATE",
        entityType: "SalesChannel",
        entityId: channel.id,
        newValue: { name: channel.name, type: channel.type },
      },
    });
  
    return Response.json({ data: channel }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
