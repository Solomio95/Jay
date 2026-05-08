"use client";

import { useEffect, useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type StockRow = {
  variantId: string;
  sku: string;
  productName: string;
  parentSku: string;
  color: string;
  size: string;
  locationId: string;
  locationName: string;
  isCurrentLocation: boolean;
  available: number;
};

export default function PromoterStockPage() {
  const [locationId, setLocationId] = useState("");
  const [search, setSearch] = useState("");
  const [currentRows, setCurrentRows] = useState<StockRow[]>([]);
  const [otherRows, setOtherRows] = useState<StockRow[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/v1/promoter/context")
      .then((res) => res.json())
      .then((json) => setLocationId(json.data?.allowedLocations?.[0]?.id ?? ""));
  }, []);

  useEffect(() => {
    if (!locationId) return;
    const params = new URLSearchParams({ locationId });
    if (search) params.set("search", search);
    fetch(`/api/v1/promoter/stock?${params.toString()}`)
      .then((res) => res.json())
      .then((json) => {
        setCurrentRows(json.data?.currentLocationRows ?? []);
        setOtherRows(json.data?.otherLocationRows ?? []);
      });
  }, [locationId, search]);

  async function requestTransfer(row: StockRow) {
    const quantity = Number(window.prompt("Quantity to request?", "1"));
    if (!quantity || quantity < 1) return;
    const response = await fetch("/api/v1/promoter/transfers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fromLocationId: row.locationId,
        toLocationId: locationId,
        productVariantId: row.variantId,
        quantity,
      }),
    });
    const json = await response.json();
    setMessage(response.ok ? "Transfer requested." : json.error?.message ?? "Transfer failed.");
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Promoter Stock</h2>
        <p className="text-sm text-muted-foreground">Own location first, other locations view-only.</p>
      </div>
      <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search barcode, SKU, or product" />
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
      <StockTable title="Current Location" rows={currentRows} />
      <StockTable title="Other Locations" rows={otherRows} onRequest={requestTransfer} />
    </div>
  );
}

function StockTable({
  title,
  rows,
  onRequest,
}: {
  title: string;
  rows: StockRow[];
  onRequest?: (row: StockRow) => void;
}) {
  return (
    <section className="overflow-hidden rounded-md border bg-background">
      <div className="border-b bg-muted/50 px-3 py-2 font-semibold">{title}</div>
      <table className="w-full text-sm">
        <thead className="text-left text-muted-foreground">
          <tr>
            <th className="p-2">Parent</th>
            <th className="p-2">SKU</th>
            <th className="p-2">Location</th>
            <th className="p-2 text-right">Available</th>
            {onRequest && <th className="p-2 text-right">Request</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.variantId}-${row.locationId}`} className="border-t">
              <td className="p-2">{row.parentSku}</td>
              <td className="p-2">
                <div className="font-medium">{row.sku}</div>
                <div className="text-xs text-muted-foreground">
                  {row.productName} / {row.color} / {row.size}
                </div>
              </td>
              <td className="p-2">{row.locationName}</td>
              <td className="p-2 text-right">{row.available}</td>
              {onRequest && (
                <td className="p-2 text-right">
                  <Button type="button" size="icon" variant="outline" onClick={() => onRequest(row)} aria-label="Request transfer">
                    <ArrowLeftRight className="h-4 w-4" />
                  </Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
