"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type OrderItem = {
  id: string;
  quantity: number;
  returnedQuantity: number;
  returnableQuantity: number;
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

type PromoterOrder = {
  id: string;
  orderNumber: string;
  createdAt: string;
  location: { name: string } | null;
  customer: { name: string; phone: string | null } | null;
  totalAmount: number;
  items: OrderItem[];
};

export default function PromoterReturnsPage() {
  const [search, setSearch] = useState("");
  const [orders, setOrders] = useState<PromoterOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<PromoterOrder | null>(null);
  const [returnDrafts, setReturnDrafts] = useState<Record<string, { quantity: number; reason: string }>>({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function searchOrders() {
    setLoading(true);
    setMessage("");
    const params = new URLSearchParams({ limit: "10" });
    if (search.trim()) params.set("search", search.trim());
    const response = await fetch(`/api/v1/promoter/sales?${params.toString()}`);
    const json = await response.json();
    if (!response.ok) {
      setMessage(json.error?.message ?? "Unable to search sales.");
      setLoading(false);
      return;
    }
    setOrders(json.data ?? []);
    setSelectedOrder(null);
    setLoading(false);
  }

  async function submitReturn(orderItemId: string) {
    if (!selectedOrder) return;
    const draft = returnDrafts[orderItemId] ?? { quantity: 1, reason: "Customer return" };
    const quantity = Number(draft.quantity);
    if (!quantity || quantity < 1) return;
    setMessage("");
    const response = await fetch("/api/v1/promoter/returns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: selectedOrder.id,
        orderItemId,
        quantity,
        reason: draft.reason,
      }),
    });
    const json = await response.json();
    setMessage(response.ok ? "Return submitted." : json.error?.message ?? "Return failed.");
    if (response.ok) {
      setOrders((current) =>
        current.map((order) =>
          order.id === selectedOrder.id
            ? applyReturnedQuantity(order, orderItemId, quantity)
            : order,
        ),
      );
      setSelectedOrder((current) =>
        current ? applyReturnedQuantity(current, orderItemId, quantity) : current,
      );
      setReturnDrafts((current) => ({
        ...current,
        [orderItemId]: { quantity: 1, reason: "Customer return" },
      }));
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Promoter Returns</h2>
        <p className="text-sm text-muted-foreground">Returns must link to an original sale.</p>
      </div>
      <div className="flex gap-2">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void searchOrders();
          }}
          placeholder="Search order number, SKU, product, or customer"
        />
        <Button type="button" onClick={searchOrders} disabled={loading}>
          Search
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {orders.map((order) => (
          <Button
            key={order.id}
            type="button"
            variant={selectedOrder?.id === order.id ? "default" : "outline"}
            onClick={() => setSelectedOrder(order)}
          >
            {order.orderNumber} / RM {order.totalAmount.toFixed(2)}
          </Button>
        ))}
      </div>
      {selectedOrder && (
        <section className="overflow-hidden rounded-md border bg-background">
          <div className="border-b bg-muted/50 px-3 py-2">
            <div className="font-semibold">{selectedOrder.orderNumber}</div>
            <div className="text-xs text-muted-foreground">
              {selectedOrder.location?.name ?? "-"} /{" "}
              {selectedOrder.customer?.name ?? "Walk-in"}
            </div>
          </div>
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="p-2">SKU</th>
                <th className="p-2">Item</th>
                <th className="p-2 text-right">Sold</th>
                <th className="p-2 text-right">Returned</th>
                <th className="p-2 text-right">Remaining</th>
                <th className="p-2 text-right">Qty</th>
                <th className="p-2">Reason</th>
                <th className="p-2 text-right">Return</th>
              </tr>
            </thead>
            <tbody>
              {selectedOrder.items.map((item) => {
                const draft = returnDrafts[item.id] ?? { quantity: 1, reason: "Customer return" };
                return (
                  <tr key={item.id} className="border-t">
                    <td className="p-2 font-medium">{item.productVariant.sku}</td>
                    <td className="p-2 text-muted-foreground">
                      {item.productVariant.product.name} / {item.productVariant.color} / {item.productVariant.size}
                    </td>
                    <td className="p-2 text-right">{item.quantity}</td>
                    <td className="p-2 text-right">{item.returnedQuantity}</td>
                    <td className="p-2 text-right">{item.returnableQuantity}</td>
                    <td className="p-2 text-right">
                      <Input
                        className="ml-auto w-20 text-right"
                        type="number"
                        min={1}
                        max={item.returnableQuantity}
                        value={draft.quantity}
                        disabled={item.returnableQuantity <= 0}
                        onChange={(event) =>
                          setReturnDrafts((current) => ({
                            ...current,
                            [item.id]: {
                              ...draft,
                              quantity: Math.min(
                                item.returnableQuantity,
                                Math.max(1, Number(event.target.value)),
                              ),
                            },
                          }))
                        }
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        value={draft.reason}
                        disabled={item.returnableQuantity <= 0}
                        onChange={(event) =>
                          setReturnDrafts((current) => ({
                            ...current,
                            [item.id]: { ...draft, reason: event.target.value },
                          }))
                        }
                        placeholder="Reason"
                      />
                    </td>
                    <td className="p-2 text-right">
                      <Button
                        type="button"
                        size="sm"
                        disabled={item.returnableQuantity <= 0}
                        onClick={() => submitReturn(item.id)}
                      >
                        {item.returnableQuantity <= 0 ? "Returned" : "Return"}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
    </div>
  );
}

function applyReturnedQuantity(order: PromoterOrder, orderItemId: string, quantity: number) {
  return {
    ...order,
    items: order.items.map((item) => {
      if (item.id !== orderItemId) return item;
      const returnedQuantity = item.returnedQuantity + quantity;
      return {
        ...item,
        returnedQuantity,
        returnableQuantity: Math.max(0, item.quantity - returnedQuantity),
      };
    }),
  };
}
