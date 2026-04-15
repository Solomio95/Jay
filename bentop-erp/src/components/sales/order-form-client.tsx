"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { VariantPicker, type VariantOption } from "@/components/inventory/variant-picker";
import { formatCurrency } from "@/lib/utils";

type Location = { id: string; name: string; type: string };
type Channel = { id: string; name: string; type: string };

type CustomerOption = {
  id: string;
  name: string;
  email: string | null;
  companyName: string | null;
  customerType: string;
};

type Line = {
  variant: VariantOption;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  availableForSale: number;
};

type Currency = "MYR" | "USD" | "RMB";
type DiscountType = "FIXED" | "PERCENTAGE";

type Props = {
  locations: Location[];
  channels: Channel[];
  defaultCustomerId?: string;
  defaultCustomer?: CustomerOption | null;
};

export function OrderFormClient({ locations, channels, defaultCustomerId, defaultCustomer }: Props) {
  const router = useRouter();
  const [customerId, setCustomerId] = useState<string | null>(defaultCustomerId ?? null);
  const [customer, setCustomer] = useState<CustomerOption | null>(defaultCustomer ?? null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerResults, setCustomerResults] = useState<CustomerOption[]>([]);
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const customerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [salesChannelId, setSalesChannelId] = useState<string>("");
  const [locationId, setLocationId] = useState(locations[0]?.id || "");
  const [currency, setCurrency] = useState<Currency>("MYR");
  const [exchangeRate, setExchangeRate] = useState("1");
  const [discountAmount, setDiscountAmount] = useState("0");
  const [discountType, setDiscountType] = useState<DiscountType | "">("");
  const [taxAmount, setTaxAmount] = useState("0");
  const [shippingAmount, setShippingAmount] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<"UNPAID" | "PARTIAL" | "PAID">("UNPAID");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Customer search
  useEffect(() => {
    if (customerTimerRef.current) clearTimeout(customerTimerRef.current);
    if (!customerSearch.trim()) {
      customerTimerRef.current = setTimeout(() => setCustomerResults([]), 0);
      return;
    }
    customerTimerRef.current = setTimeout(async () => {
      const res = await fetch(`/api/v1/customers?search=${encodeURIComponent(customerSearch)}&limit=8`);
      if (res.ok) {
        const data = await res.json();
        setCustomerResults(data.data);
      }
    }, 200);
    return () => {
      if (customerTimerRef.current) clearTimeout(customerTimerRef.current);
    };
  }, [customerSearch]);

  const pickCustomer = (c: CustomerOption) => {
    setCustomer(c);
    setCustomerId(c.id);
    setCustomerSearch("");
    setCustomerResults([]);
    setCustomerDropdownOpen(false);
  };

  const clearCustomer = () => {
    setCustomer(null);
    setCustomerId(null);
  };

  const addLine = async (v: VariantOption) => {
    if (!locationId) return;
    const res = await fetch(
      `/api/v1/stock-levels?productVariantId=${v.id}&locationId=${locationId}&pageSize=5`
    );
    let availableForSale = 0;
    if (res.ok) {
      const data = await res.json();
      const aggregate = data.data.find(
        (row: { batchId: string | null; quantityOnHand: number; quantityReserved: number }) =>
          row.batchId === null
      );
      availableForSale = aggregate ? aggregate.quantityOnHand - aggregate.quantityReserved : 0;
    }
    setLines((prev) => [
      ...prev,
      { variant: v, quantity: 1, unitPrice: 0, discountAmount: 0, availableForSale },
    ]);
  };

  const updateLine = (idx: number, patch: Partial<Line>) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };

  const removeLine = (idx: number) => setLines((prev) => prev.filter((_, i) => i !== idx));

  const subtotal = lines.reduce((s, l) => s + Math.max(0, l.quantity * l.unitPrice - l.discountAmount), 0);
  const discountNum = Number(discountAmount) || 0;
  const orderDiscount = discountType === "PERCENTAGE" ? (subtotal * discountNum) / 100 : discountNum;
  const taxNum = Number(taxAmount) || 0;
  const shipNum = Number(shippingAmount) || 0;
  const total = Math.max(0, subtotal - orderDiscount + taxNum + shipNum);

  const overAllocated = lines.some((l) => l.quantity > l.availableForSale);
  const baseValid =
    !!locationId &&
    lines.length > 0 &&
    lines.every((l) => l.quantity > 0 && l.unitPrice >= 0);

  const handleSubmit = async (confirm: boolean) => {
    setLoading(true);
    setError("");

    if (confirm && overAllocated) {
      setError("Cannot confirm: one or more lines exceed available stock.");
      setLoading(false);
      return;
    }

    const payload = {
      customerId: customerId || null,
      salesChannelId: salesChannelId || null,
      locationId,
      currency,
      exchangeRateToMyr: Number(exchangeRate) || 1,
      discountAmount: discountNum,
      discountType: discountType || null,
      taxAmount: taxNum,
      shippingAmount: shipNum,
      paymentStatus,
      paymentMethod: paymentMethod || undefined,
      paymentReference: paymentReference || undefined,
      notes: notes || undefined,
      confirm,
      items: lines.map((l) => ({
        productVariantId: l.variant.id,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        discountAmount: l.discountAmount,
      })),
    };

    try {
      const res = await fetch("/api/v1/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message || "Failed to create order");
        return;
      }
      router.push(`/sales/orders/${data.data.id}`);
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left column: header */}
        <div className="lg:col-span-2 space-y-4">
          {/* Customer */}
          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Customer</Label>
              {customer && (
                <Button variant="ghost" size="sm" onClick={clearCustomer}>
                  <X className="h-3 w-3 mr-1" /> Clear
                </Button>
              )}
            </div>
            {customer ? (
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-medium">
                  {customer.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm">{customer.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {customer.companyName ? `${customer.companyName} · ` : ""}
                    {customer.email || "No email"} · {customer.customerType}
                  </div>
                </div>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={customerSearch}
                  onChange={(e) => {
                    setCustomerSearch(e.target.value);
                    setCustomerDropdownOpen(true);
                  }}
                  onFocus={() => setCustomerDropdownOpen(true)}
                  onBlur={() => setTimeout(() => setCustomerDropdownOpen(false), 150)}
                  placeholder="Search customer by name, email, phone, or leave blank for walk-in..."
                  className="pl-9"
                />
                {customerDropdownOpen && customerResults.length > 0 && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg max-h-64 overflow-y-auto">
                    {customerResults.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          pickCustomer(c);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-muted text-sm"
                      >
                        <div className="font-medium">{c.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {c.companyName ? `${c.companyName} · ` : ""}
                          {c.email || "No email"} · {c.customerType}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Items */}
          <div className="border rounded-lg p-4 space-y-3">
            <Label className="text-sm font-semibold">Items</Label>
            <VariantPicker onSelect={addLine} excludeIds={lines.map((l) => l.variant.id)} />

            {lines.length > 0 && (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead className="w-[90px]">Qty</TableHead>
                      <TableHead className="w-[120px]">Unit Price</TableHead>
                      <TableHead className="w-[110px]">Discount</TableHead>
                      <TableHead className="text-right">Line Total</TableHead>
                      <TableHead className="w-[40px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((l, idx) => {
                      const lineTotal = Math.max(0, l.quantity * l.unitPrice - l.discountAmount);
                      const over = l.quantity > l.availableForSale;
                      return (
                        <TableRow key={l.variant.id}>
                          <TableCell>
                            <div className="font-mono text-xs">{l.variant.sku}</div>
                            <div className="text-xs text-muted-foreground">
                              {l.variant.productName} · {l.variant.color} · {l.variant.size}
                            </div>
                            <div className={`text-[10px] mt-0.5 ${over ? "text-destructive" : "text-muted-foreground"}`}>
                              Available: {l.availableForSale}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="1"
                              value={l.quantity}
                              onChange={(e) => updateLine(idx, { quantity: parseInt(e.target.value || "0", 10) })}
                              className={over ? "border-destructive" : ""}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={l.unitPrice}
                              onChange={(e) => updateLine(idx, { unitPrice: Number(e.target.value) || 0 })}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={l.discountAmount}
                              onChange={(e) => updateLine(idx, { discountAmount: Number(e.target.value) || 0 })}
                            />
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(lineTotal, currency)}
                          </TableCell>
                          <TableCell>
                            <Button size="icon" variant="ghost" onClick={() => removeLine(idx)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="border rounded-lg p-4 space-y-3">
            <Label htmlFor="notes" className="text-sm font-semibold">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Customer-facing notes for this order"
            />
          </div>
        </div>

        {/* Right column: configuration + totals */}
        <div className="space-y-4">
          <div className="border rounded-lg p-4 space-y-3">
            <Label className="text-sm font-semibold">Fulfillment & Channel</Label>
            <div className="space-y-2">
              <Label htmlFor="location" className="text-xs">Fulfillment Location *</Label>
              <Select value={locationId} onValueChange={setLocationId}>
                <SelectTrigger id="location">
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
            <div className="space-y-2">
              <Label htmlFor="channel" className="text-xs">Sales Channel</Label>
              <Select value={salesChannelId || "NONE"} onValueChange={(v) => setSalesChannelId(v === "NONE" ? "" : v)}>
                <SelectTrigger id="channel">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">None (direct)</SelectItem>
                  {channels.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="border rounded-lg p-4 space-y-3">
            <Label className="text-sm font-semibold">Currency</Label>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label htmlFor="currency" className="text-xs">Currency</Label>
                <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
                  <SelectTrigger id="currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MYR">MYR</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="RMB">RMB</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="exchangeRate" className="text-xs">Rate → MYR</Label>
                <Input
                  id="exchangeRate"
                  type="number"
                  step="0.0001"
                  value={exchangeRate}
                  onChange={(e) => setExchangeRate(e.target.value)}
                  disabled={currency === "MYR"}
                />
              </div>
            </div>
          </div>

          <div className="border rounded-lg p-4 space-y-3">
            <Label className="text-sm font-semibold">Adjustments</Label>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label htmlFor="discountAmount" className="text-xs">Order Discount</Label>
                <Input
                  id="discountAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="discountType" className="text-xs">Type</Label>
                <Select
                  value={discountType || "NONE"}
                  onValueChange={(v) => setDiscountType(v === "NONE" ? "" : (v as DiscountType))}
                >
                  <SelectTrigger id="discountType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">None</SelectItem>
                    <SelectItem value="FIXED">Fixed</SelectItem>
                    <SelectItem value="PERCENTAGE">Percentage</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="taxAmount" className="text-xs">Tax</Label>
                <Input
                  id="taxAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={taxAmount}
                  onChange={(e) => setTaxAmount(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="shippingAmount" className="text-xs">Shipping</Label>
                <Input
                  id="shippingAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={shippingAmount}
                  onChange={(e) => setShippingAmount(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="border rounded-lg p-4 space-y-3">
            <Label className="text-sm font-semibold">Payment</Label>
            <div className="space-y-2">
              <Label htmlFor="paymentStatus" className="text-xs">Status</Label>
              <Select value={paymentStatus} onValueChange={(v) => setPaymentStatus(v as typeof paymentStatus)}>
                <SelectTrigger id="paymentStatus">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UNPAID">Unpaid</SelectItem>
                  <SelectItem value="PARTIAL">Partial</SelectItem>
                  <SelectItem value="PAID">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="paymentMethod" className="text-xs">Method</Label>
              <Input
                id="paymentMethod"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                placeholder="Cash, Bank Transfer, Card..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="paymentReference" className="text-xs">Reference</Label>
              <Input
                id="paymentReference"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder="Transaction ID or receipt number"
              />
            </div>
          </div>

          {/* Totals */}
          <div className="border rounded-lg p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatCurrency(subtotal, currency)}</span>
            </div>
            {orderDiscount > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Discount</span>
                <span className="text-destructive">−{formatCurrency(orderDiscount, currency)}</span>
              </div>
            )}
            {taxNum > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax</span>
                <span>{formatCurrency(taxNum, currency)}</span>
              </div>
            )}
            {shipNum > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shipping</span>
                <span>{formatCurrency(shipNum, currency)}</span>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t font-semibold">
              <span>Total</span>
              <span>{formatCurrency(total, currency)}</span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Button
              onClick={() => handleSubmit(true)}
              disabled={!baseValid || overAllocated || loading}
              className="w-full"
            >
              {loading ? "Creating..." : "Confirm Order"}
            </Button>
            <Button
              variant="outline"
              onClick={() => handleSubmit(false)}
              disabled={!baseValid || loading}
              className="w-full"
            >
              Save as Draft
            </Button>
            {overAllocated && (
              <p className="text-xs text-destructive">
                One or more lines exceed available stock. Reduce quantities or save as draft.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
