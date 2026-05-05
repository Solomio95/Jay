"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type OrderItem = {
  id: string;
  quantity: number;
  productVariant: {
    sku: string;
    color: string;
    size: string;
    product: { name: string };
  };
};

export default function PromoterReturnsPage() {
  const [search, setSearch] = useState("");
  const [orders, setOrders] = useState<Array<{ id: string; orderNumber: string }>>([]);
  const [selectedOrder, setSelectedOrder] = useState<{ id: string; orderNumber: string; items: OrderItem[] } | null>(null);
  const [message, setMessage] = useState("");

  async function searchOrders() {
    const response = await fetch(`/api/v1/orders?search=${encodeURIComponent(search)}&limit=10`);
    const json = await response.json();
    setOrders(json.data ?? []);
  }

  async function loadOrder(id: string) {
    const response = await fetch(`/api/v1/orders/${id}`);
    const json = await response.json();
    setSelectedOrder(json.data ?? null);
  }

  async function submitReturn(orderItemId: string) {
    if (!selectedOrder) return;
    const quantity = Number(window.prompt("Return quantity?", "1"));
    if (!quantity || quantity < 1) return;
    const reason = window.prompt("Reason?", "Customer return") ?? "";
    const response = await fetch("/api/v1/promoter/returns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: selectedOrder.id, orderItemId, quantity, reason }),
    });
    const json = await response.json();
    setMessage(response.ok ? "Return submitted." : json.error?.message ?? "Return failed.");
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Promoter Returns</h2>
        <p className="text-sm text-muted-foreground">Returns must link to an original sale.</p>
      </div>
      <div className="flex gap-2">
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search order number" />
        <Button type="button" onClick={searchOrders}>Search</Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {orders.map((order) => (
          <Button key={order.id} type="button" variant="outline" onClick={() => loadOrder(order.id)}>
            {order.orderNumber}
          </Button>
        ))}
      </div>
      {selectedOrder && (
        <section className="overflow-hidden rounded-md border bg-background">
          <div className="border-b bg-muted/50 px-3 py-2 font-semibold">{selectedOrder.orderNumber}</div>
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="p-2">SKU</th>
                <th className="p-2">Item</th>
                <th className="p-2 text-right">Sold</th>
                <th className="p-2 text-right">Return</th>
              </tr>
            </thead>
            <tbody>
              {selectedOrder.items.map((item) => (
                <tr key={item.id} className="border-t">
                  <td className="p-2 font-medium">{item.productVariant.sku}</td>
                  <td className="p-2 text-muted-foreground">
                    {item.productVariant.product.name} / {item.productVariant.color} / {item.productVariant.size}
                  </td>
                  <td className="p-2 text-right">{item.quantity}</td>
                  <td className="p-2 text-right">
                    <Button type="button" size="sm" onClick={() => submitReturn(item.id)}>Return</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
    </div>
  );
}
