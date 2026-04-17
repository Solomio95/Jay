import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { exchangeRateCreateSchema } from "@/lib/validators/currency";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return Response.json(
      { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  const sp = request.nextUrl.searchParams;
  const fromCurrency = sp.get("fromCurrency");
  const toCurrency = sp.get("toCurrency");
  const limit = Math.min(parseInt(sp.get("limit") ?? "50", 10), 200);
  const page = Math.max(parseInt(sp.get("page") ?? "1", 10), 1);

  const where: Prisma.ExchangeRateWhereInput = {};
  if (fromCurrency) where.fromCurrency = fromCurrency as Prisma.ExchangeRateWhereInput["fromCurrency"];
  if (toCurrency) where.toCurrency = toCurrency as Prisma.ExchangeRateWhereInput["toCurrency"];

  const [items, total] = await Promise.all([
    prisma.exchangeRate.findMany({
      where,
      orderBy: { effectiveDate: "desc" },
      take: limit,
      skip: (page - 1) * limit,
    }),
    prisma.exchangeRate.count({ where }),
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
  if (role !== "ADMIN" && role !== "MANAGER") {
    return Response.json(
      { error: { code: "FORBIDDEN", message: "Only managers can manage exchange rates" } },
      { status: 403 }
    );
  }

  const body = await request.json();
  const parsed = exchangeRateCreateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() },
      },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const userId = session.user.id;

  const rate = await prisma.exchangeRate.create({
    data: {
      fromCurrency: data.fromCurrency,
      toCurrency: data.toCurrency,
      rate: new Prisma.Decimal(data.rate),
      effectiveDate: new Date(data.effectiveDate),
      source: data.source ?? null,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId,
      action: "EXCHANGE_RATE_CREATED",
      entityType: "ExchangeRate",
      entityId: rate.id,
      newValue: {
        fromCurrency: data.fromCurrency,
        toCurrency: data.toCurrency,
        rate: data.rate,
        effectiveDate: data.effectiveDate,
      },
    },
  });

  return Response.json({ data: rate }, { status: 201 });
}
