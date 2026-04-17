import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ExchangeRateClient } from "@/components/settings/exchange-rate-client";

export default async function CurrencySettingsPage() {
  const session = await auth();
  const role = (session?.user as unknown as { role: string } | undefined)?.role ?? "VIEWER";
  const canEdit = role === "ADMIN" || role === "MANAGER";

  const rates = await prisma.exchangeRate.findMany({
    orderBy: { effectiveDate: "desc" },
    take: 100,
  });

  // Get the latest rate per pair
  const latestMap = new Map<string, { rate: string; effectiveDate: string; source: string | null }>();
  for (const r of rates) {
    const key = `${r.fromCurrency}→${r.toCurrency}`;
    if (!latestMap.has(key)) {
      latestMap.set(key, {
        rate: r.rate.toString(),
        effectiveDate: r.effectiveDate.toISOString(),
        source: r.source,
      });
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Currency & Exchange Rates</h2>
        <p className="text-muted-foreground">
          Manage exchange rates used in orders and reporting. MYR is the base currency.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold">MYR</div>
            <div className="text-xs text-muted-foreground mt-1">Malaysian Ringgit (base)</div>
          </CardContent>
        </Card>
        {["USD", "RMB"].map((currency) => {
          const key = `${currency}→MYR`;
          const latest = latestMap.get(key);
          return (
            <Card key={currency}>
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold">{currency}</div>
                {latest ? (
                  <div className="text-sm text-muted-foreground mt-1">
                    1 {currency} = {Number(latest.rate).toFixed(4)} MYR
                  </div>
                ) : (
                  <div className="text-sm text-amber-600 mt-1">No rate configured</div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Exchange Rate History</CardTitle>
          <CardDescription>
            Rates are matched to orders by effective date. The most recent rate at or before
            the order date is used.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ExchangeRateClient
            canEdit={canEdit}
            initialRates={rates.map((r) => ({
              id: r.id,
              fromCurrency: r.fromCurrency,
              toCurrency: r.toCurrency,
              rate: r.rate.toString(),
              effectiveDate: r.effectiveDate.toISOString(),
              source: r.source,
              createdAt: r.createdAt.toISOString(),
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
