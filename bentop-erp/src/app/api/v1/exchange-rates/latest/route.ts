import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return Response.json(
      { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  const sp = request.nextUrl.searchParams;
  const fromCurrency = sp.get("from");
  const toCurrency = sp.get("to");

  if (!fromCurrency || !toCurrency) {
    return Response.json(
      { error: { code: "VALIDATION_ERROR", message: "'from' and 'to' query params are required" } },
      { status: 400 }
    );
  }

  if (fromCurrency === toCurrency) {
    return Response.json({
      data: { fromCurrency, toCurrency, rate: "1", effectiveDate: new Date().toISOString(), source: "identity" },
    });
  }

  const rate = await prisma.exchangeRate.findFirst({
    where: {
      fromCurrency: fromCurrency as "MYR" | "USD" | "RMB",
      toCurrency: toCurrency as "MYR" | "USD" | "RMB",
      effectiveDate: { lte: new Date() },
    },
    orderBy: { effectiveDate: "desc" },
  });

  if (!rate) {
    // Try the inverse pair
    const inverse = await prisma.exchangeRate.findFirst({
      where: {
        fromCurrency: toCurrency as "MYR" | "USD" | "RMB",
        toCurrency: fromCurrency as "MYR" | "USD" | "RMB",
        effectiveDate: { lte: new Date() },
      },
      orderBy: { effectiveDate: "desc" },
    });

    if (inverse) {
      const inverseRate = 1 / Number(inverse.rate);
      return Response.json({
        data: {
          fromCurrency,
          toCurrency,
          rate: inverseRate.toFixed(6),
          effectiveDate: inverse.effectiveDate.toISOString(),
          source: `inverse of ${inverse.fromCurrency}→${inverse.toCurrency}`,
        },
      });
    }

    return Response.json(
      { error: { code: "NOT_FOUND", message: `No exchange rate found for ${fromCurrency}→${toCurrency}` } },
      { status: 404 }
    );
  }

  return Response.json({
    data: {
      fromCurrency: rate.fromCurrency,
      toCurrency: rate.toCurrency,
      rate: rate.rate.toString(),
      effectiveDate: rate.effectiveDate.toISOString(),
      source: rate.source,
    },
  });
}
