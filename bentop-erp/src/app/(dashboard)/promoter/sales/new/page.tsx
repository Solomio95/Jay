"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, ScanLine, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  calculatePromoterSaleLinePrices,
  type PromotionCandidate,
} from "@/lib/promoter/promotions";
import { findScannedVariant } from "@/lib/barcode";

type LocationOption = { id: string; name: string; isDefault: boolean };
type StockRow = {
  productId: string;
  variantId: string;
  sku: string;
  barcode: string | null;
  productName: string;
  parentSku: string;
  color: string;
  size: string;
  sellingPriceMyr: number;
  available: number;
  isCurrentLocation: boolean;
};
type CartItem = StockRow & { quantity: number };

export default function PromoterNewSalePage() {
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [locationId, setLocationId] = useState("");
  const [search, setSearch] = useState("");
  const [stockRefreshKey, setStockRefreshKey] = useState(0);
  const [stock, setStock] = useState<StockRow[]>([]);
  const [promotions, setPromotions] = useState<PromotionCandidate[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerMode, setCustomerMode] = useState<"walk-in" | "registered">("walk-in");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/v1/promoter/context")
      .then((res) => res.json())
      .then((json) => {
        const allowed = json.data?.allowedLocations ?? [];
        setLocations(allowed);
        setLocationId(allowed[0]?.id ?? "");
      })
      .catch(() => setMessage("Unable to load promoter context."));
  }, []);

  useEffect(() => {
    if (!locationId) return;
    const params = new URLSearchParams({ locationId });
    if (search) params.set("search", search);
    fetch(`/api/v1/promoter/stock?${params.toString()}`)
      .then((res) => res.json())
      .then((json) => {
        setStock(json.data?.currentLocationRows ?? []);
        setPromotions(json.data?.promotions ?? []);
      })
      .catch(() => setMessage("Unable to load stock."));
  }, [locationId, search, stockRefreshKey]);

  const calculatedPrices = useMemo(
    () =>
      calculatePromoterSaleLinePrices({
        items: cart.map((item) => ({
          productVariantId: item.variantId,
          productId: item.productId,
          quantity: item.quantity,
          sellingPriceMyr: item.sellingPriceMyr,
        })),
        promotions,
      }),
    [cart, promotions],
  );
  const priceByVariant = useMemo(
    () => new Map(calculatedPrices.map((item) => [item.productVariantId, item])),
    [calculatedPrices],
  );
  const total = useMemo(
    () => calculatedPrices.reduce((sum, item) => sum + item.totalPrice, 0),
    [calculatedPrices],
  );
  const pendingQuantityByVariant = useMemo(() => {
    const quantities = new Map<string, number>();
    for (const item of cart) {
      quantities.set(item.variantId, (quantities.get(item.variantId) ?? 0) + item.quantity);
    }
    return quantities;
  }, [cart]);
  const displayStock = useMemo(
    () =>
      stock.map((row) => ({
        ...row,
        pendingQuantity: pendingQuantityByVariant.get(row.variantId) ?? 0,
        displayAvailable: Math.max(
          0,
          row.available - (pendingQuantityByVariant.get(row.variantId) ?? 0),
        ),
      })),
    [stock, pendingQuantityByVariant],
  );

  function addItem(row: StockRow) {
    setCart((current) => {
      const existing = current.find((item) => item.variantId === row.variantId);
      if (existing) {
        return current.map((item) =>
          item.variantId === row.variantId
            ? { ...item, quantity: Math.min(item.quantity + 1, item.available) }
            : item,
        );
      }
      return [...current, { ...row, quantity: 1 }];
    });
  }

  function addScannedItem() {
    setMessage("");
    const match = findScannedVariant(displayStock, search);
    if (!match) {
      setMessage("No exact SKU or barcode match found.");
      return;
    }
    if (match.displayAvailable <= 0) {
      setMessage("This item has no available stock at this location.");
      return;
    }
    addItem(match);
    setSearch("");
  }

  async function submitSale() {
    setMessage("");
    const response = await fetch("/api/v1/promoter/sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        locationId,
        customer:
          customerMode === "registered"
            ? { name: customerName, phone: customerPhone }
            : null,
        items: cart.map((item) => ({
          productVariantId: item.variantId,
          quantity: item.quantity,
        })),
      }),
    });
    const json = await response.json();
    if (!response.ok) {
      setMessage(json.error?.message ?? "Sale failed.");
      return;
    }
    setCart([]);
    setCustomerName("");
    setCustomerPhone("");
    setStockRefreshKey((current) => current + 1);
    setMessage(`Sale submitted: ${json.data.orderNumber}`);
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Promoter Sale</h2>
        <p className="text-sm text-muted-foreground">Today only, location locked by HQ setup.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <section className="space-y-3">
          {locations.length > 1 && (
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={locationId}
              onChange={(event) => setLocationId(event.target.value)}
            >
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          )}

          <div className="flex gap-2">
            <Input
              autoFocus
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addScannedItem();
                }
              }}
              placeholder="Scan barcode or search SKU"
            />
            <Button type="button" variant="outline" size="icon" aria-label="Scan" onClick={addScannedItem}>
              <ScanLine className="h-4 w-4" />
            </Button>
          </div>

          <div className="overflow-hidden rounded-md border bg-background">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-left">
                <tr>
                  <th className="p-2">SKU</th>
                  <th className="p-2">Item</th>
                  <th className="p-2 text-right">Price</th>
                  <th className="p-2 text-right">Stock</th>
                  <th className="p-2 text-right">Add</th>
                </tr>
              </thead>
              <tbody>
                {displayStock.slice(0, 30).map((row) => (
                  <tr key={row.variantId} className="border-t">
                    <td className="p-2 font-medium">{row.sku}</td>
                    <td className="p-2 text-muted-foreground">
                      {row.productName} / {row.color} / {row.size}
                    </td>
                    <td className="p-2 text-right">RM {row.sellingPriceMyr.toFixed(2)}</td>
                    <td className="p-2 text-right">
                      <div>{row.displayAvailable}</div>
                      {row.pendingQuantity > 0 && (
                        <div className="text-[11px] text-amber-600">
                          {row.pendingQuantity} pending
                        </div>
                      )}
                    </td>
                    <td className="p-2 text-right">
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        disabled={row.displayAvailable <= 0}
                        onClick={() => addItem(row)}
                        aria-label="Add item"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="space-y-3 rounded-md border bg-background p-3">
          <h3 className="font-semibold">Order</h3>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={customerMode === "walk-in" ? "default" : "outline"}
              onClick={() => setCustomerMode("walk-in")}
            >
              Walk-in
            </Button>
            <Button
              type="button"
              variant={customerMode === "registered" ? "default" : "outline"}
              onClick={() => setCustomerMode("registered")}
            >
              Register
            </Button>
          </div>
          {customerMode === "registered" && (
            <div className="space-y-2">
              <Input value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Customer name" />
              <Input value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} placeholder="Phone number" />
            </div>
          )}
          <div className="space-y-2">
            {cart.map((item) => (
              <div key={item.variantId} className="grid grid-cols-[1fr_64px_92px_36px] gap-2">
                <div className="min-w-0 text-sm">
                  <div className="truncate font-medium">{item.sku}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {item.productName}
                  </div>
                </div>
                <Input
                  type="number"
                  min={1}
                  max={item.available}
                  value={item.quantity}
                  onChange={(event) =>
                    setCart((current) =>
                      current.map((row) =>
                        row.variantId === item.variantId
                          ? {
                              ...row,
                              quantity: Math.min(
                                row.available,
                                Math.max(1, Number(event.target.value)),
                              ),
                            }
                          : row,
                      ),
                    )
                  }
                />
                <div className="rounded-md border bg-muted/40 px-2 py-1.5 text-right text-sm">
                  <div>RM {(priceByVariant.get(item.variantId)?.unitPrice ?? item.sellingPriceMyr).toFixed(2)}</div>
                  {priceByVariant.get(item.variantId)?.promotionId && (
                    <div className="text-[11px] text-emerald-700">Promo</div>
                  )}
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => setCart((current) => current.filter((row) => row.variantId !== item.variantId))}
                  aria-label="Remove item"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between border-t pt-3 font-semibold">
            <span>Total</span>
            <span>RM {total.toFixed(2)}</span>
          </div>
          <Button type="button" className="w-full" disabled={!cart.length || !locationId} onClick={submitSale}>
            Submit
          </Button>
          {message && <p className="text-sm text-muted-foreground">{message}</p>}
        </aside>
      </div>
    </div>
  );
}
