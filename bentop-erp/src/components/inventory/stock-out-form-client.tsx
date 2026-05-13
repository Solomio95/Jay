"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, AlertCircle } from "lucide-react";
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
  quantity: number;
};

const REASONS: { value: string; label: string }[] = [
  { value: "DAMAGE", label: "Damaged" },
  { value: "LOSS", label: "Lost / Missing" },
  { value: "EXPIRED", label: "Expired" },
  { value: "SAMPLE", label: "Sample / Giveaway" },
  { value: "INTERNAL_USE", label: "Internal Use" },
  { value: "RETURN_TO_SUPPLIER", label: "Return to Supplier" },
  { value: "OTHER", label: "Other" },
];

export function StockOutFormClient({ locations }: { locations: Location[] }) {
  const router = useRouter();
  const [locationId, setLocationId] = useState(locations[0]?.id || "");
  const [reason, setReason] = useState("DAMAGE");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const addLine = (v: VariantOption) => {
    setLines((prev) => {
      const existing = prev.find((line) => line.variant.id === v.id);
      if (existing) {
        return prev.map((line) =>
          line.variant.id === v.id ? { ...line, quantity: line.quantity + 1 } : line
        );
      }
      return [...prev, { variant: v, quantity: 1 }];
    });
  };

  const updateLine = (idx: number, patch: Partial<Line>) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };

  const removeLine = (idx: number) => {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const totalUnits = lines.reduce((s, l) => s + l.quantity, 0);
  const canSubmit =
    locationId && reason && lines.length > 0 && lines.every((l) => l.quantity > 0);

  const handleSubmit = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch("/api/v1/stock-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationId,
          reason,
          referenceNumber: referenceNumber || undefined,
          notes: notes || undefined,
          items: lines.map((l) => ({
            productVariantId: l.variant.id,
            quantity: l.quantity,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error?.message || "Failed to deduct stock" });
        return;
      }
      setMessage({
        type: "success",
        text: `Deducted ${data.meta.totalUnits} units.`,
      });
      setLines([]);
      setReferenceNumber("");
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
              : "rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive flex items-start gap-2"
          }
        >
          {message.type === "error" && <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Source Location *</Label>
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
        <div className="space-y-2">
          <Label>Reference</Label>
          <Input
            value={referenceNumber}
            onChange={(e) => setReferenceNumber(e.target.value)}
            placeholder="e.g. incident-2025-04-11"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Notes</Label>
        <Textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Describe the circumstances"
        />
      </div>

      <div>
        <Label className="mb-2 block">Add Items *</Label>
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
                <TableHead className="w-28">Quantity</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((l, idx) => (
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
                  <TableCell>
                    <Input
                      type="number"
                      min={1}
                      value={l.quantity}
                      onChange={(e) => updateLine(idx, { quantity: Number(e.target.value) || 0 })}
                      className="w-24"
                    />
                  </TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" onClick={() => removeLine(idx)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex justify-between items-center px-4 py-3 border-t bg-muted/30 text-sm">
            <span className="text-muted-foreground">{lines.length} items</span>
            <span className="font-semibold">Total: {totalUnits.toLocaleString()} units</span>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={handleSubmit} disabled={!canSubmit || loading} size="lg" variant="destructive">
          {loading ? "Processing..." : "Deduct Stock"}
        </Button>
      </div>
    </div>
  );
}
