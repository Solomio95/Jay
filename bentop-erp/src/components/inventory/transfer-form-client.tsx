"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, ArrowRight } from "lucide-react";
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

type Location = { id: string; name: string; type: string };

type Line = {
  variant: VariantOption;
  quantity: number;
  availableAtSource: number;
};

export function TransferFormClient({ locations }: { locations: Location[] }) {
  const router = useRouter();
  const [fromLocationId, setFromLocationId] = useState(locations[0]?.id || "");
  const [toLocationId, setToLocationId] = useState(locations[1]?.id || "");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
    setLines((prev) => [...prev, { variant: v, quantity: 1, availableAtSource }]);
  };

  const updateLine = (idx: number, patch: Partial<Line>) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };

  const removeLine = (idx: number) => {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const overAllocated = lines.some((l) => l.quantity > l.availableAtSource);
  const canSubmit =
    fromLocationId &&
    toLocationId &&
    fromLocationId !== toLocationId &&
    lines.length > 0 &&
    lines.every((l) => l.quantity > 0) &&
    !overAllocated;

  const handleSubmit = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/v1/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromLocationId,
          toLocationId,
          notes: notes || undefined,
          items: lines.map((l) => ({ productVariantId: l.variant.id, quantity: l.quantity })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message || "Failed to create transfer");
        return;
      }
      router.push(`/inventory/transfers/${data.data.id}`);
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
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {locations.map((l) => (
                <SelectItem key={l.id} value={l.id} disabled={l.id === toLocationId}>
                  {l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-center pb-2">
          <ArrowRight className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <Label>To *</Label>
          <Select value={toLocationId} onValueChange={setToLocationId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {locations.map((l) => (
                <SelectItem key={l.id} value={l.id} disabled={l.id === fromLocationId}>
                  {l.name}
                </SelectItem>
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
          placeholder="Optional notes for this transfer"
        />
      </div>

      <div>
        <Label className="mb-2 block">Items to Transfer *</Label>
        <VariantPicker onSelect={addLine} excludeIds={lines.map((l) => l.variant.id)} />
      </div>

      {lines.length > 0 && (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Product / Variant</TableHead>
                <TableHead className="text-right">Available</TableHead>
                <TableHead className="w-28">Quantity</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((l, idx) => {
                const over = l.quantity > l.availableAtSource;
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
                        max={l.availableAtSource}
                        value={l.quantity}
                        onChange={(e) => updateLine(idx, { quantity: Number(e.target.value) || 0 })}
                        className={`w-24 ${over ? "border-destructive" : ""}`}
                      />
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
          One or more lines request more than is available at the source location.
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={handleSubmit} disabled={!canSubmit || loading} size="lg">
          {loading ? "Submitting..." : "Submit Request"}
        </Button>
      </div>
    </div>
  );
}
