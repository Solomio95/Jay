import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { customerCreateSchema } from "@/lib/validators/sales";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return Response.json(
      { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  const sp = request.nextUrl.searchParams;
  const search = sp.get("search")?.trim() ?? "";
  const type = sp.get("type");
  const includeInactive = sp.get("includeInactive") === "true";
  const limit = Math.min(parseInt(sp.get("limit") ?? "50", 10), 200);
  const page = Math.max(parseInt(sp.get("page") ?? "1", 10), 1);

  const where: Prisma.CustomerWhereInput = {};
  if (!includeInactive) where.isActive = true;
  if (type) where.customerType = type as Prisma.CustomerWhereInput["customerType"];
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { phone: { contains: search, mode: "insensitive" } },
      { companyName: { contains: search, mode: "insensitive" } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      include: { _count: { select: { orders: true } } },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: (page - 1) * limit,
    }),
    prisma.customer.count({ where }),
  ]);

  return Response.json({ data: items, meta: { total, page, limit } });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return Response.json(
      { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  const role = (session.user as unknown as { role: string }).role;
  if (role === "VIEWER") {
    return Response.json(
      { error: { code: "FORBIDDEN", message: "Read-only role" } },
      { status: 403 }
    );
  }

  const body = await request.json();
  const parsed = customerCreateSchema.safeParse(body);
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

  const { creditLimitMyr, email, ...rest } = parsed.data;
  const customer = await prisma.customer.create({
    data: {
      ...rest,
      email: email || null,
      creditLimitMyr: creditLimitMyr != null ? new Prisma.Decimal(creditLimitMyr) : null,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "CREATE",
      entityType: "Customer",
      entityId: customer.id,
      newValue: { name: customer.name, customerType: customer.customerType },
    },
  });

  return Response.json({ data: customer }, { status: 201 });
}
