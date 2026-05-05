"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type SalesHistoryItem = {
  id: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  notes: string | null;
  productVariant: {
    sku: string;
    color: string;
    size: string;
    product: { name: string; skuPrefix: string };
  };
};

type SalesHistoryOrder = {
  id: string;
  orderNumber: string;
  createdAt: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string | null;
  location: { name: string } | null;
  customer: { name: string; phone: string | null } | null;
  totalAmount: number;
  quantity: number;
  items: SalesHistoryItem[];
};

export default function PromoterSalesHistoryPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [orders, setOrders] = useState<SalesHistoryOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const totals = useMemo(
    () => ({
      sales: orders.reduce((sum, order) => sum + order.totalAmount, 0),
      quantity: orders.reduce((sum, order) => sum + order.quantity, 0),
    }),
    [orders],
  );

  useEffect(() => {
    void loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadHistory() {
    setLoading(true);
    setMessage("");
    const params = new URLSearchParams({ limit: "100" });
    if (search.trim()) params.set("search", search.trim());
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);

    try {
      const response = await fetch(`/api/v1/promoter/sales?${params.toString()}`);
      const json = await response.json();
      if (!response.ok) {
        setMessage(json.error?.message ?? "Unable to load sales history.");
        return;
      }
      setOrders(json.data ?? []);
    } catch {
      setMessage("Unable to load sales history.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Sales History</h2>
          <p className="text-sm text-muted-foreground">Submitted sales for your promoter account.</p>
        </div>
        <Button asChild>
          <Link href="/promoter/sales/new">
            <Plus className="mr-2 h-4 w-4" />
            New Sale
          </Link>
        </Button>
      </div>

      <section className="grid gap-3 rounded-md border bg-background p-3 md:grid-cols-[1fr_160px_160px_auto]">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void loadHistory();
          }}
          placeholder="Search order, customer, SKU, product, or location"
        />
        <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
        <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
        <Button type="button" onClick={loadHistory} disabled={loading}>
          <Search className="mr-2 h-4 w-4" />
          Search
        </Button>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <SummaryStat label="Orders" value={orders.length.toString()} />
        <SummaryStat label="Quantity" value={totals.quantity.toString()} />
        <SummaryStat label="Sales" value={`RM ${totals.sales.toFixed(2)}`} />
      </section>

      {message && <p className="text-sm text-muted-foreground">{message}</p>}

      <section className="overflow-hidden rounded-md border bg-background">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left text-muted-foreground">
            <tr>
              <th className="p-2">Order</th>
              <th className="p-2">Location / Customer</th>
              <th className="p-2">Items</th>
              <th className="p-2 text-right">Qty</th>
              <th className="p-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} className="border-t align-top">
                <td className="p-2">
                  <div className="font-medium">{order.orderNumber}</div>
                  <div className="text-xs text-muted-foreground">{formatDateTime(order.createdAt)}</div>
                  <div className="text-xs text-muted-foreground">{order.paymentMethod ?? "Consignment Partner"}</div>
                </td>
                <td className="p-2">
                  <div>{order.location?.name ?? "-"}</div>
                  <div className="text-xs text-muted-foreground">
                    {order.customer ? `${order.customer.name}${order.customer.phone ? ` / ${order.customer.phone}` : ""}` : "Walk-in"}
                  </div>
                </td>
                <td className="p-2">
                  <div className="space-y-1">
                    {order.items.map((item) => (
                      <div key={item.id}>
                        <span className="font-medium">{item.productVariant.sku}</span>
                        <span className="text-muted-foreground">
                          {" "}
                          {item.productVariant.product.name} / {item.productVariant.color} / {item.productVariant.size}
                        </span>
                        <span className="text-muted-foreground">
                          {" "}
                          x{item.quantity} @ RM {item.unitPrice.toFixed(2)}
                        </span>
                        {item.notes && <span className="text-emerald-700"> Promo</span>}
                      </div>
                    ))}
                  </div>
                </td>
                <td className="p-2 text-right">{order.quantity}</td>
                <td className="p-2 text-right font-semibold">RM {order.totalAmount.toFixed(2)}</td>
              </tr>
            ))}
            {!loading && orders.length === 0 && (
              <tr>
                <td className="p-6 text-center text-muted-foreground" colSpan={5}>
                  No sales found.
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td className="p-6 text-center text-muted-foreground" colSpan={5}>
                  Loading sales...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-background p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-MY", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
