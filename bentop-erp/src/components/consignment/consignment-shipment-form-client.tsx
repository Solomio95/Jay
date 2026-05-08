"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, ArrowRight, Send, Save } from "lucide-react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { VariantPicker, type VariantOption } from "@/components/inventory/variant-picker";
import { formatCurrency } from "@/lib/utils";

type Location = { id: string; name: string; type: string };
type PartnerTier = {
  id: string;
  name: string;
  minPrice: number;
  maxPrice: number | null;
  commissionRate: number;
  sortOrder: number;
};
type Partner = {
  id: string;
  name: string;
  contactPerson: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  locationId: string | null;
  commissionTiers: PartnerTier[];
};

type Line = {
  variant: VariantOption;
  quantity: number;
  unitPrice: number;
  availableAtSource: number;
};

type ProductSummaryLine = {
  variant: Pick<VariantOption, "productId" | "productName">;
  quantity: number;
  unitPrice: number;
};

export function buildProductShipmentSummary(lines: ProductSummaryLine[]) {
  const summary = new Map<
    string,
    { productId: string; productName: string; quantity: number; value: number }
  >();

  for (const line of lines) {
    const existing = summary.get(line.variant.productId) ?? {
      productId: line.variant.productId,
      productName: line.variant.productName,
      quantity: 0,
      value: 0,
    };
    existing.quantity += line.quantity;
    existing.value += line.quantity * line.unitPrice;
    summary.set(line.variant.productId, existing);
  }

  return Array.from(summary.values());
}

export function buildPartnerSelectionState(
  partner: Pick<Partner, "id" | "name" | "locationId">,
  currentToLocationId: string,
) {
  return {
    partnerId: partner.id,
    partnerName: partner.name,
    toLocationId: partner.locationId ?? currentToLocationId,
    isConsigneeLocked: partner.locationId !== null,
  };
}

export function ConsignmentShipmentFormClient({
  locations,
  partners,
}: {
  locations: Location[];
  partners: Partner[];
}) {
  const router = useRouter();

  const sourceLocations = locations.filter((l) => l.type !== "CONSIGNMENT");
  const consigneeLocations = locations.filter((l) => l.type === "CONSIGNMENT");

  const [fromLocationId, setFromLocationId] = useState(sourceLocations[0]?.id || "");
  const [toLocationId, setToLocationId] = useState(consigneeLocations[0]?.id || "");
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [partnerName, setPartnerName] = useState("");
  const [partnerContact, setPartnerContact] = useState("");
  const [commissionRate, setCommissionRate] = useState("0");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const selectedPartner = partners.find((p) => p.id === partnerId) ?? null;
  const isConsigneeLocked = selectedPartner?.locationId != null;

  const addLine = async (v: VariantOption) => {
    if (!fromLocationId) return;
    const res = await fetch(
      `/api/v1/stock-levels?productVariantId=${v.id}&locationId=${fromLocationId}&pageSize=5`
    );
    let availableAtSource = 0;
    if (res.ok) {
      const data = await res.json();
      const aggregate = data.data.find(
        (row: { batchId: string | null; quantityOnHand: number; quantityReserved: number }) =>
          row.batchId === null
      );
      availableAtSource = aggregate ? aggregate.quantityOnHand - aggregate.quantityReserved : 0;
    }
    setLines((prev) => [...prev, { variant: v, quantity: 1, unitPrice: 0, availableAtSource }]);
  };

  const updateLine = (idx: number, patch: Partial<Line>) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };

  const removeLine = (idx: number) => {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const subtotal = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  const productSummary = buildProductShipmentSummary(lines);
  const overAllocated = lines.some((l) => l.quantity > l.availableAtSource);
  const baseValid =
    fromLocationId &&
    toLocationId &&
    fromLocationId !== toLocationId &&
    (partnerId || partnerName.trim().length > 0) &&
    lines.length > 0 &&
    lines.every((l) => l.quantity > 0 && l.unitPrice >= 0);
  const canShip = baseValid && !overAllocated;
  const canDraft = baseValid;

  const selectPartner = (value: string) => {
    if (value === "_manual") {
      setPartnerId(null);
      return;
    }

    const partner = partners.find((p) => p.id === value);
    if (!partner) return;

    const next = buildPartnerSelectionState(partner, toLocationId);
    setPartnerId(next.partnerId);
    setPartnerName(next.partnerName);
    setToLocationId(next.toLocationId);
  };

  const submit = async (ship: boolean) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/v1/consignment/shipments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromLocationId,
          toLocationId,
          partnerId: partnerId || undefined,
          partnerName: partnerName.trim(),
          partnerContact: partnerContact.trim() || undefined,
          commissionRate: Number(commissionRate) || 0,
          notes: notes.trim() || undefined,
          ship,
          items: lines.map((l) => ({
            productVariantId: l.variant.id,
            quantityShipped: l.quantity,
            unitPrice: l.unitPrice,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message || "Failed to create shipment");
        return;
      }
      router.push(`/consignment/shipments/${data.data.id}`);
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-end">
        <div className="space-y-2">
          <Label>From *</Label>
          <Select value={fromLocationId} onValueChange={setFromLocationId}>
            <SelectTrigger><SelectValue placeholder="Source" /></SelectTrigger>
            <SelectContent>
              {sourceLocations.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name} <span className="text-muted-foreground ml-1">({l.type})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-center pb-2">
          <ArrowRight className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <Label>Consignee *</Label>
          <Select
            value={toLocationId}
            onValueChange={setToLocationId}
            disabled={isConsigneeLocked}
          >
            <SelectTrigger><SelectValue placeholder="Consignee location" /></SelectTrigger>
            <SelectContent>
              {consigneeLocations.length === 0 ? (
                <SelectItem value="_none" disabled>
                  No CONSIGNMENT locations defined
                </SelectItem>
              ) : (
                consigneeLocations.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Registered Partner</Label>
          <Select value={partnerId ?? "_manual"} onValueChange={selectPartner}>
            <SelectTrigger><SelectValue placeholder="Select partner" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_manual">Manual entry</SelectItem>
              {partners.map((partner) => (
                <SelectItem key={partner.id} value={partner.id}>
                  {partner.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Partner Name *</Label>
          <Input
            value={partnerName}
            onChange={(e) => setPartnerName(e.target.value)}
            placeholder="e.g. Boutique Seremban"
            disabled={partnerId !== null}
          />
        </div>
        <div className="space-y-2">
          <Label>Partner Contact</Label>
          <Input
            value={partnerContact}
            onChange={(e) => setPartnerContact(e.target.value)}
            placeholder="Phone or email"
          />
        </div>
        <div className="space-y-2">
          <Label>Commission (%)</Label>
          <Input
            type="number"
            min={0}
            max={100}
            step="0.01"
            value={commissionRate}
            onChange={(e) => setCommissionRate(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Notes</Label>
        <Textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional terms or partner instructions"
        />
      </div>

      <div>
        <Label className="mb-2 block">Items *</Label>
        <VariantPicker onSelect={addLine} excludeIds={lines.map((l) => l.variant.id)} />
      </div>

      {lines.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <div className="border-b bg-muted/30 px-4 py-3">
            <div className="text-sm font-medium">Product Summary</div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {productSummary.map((line) => (
                <TableRow key={line.productId}>
                  <TableCell className="font-medium">{line.productName}</TableCell>
                  <TableCell className="text-right">{line.quantity}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(line.value, "MYR")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="border-t bg-muted/30 px-4 py-3">
            <div className="text-sm font-medium">Shipment Lines</div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Product / Variant</TableHead>
                <TableHead className="text-right">Available</TableHead>
                <TableHead className="w-28">Qty</TableHead>
                <TableHead className="w-32">Unit Price</TableHead>
                <TableHead className="text-right">Line Total</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((l, idx) => {
                const over = l.quantity > l.availableAtSource;
                const lineTotal = l.quantity * l.unitPrice;
                return (
                  <TableRow key={l.variant.id}>
                    <TableCell className="font-mono text-xs">{l.variant.sku}</TableCell>
                    <TableCell>
                      <div className="text-sm">{l.variant.productName}</div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full ring-1 ring-border"
                          style={{ backgroundColor: l.variant.colorHex || "#999" }}
                        />
                        {l.variant.color} · {l.variant.size}
                      </div>
                    </TableCell>
                    <TableCell
                      className={`text-right text-sm ${
                        l.availableAtSource <= 0 ? "text-destructive" : "text-muted-foreground"
                      }`}
                    >
                      {l.availableAtSource}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={1}
                        value={l.quantity}
                        onChange={(e) =>
                          updateLine(idx, { quantity: Number(e.target.value) || 0 })
                        }
                        className={`w-24 ${over ? "border-destructive" : ""}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={l.unitPrice}
                        onChange={(e) =>
                          updateLine(idx, { unitPrice: Number(e.target.value) || 0 })
                        }
                        className="w-28"
                      />
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {formatCurrency(lineTotal, "MYR")}
                    </TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" onClick={() => removeLine(idx)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {overAllocated && (
        <div className="text-sm text-destructive">
          One or more lines request more than is available at the source location. You can still save as a DRAFT.
        </div>
      )}

      <div className="flex items-center justify-between border-t pt-4">
        <div>
          <div className="text-xs text-muted-foreground">Total shipment value</div>
          <div className="text-xl font-bold">{formatCurrency(subtotal, "MYR")}</div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => submit(false)}
            disabled={!canDraft || loading}
          >
            <Save className="h-4 w-4 mr-2" />
            Save as Draft
          </Button>
          <Button onClick={() => submit(true)} disabled={!canShip || loading} size="lg">
            <Send className="h-4 w-4 mr-2" />
            {loading ? "Creating..." : "Ship Now"}
          </Button>
        </div>
      </div>
    </div>
  );
}
