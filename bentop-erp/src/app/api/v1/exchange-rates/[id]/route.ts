import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { exchangeRateUpdateSchema } from "@/lib/validators/currency";
import { handleApiError } from "@/lib/api-error";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }
  
    const { id } = await params;
    const rate = await prisma.exchangeRate.findUnique({ where: { id } });
  
    if (!rate) {
      return Response.json({ error: { code: "NOT_FOUND", message: "Exchange rate not found" } }, { status: 404 });
    }
  
    return Response.json({ data: rate });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
        { error: { code: "FORBIDDEN", message: "Only managers can manage exchange rates" } },
        { status: 403 }
      );
    }
  
    const { id } = await params;
    const existing = await prisma.exchangeRate.findUnique({ where: { id } });
    if (!existing) {
      return Response.json({ error: { code: "NOT_FOUND", message: "Exchange rate not found" } }, { status: 404 });
    }
  
    const body = await request.json();
    const parsed = exchangeRateUpdateSchema.safeParse(body);
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
  
    const updated = await prisma.exchangeRate.update({
      where: { id },
      data: {
        ...(data.rate !== undefined && { rate: new Prisma.Decimal(data.rate) }),
        ...(data.effectiveDate && { effectiveDate: new Date(data.effectiveDate) }),
        ...(data.source !== undefined && { source: data.source }),
      },
    });
  
    await prisma.auditLog.create({
      data: {
        userId,
        action: "EXCHANGE_RATE_UPDATED",
        entityType: "ExchangeRate",
        entityId: id,
        oldValue: {
          rate: existing.rate.toString(),
          effectiveDate: existing.effectiveDate.toISOString(),
        },
        newValue: {
          rate: updated.rate.toString(),
          effectiveDate: updated.effectiveDate.toISOString(),
        },
      },
    });
  
    return Response.json({ data: updated });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
        { error: { code: "FORBIDDEN", message: "Only managers can manage exchange rates" } },
        { status: 403 }
      );
    }
  
    const { id } = await params;
    const existing = await prisma.exchangeRate.findUnique({ where: { id } });
    if (!existing) {
      return Response.json({ error: { code: "NOT_FOUND", message: "Exchange rate not found" } }, { status: 404 });
    }
  
    await prisma.exchangeRate.delete({ where: { id } });
  
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "EXCHANGE_RATE_DELETED",
        entityType: "ExchangeRate",
        entityId: id,
        oldValue: {
          fromCurrency: existing.fromCurrency,
          toCurrency: existing.toCurrency,
          rate: existing.rate.toString(),
        },
      },
    });
  
    return Response.json({ data: { success: true } });
  } catch (error) {
    return handleApiError(error);
  }
}
