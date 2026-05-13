"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Package } from "lucide-react";
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
  costPerUnitMyr: number;
  binLocation: string;
};

export function StockInFormClient({ locations }: { locations: Location[] }) {
  const router = useRouter();
  const [locationId, setLocationId] = useState(locations[0]?.id || "");
  const [supplierName, setSupplierName] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [productionDate, setProductionDate] = useState("");
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
      return [...prev, { variant: v, quantity: 1, costPerUnitMyr: 0, binLocation: "" }];
    });
  };

  const updateLine = (idx: number, patch: Partial<Line>) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };

  const removeLine = (idx: number) => {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const totalUnits = lines.reduce((s, l) => s + l.quantity, 0);
  const totalCost = lines.reduce((s, l) => s + l.quantity * l.costPerUnitMyr, 0);

  const canSubmit =
    locationId &&
    lines.length > 0 &&
    lines.every((l) => l.quantity > 0 && l.costPerUnitMyr >= 0);

  const handleSubmit = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch("/api/v1/stock-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationId,
          supplierName: supplierName || undefined,
          referenceNumber: referenceNumber || undefined,
          productionDate: productionDate || undefined,
          notes: notes || undefined,
          items: lines.map((l) => ({
            productVariantId: l.variant.id,
            quantity: l.quantity,
            costPerUnitMyr: l.costPerUnitMyr,
            binLocation: l.binLocation || undefined,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error?.message || "Failed to receive stock" });
        return;
      }
      setMessage({
        type: "success",
        text: `Received ${data.meta.totalUnits} units across ${data.meta.itemsReceived} items.`,
      });
      setLines([]);
      setSupplierName("");
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
              : "rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive"
          }
        >
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="location">Destination Location *</Label>
          <Select value={locationId} onValueChange={setLocationId}>
            <SelectTrigger id="location">
              <SelectValue placeholder="Select location" />
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
          <Label htmlFor="productionDate">Production / Received Date</Label>
          <Input
            id="productionDate"
            type="date"
            value={productionDate}
            onChange={(e) => setProductionDate(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="supplier">Supplier</Label>
          <Input
            id="supplier"
            value={supplierName}
            onChange={(e) => setSupplierName(e.target.value)}
            placeholder="e.g. Guangzhou Textiles Co."
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ref">Reference / PO Number</Label>
          <Input
            id="ref"
            value={referenceNumber}
            onChange={(e) => setReferenceNumber(e.target.value)}
            placeholder="e.g. PO-2025-0042"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Notes</Label>
        <Textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional notes for this receipt"
        />
      </div>

      <div>
        <Label className="mb-2 block">Add Items *</Label>
        <VariantPicker onSelect={addLine} excludeIds={lines.map((l) => l.variant.id)} />
      </div>

      <BulkVariantAdder onAdd={addLine} excludeIds={lines.map((l) => l.variant.id)} />

      {lines.length === 0 ? (
        <div className="border rounded-lg py-12 text-center text-muted-foreground">
          <Package className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Search and add items above to start a receipt.</p>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Product / Variant</TableHead>
                <TableHead className="w-28">Quantity</TableHead>
                <TableHead className="w-32">Cost/Unit (MYR)</TableHead>
                <TableHead className="w-32">Bin</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
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
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      value={l.costPerUnitMyr}
                      onChange={(e) =>
                        updateLine(idx, { costPerUnitMyr: Number(e.target.value) || 0 })
                      }
                      className="w-28"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={l.binLocation}
                      onChange={(e) => updateLine(idx, { binLocation: e.target.value })}
                      placeholder="e.g. A-3-05"
                      className="w-28"
                    />
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium">
                    RM {(l.quantity * l.costPerUnitMyr).toFixed(2)}
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

          <div className="flex justify-between items-center px-4 py-3 border-t bg-muted/30">
            <div className="text-sm text-muted-foreground">
              {lines.length} line items · {totalUnits.toLocaleString()} units
            </div>
            <div className="text-sm font-semibold">
              Total: RM {totalCost.toFixed(2)}
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button onClick={handleSubmit} disabled={!canSubmit || loading} size="lg">
          {loading ? "Recording..." : "Receive Stock"}
        </Button>
      </div>
    </div>
  );
}
