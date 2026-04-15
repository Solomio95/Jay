"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Minus, Trash2, ShoppingCart, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { VariantPicker, type VariantOption } from "@/components/inventory/variant-picker";
import { formatCurrency } from "@/lib/utils";

type Location = { id: string; name: string; type: string };
type Channel = { id: string; name: string };

type CartLine = {
  variant: VariantOption;
  quantity: number;
  unitPrice: number;
  availableForSale: number;
};

type Props = {
  locations: Location[];
  channels: Channel[];
};

export function POSClient({ locations, channels }: Props) {
  const router = useRouter();
  const defaultLocation = locations.find((l) => l.type === "RETAIL_STORE") ?? locations[0];
  const [locationId, setLocationId] = useState(defaultLocation?.id ?? "");
  const [salesChannelId, setSalesChannelId] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [paymentReference, setPaymentReference] = useState("");
  const [amountTendered, setAmountTendered] = useState("");
  const [discountAmount, setDiscountAmount] = useState("0");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [successOrder, setSuccessOrder] = useState<{ id: string; orderNumber: string; total: number } | null>(null);

  const addItem = async (v: VariantOption) => {
    if (!locationId) {
      setError("Select a location first");
      return;
    }
    // If already in cart, increment
    const existingIdx = cart.findIndex((c) => c.variant.id === v.id);
    if (existingIdx >= 0) {
      setCart((prev) =>
        prev.map((c, i) => (i === existingIdx ? { ...c, quantity: c.quantity + 1 } : c))
      );
      return;
    }
    const stockRes = await fetch(
      `/api/v1/stock-levels?productVariantId=${v.id}&locationId=${locationId}&pageSize=5`
    );
    let availableForSale = 0;
    if (stockRes.ok) {
      const data = await stockRes.json();
      const aggregate = data.data.find(
        (row: { batchId: string | null; quantityOnHand: number; quantityReserved: number }) =>
          row.batchId === null
      );
      availableForSale = aggregate ? aggregate.quantityOnHand - aggregate.quantityReserved : 0;
    }
    setCart((prev) => [
      ...prev,
      { variant: v, quantity: 1, unitPrice: 0, availableForSale },
    ]);
  };

  const incQty = (idx: number) =>
    setCart((prev) => prev.map((c, i) => (i === idx ? { ...c, quantity: c.quantity + 1 } : c)));
  const decQty = (idx: number) =>
    setCart((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, quantity: Math.max(1, c.quantity - 1) } : c))
    );
  const removeLine = (idx: number) => setCart((prev) => prev.filter((_, i) => i !== idx));
  const setQty = (idx: number, q: number) =>
    setCart((prev) => prev.map((c, i) => (i === idx ? { ...c, quantity: Math.max(1, q) } : c)));
  const setPrice = (idx: number, p: number) =>
    setCart((prev) => prev.map((c, i) => (i === idx ? { ...c, unitPrice: Math.max(0, p) } : c)));

  const subtotal = cart.reduce((s, c) => s + c.quantity * c.unitPrice, 0);
  const discount = Number(discountAmount) || 0;
  const total = Math.max(0, subtotal - discount);
  const tendered = Number(amountTendered) || 0;
  const change = paymentMethod === "Cash" ? Math.max(0, tendered - total) : 0;
  const overAllocated = cart.some((c) => c.quantity > c.availableForSale);
  const canCheckout = cart.length > 0 && cart.every((c) => c.quantity > 0 && c.unitPrice >= 0) && !overAllocated;

  const handleCheckout = async () => {
    setLoading(true);
    setError("");

    const payload = {
      customerId: null,
      salesChannelId: salesChannelId || null,
      locationId,
      currency: "MYR",
      exchangeRateToMyr: 1,
      discountAmount: discount,
      taxAmount: 0,
      shippingAmount: 0,
      paymentStatus: tendered >= total ? "PAID" : "UNPAID",
      paymentMethod,
      paymentReference: paymentReference || undefined,
      confirm: true,
      items: cart.map((c) => ({
        productVariantId: c.variant.id,
        quantity: c.quantity,
        unitPrice: c.unitPrice,
        discountAmount: 0,
      })),
    };

    try {
      const createRes = await fetch("/api/v1/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const created = await createRes.json();
      if (!createRes.ok) {
        setError(created.error?.message || "Failed to create order");
        return;
      }
      // Immediately advance CONFIRMED → PROCESSING (deduct stock)
      const procRes = await fetch(`/api/v1/orders/${created.data.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toStatus: "PROCESSING", reason: "POS checkout" }),
      });
      if (!procRes.ok) {
        const procErr = await procRes.json();
        setError(procErr.error?.message || "Order created but stock deduction failed. See order detail.");
        router.push(`/sales/orders/${created.data.id}`);
        return;
      }
      // Advance to DELIVERED for immediate in-store handoff
      await fetch(`/api/v1/orders/${created.data.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toStatus: "PACKED", reason: "POS checkout" }),
      });
      await fetch(`/api/v1/orders/${created.data.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toStatus: "SHIPPED", reason: "POS checkout" }),
      });
      await fetch(`/api/v1/orders/${created.data.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toStatus: "DELIVERED", reason: "POS checkout - handed to customer" }),
      });

      setSuccessOrder({
        id: created.data.id,
        orderNumber: created.data.orderNumber,
        total,
      });
      setConfirmOpen(false);
      // Reset cart
      setCart([]);
      setAmountTendered("");
      setPaymentReference("");
      setDiscountAmount("0");
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      {/* Left: Product picker */}
      <div className="lg:col-span-3 space-y-4">
        <div className="border rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="pos-location" className="text-xs">Location</Label>
              <Select value={locationId} onValueChange={setLocationId}>
                <SelectTrigger id="pos-location">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="pos-channel" className="text-xs">Sales Channel</Label>
              <Select
                value={salesChannelId || "NONE"}
                onValueChange={(v) => setSalesChannelId(v === "NONE" ? "" : v)}
              >
                <SelectTrigger id="pos-channel">
                  <SelectValue placeholder="Direct" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">Direct (in-store)</SelectItem>
                  {channels.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs">Scan barcode or search product</Label>
            <VariantPicker
              onSelect={addItem}
              placeholder="Scan barcode, search by SKU or name..."
            />
          </div>
        </div>

        {/* Cart */}
        <div className="border rounded-lg min-h-[400px]">
          {cart.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground text-sm">
              <ShoppingCart className="mx-auto h-10 w-10 mb-2 opacity-40" />
              Cart is empty. Scan or search a product to begin.
            </div>
          ) : (
            <div className="divide-y">
              {cart.map((c, idx) => {
                const over = c.quantity > c.availableForSale;
                return (
                  <div key={c.variant.id} className="flex items-center gap-3 p-3">
                    <span
                      className="inline-block h-6 w-6 rounded-full ring-1 ring-border flex-shrink-0"
                      style={{ backgroundColor: c.variant.colorHex || "#999" }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{c.variant.productName}</div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {c.variant.sku} · {c.variant.color} · {c.variant.size}
                      </div>
                      {over && (
                        <div className="text-xs text-destructive">
                          Only {c.availableForSale} available
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="outline" onClick={() => decQty(idx)}>
                        <Minus className="h-3 w-3" />
                      </Button>
                      <Input
                        type="number"
                        value={c.quantity}
                        onChange={(e) => setQty(idx, parseInt(e.target.value || "1", 10))}
                        className="w-14 text-center"
                      />
                      <Button size="icon" variant="outline" onClick={() => incQty(idx)}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="w-28">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={c.unitPrice}
                        onChange={(e) => setPrice(idx, Number(e.target.value) || 0)}
                        placeholder="Price"
                      />
                    </div>
                    <div className="w-24 text-right font-medium text-sm">
                      {formatCurrency(c.quantity * c.unitPrice, "MYR")}
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => removeLine(idx)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right: Payment + checkout */}
      <div className="lg:col-span-2 space-y-4">
        <div className="border rounded-lg p-4 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Items</span>
            <span>{cart.reduce((s, c) => s + c.quantity, 0)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatCurrency(subtotal, "MYR")}</span>
          </div>
          <div className="flex justify-between text-sm items-center">
            <span className="text-muted-foreground">Discount (MYR)</span>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={discountAmount}
              onChange={(e) => setDiscountAmount(e.target.value)}
              className="w-28 text-right"
            />
          </div>
          <div className="flex justify-between font-semibold text-lg pt-2 border-t">
            <span>Total</span>
            <span>{formatCurrency(total, "MYR")}</span>
          </div>
        </div>

        <div className="border rounded-lg p-4 space-y-3">
          <Label className="text-sm font-semibold">Payment</Label>
          <div className="space-y-2">
            <Label htmlFor="pos-method" className="text-xs">Method</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger id="pos-method">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Cash">Cash</SelectItem>
                <SelectItem value="Card">Card</SelectItem>
                <SelectItem value="QR">QR / E-wallet</SelectItem>
                <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {paymentMethod === "Cash" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="pos-tendered" className="text-xs">Amount tendered</Label>
                <Input
                  id="pos-tendered"
                  type="number"
                  min="0"
                  step="0.01"
                  value={amountTendered}
                  onChange={(e) => setAmountTendered(e.target.value)}
                />
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Change</span>
                <span className="font-medium">{formatCurrency(change, "MYR")}</span>
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="pos-ref" className="text-xs">Reference / Transaction ID</Label>
              <Input
                id="pos-ref"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
              />
            </div>
          )}
        </div>

        <Button
          size="lg"
          className="w-full h-14 text-base"
          onClick={() => setConfirmOpen(true)}
          disabled={!canCheckout}
        >
          <CheckCircle2 className="h-5 w-5 mr-2" />
          Checkout {cart.length > 0 && `· ${formatCurrency(total, "MYR")}`}
        </Button>
        {overAllocated && (
          <p className="text-xs text-destructive text-center">
            One or more items exceed available stock.
          </p>
        )}
        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}
      </div>

      {/* Confirm dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm sale</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Items</span>
              <span>{cart.reduce((s, c) => s + c.quantity, 0)} units</span>
            </div>
            <div className="flex justify-between text-base font-semibold">
              <span>Total</span>
              <span>{formatCurrency(total, "MYR")}</span>
            </div>
            <div className="flex justify-between">
              <span>Payment</span>
              <span>{paymentMethod}</span>
            </div>
            {paymentMethod === "Cash" && tendered >= total && (
              <div className="flex justify-between text-green-700">
                <span>Change due</span>
                <span>{formatCurrency(change, "MYR")}</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleCheckout} disabled={loading}>
              {loading ? "Processing..." : "Complete sale"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success */}
      <Dialog open={successOrder !== null} onOpenChange={(o) => !o && setSuccessOrder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
              Sale complete
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Order number</span>
              <span className="font-mono">{successOrder?.orderNumber}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>Total</span>
              <span>{formatCurrency(successOrder?.total ?? 0, "MYR")}</span>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                if (successOrder) router.push(`/sales/orders/${successOrder.id}`);
              }}
            >
              View order
            </Button>
            <Button onClick={() => setSuccessOrder(null)}>New sale</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
