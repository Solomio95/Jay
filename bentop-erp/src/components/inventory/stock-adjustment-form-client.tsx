"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
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
import { VariantPicker, type VariantOption } from "./variant-picker";
import { BulkVariantAdder } from "./bulk-variant-adder";

type Location = { id: string; name: string; type: string };

type Line = {
  variant: VariantOption;
  currentQty: number;
  newQty: number;
};

const REASONS: { value: string; label: string }[] = [
  { value: "CYCLE_COUNT", label: "Cycle Count" },
  { value: "PHYSICAL_COUNT", label: "Physical Count" },
  { value: "FOUND_STOCK", label: "Found Stock" },
  { value: "SYSTEM_ERROR_CORRECTION", label: "System Error Correction" },
  { value: "DATA_ENTRY_ERROR", label: "Data Entry Error" },
  { value: "OTHER", label: "Other" },
];

export function StockAdjustmentFormClient({ locations }: { locations: Location[] }) {
  const router = useRouter();
  const [locationId, setLocationId] = useState(locations[0]?.id || "");
  const [reason, setReason] = useState("CYCLE_COUNT");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // When adding a variant, fetch current qty at this location
  const addLine = async (v: VariantOption) => {
    if (!locationId) return;
    if (lines.some((line) => line.variant.id === v.id)) return;
    const res = await fetch(
      `/api/v1/stock-levels?productVariantId=${v.id}&locationId=${locationId}&pageSize=5`
    );
    let currentQty = 0;
    if (res.ok) {
      const data = await res.json();
      const aggregate = data.data.find(
        (row: { batchId: string | null; quantityOnHand: number }) => row.batchId === null
      );
      currentQty = aggregate?.quantityOnHand ?? 0;
    }
    setLines((prev) => [...prev, { variant: v, currentQty, newQty: currentQty }]);
  };

  // If location changes, refresh current quantities
  useEffect(() => {
    if (lines.length === 0 || !locationId) return;
    (async () => {
      const updated = await Promise.all(
        lines.map(async (l) => {
          const res = await fetch(
            `/api/v1/stock-levels?productVariantId=${l.variant.id}&locationId=${locationId}&pageSize=5`
          );
          let currentQty = 0;
          if (res.ok) {
            const data = await res.json();
            const aggregate = data.data.find(
              (row: { batchId: string | null; quantityOnHand: number }) => row.batchId === null
            );
            currentQty = aggregate?.quantityOnHand ?? 0;
          }
          return { ...l, currentQty, newQty: currentQty };
        })
      );
      setLines(updated);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const updateLine = (idx: number, patch: Partial<Line>) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };

  const removeLine = (idx: number) => {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const changes = lines.filter((l) => l.newQty !== l.currentQty);

  const handleSubmit = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch("/api/v1/stock-adjustments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationId,
          reason,
          notes: notes || undefined,
          items: changes.map((l) => ({
            productVariantId: l.variant.id,
            newQuantity: l.newQty,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error?.message || "Failed to apply adjustments" });
        return;
      }
      setMessage({
        type: "success",
        text: `Applied ${data.meta.itemsAdjusted} adjustments.`,
      });
      setLines([]);
      setNotes("");
      router.refresh();
    } catch {
      setMessage({ type: "error", text: "Network error — please try again" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {message && (
        <div
          className={
            message.type === "success"
              ? "rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800"
              : "rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive"
          }
        >
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Location *</Label>
          <Select value={locationId} onValueChange={setLocationId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {locations.map((l) => (
                <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Reason *</Label>
          <Select value={reason} onValueChange={setReason}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {REASONS.map((r) => (
                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Notes</Label>
        <Textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Monthly cycle count — aisle A3"
        />
      </div>

      <div>
        <Label className="mb-2 block">Add Items</Label>
        <VariantPicker onSelect={addLine} excludeIds={lines.map((l) => l.variant.id)} />
      </div>

      <BulkVariantAdder onAdd={addLine} excludeIds={lines.map((l) => l.variant.id)} />

      {lines.length > 0 && (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Product / Variant</TableHead>
                <TableHead className="text-right">Current</TableHead>
                <TableHead className="w-32">New Qty *</TableHead>
                <TableHead className="text-right">Delta</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((l, idx) => {
                const delta = l.newQty - l.currentQty;
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
                    <TableCell className="text-right text-muted-foreground">{l.currentQty}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        value={l.newQty}
                        onChange={(e) => updateLine(idx, { newQty: Number(e.target.value) || 0 })}
                        className="w-28"
                      />
                    </TableCell>
                    <TableCell
                      className={`text-right text-sm font-medium ${
                        delta > 0 ? "text-green-600" : delta < 0 ? "text-destructive" : "text-muted-foreground"
                      }`}
                    >
                      {delta > 0 ? `+${delta}` : delta}
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
          <div className="flex justify-between items-center px-4 py-3 border-t bg-muted/30 text-sm">
            <span className="text-muted-foreground">
              {changes.length} of {lines.length} will be adjusted
            </span>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={handleSubmit} disabled={changes.length === 0 || loading} size="lg">
          {loading ? "Applying..." : "Apply Adjustments"}
        </Button>
      </div>
    </div>
  );
}
