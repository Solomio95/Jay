"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { VariantPicker, type VariantOption } from "@/components/inventory/variant-picker";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/utils";

type SupplierOption = {
  id: string;
  name: string;
  code: string | null;
  paymentTermsDays: number | null;
};

type PurchaseLine = {
  productVariantId: string;
  sku: string;
  productName: string;
  color: string;
  size: string;
  quantityOrdered: number;
  costPerUnitMyr: number;
  notes: string;
};

type Props = {
  suppliers: SupplierOption[];
};

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

export function PurchaseOrderFormClient({ suppliers }: Props) {
  const router = useRouter();
  const [supplierId, setSupplierId] = useState("");
  const [orderDate, setOrderDate] = useState(todayInputValue());
  const [expectedDate, setExpectedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<PurchaseLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const totals = useMemo(() => {
    return lines.reduce(
      (sum, line) => {
        sum.units += Number(line.quantityOrdered) || 0;
        sum.value += (Number(line.quantityOrdered) || 0) * (Number(line.costPerUnitMyr) || 0);
        return sum;
      },
      { units: 0, value: 0 }
    );
  }, [lines]);

  const addVariant = (variant: VariantOption) => {
    setLines((current) => {
      const existing = current.find((line) => line.productVariantId === variant.id);
      if (existing) {
        return current.map((line) =>
          line.productVariantId === variant.id
            ? { ...line, quantityOrdered: line.quantityOrdered + 1 }
            : line
        );
      }

      return [
        ...current,
        {
          productVariantId: variant.id,
          sku: variant.sku,
          productName: variant.productName,
          color: variant.color,
          size: variant.size,
          quantityOrdered: 1,
          costPerUnitMyr: 0,
          notes: "",
        },
      ];
    });
  };

  const updateLine = (productVariantId: string, patch: Partial<PurchaseLine>) => {
    setLines((current) =>
      current.map((line) => (line.productVariantId === productVariantId ? { ...line, ...patch } : line))
    );
  };

  const removeLine = (productVariantId: string) => {
    setLines((current) => current.filter((line) => line.productVariantId !== productVariantId));
  };

  const submit = async () => {
    setError(null);

    if (!supplierId) {
      setError("Please select a supplier.");
      return;
    }

    if (lines.length === 0) {
      setError("Please add at least one product variant.");
      return;
    }

    const invalidLine = lines.find((line) => line.quantityOrdered <= 0 || line.costPerUnitMyr < 0);
    if (invalidLine) {
      setError("Quantity must be above zero and cost cannot be negative.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/v1/purchase-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId,
          orderDate: orderDate || undefined,
          expectedDate: expectedDate || undefined,
          notes: notes.trim() || undefined,
          items: lines.map((line) => ({
            productVariantId: line.productVariantId,
            quantityOrdered: Number(line.quantityOrdered),
            costPerUnitMyr: Number(line.costPerUnitMyr),
            notes: line.notes.trim() || undefined,
          })),
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error?.message || "Unable to create purchase order.");
      }

      router.push(`/purchases/orders/${payload.data.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create purchase order.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2 md:col-span-2">
          <Label>Supplier</Label>
          <Select value={supplierId} onValueChange={setSupplierId}>
            <SelectTrigger>
              <SelectValue placeholder="Select supplier" />
            </SelectTrigger>
            <SelectContent>
              {suppliers.map((supplier) => (
                <SelectItem key={supplier.id} value={supplier.id}>
                  {supplier.name}
                  {supplier.code ? ` (${supplier.code})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Order Date</Label>
          <Input type="date" value={orderDate} onChange={(event) => setOrderDate(event.target.value)} />
        </div>

        <div className="space-y-2">
          <Label>Expected Date</Label>
          <Input type="date" value={expectedDate} onChange={(event) => setExpectedDate(event.target.value)} />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label>Notes</Label>
          <Textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Optional supplier notes, delivery instruction, or quotation reference."
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div className="flex-1 space-y-2">
            <Label>Add Product Variant</Label>
            <VariantPicker
              onSelect={addVariant}
              excludeIds={lines.map((line) => line.productVariantId)}
              placeholder="Search SKU, barcode, or product name..."
            />
          </div>
          <div className="hidden rounded-md border px-4 py-2 text-sm md:block">
            <div className="text-muted-foreground">Order total</div>
            <div className="font-semibold">{formatCurrency(totals.value, "MYR")}</div>
          </div>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Variant</TableHead>
                <TableHead className="w-28">Qty</TableHead>
                <TableHead className="w-36">Cost / Unit</TableHead>
                <TableHead className="w-36">Line Total</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((line) => (
                <TableRow key={line.productVariantId}>
                  <TableCell>
                    <div className="font-medium">{line.productName}</div>
                    <div className="text-xs text-muted-foreground">
                      {line.sku} | {line.color} | {line.size}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="1"
                      step="1"
                      value={line.quantityOrdered}
                      onChange={(event) =>
                        updateLine(line.productVariantId, {
                          quantityOrdered: Math.max(1, Number(event.target.value) || 1),
                        })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.costPerUnitMyr}
                      onChange={(event) =>
                        updateLine(line.productVariantId, {
                          costPerUnitMyr: Math.max(0, Number(event.target.value) || 0),
                        })
                      }
                    />
                  </TableCell>
                  <TableCell>{formatCurrency(line.quantityOrdered * line.costPerUnitMyr, "MYR")}</TableCell>
                  <TableCell>
                    <Input
                      value={line.notes}
                      onChange={(event) => updateLine(line.productVariantId, { notes: event.target.value })}
                      placeholder="Optional"
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeLine(line.productVariantId)}
                      aria-label={`Remove ${line.sku}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {lines.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    Search and add product variants to create a purchase order.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <div className="text-sm text-muted-foreground">
          {totals.units.toLocaleString()} units | {formatCurrency(totals.value, "MYR")}
        </div>
        <div className="flex items-center gap-3">
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="button" onClick={submit} disabled={saving || !supplierId || lines.length === 0}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Create Purchase Order
          </Button>
        </div>
      </div>
    </div>
  );
}
