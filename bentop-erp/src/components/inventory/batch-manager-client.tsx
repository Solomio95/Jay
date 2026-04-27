"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

type BatchRow = {
  id: string;
  batchNumber: string;
  quantityProduced: number;
  productionDate: string;
  expiryDate: string | null;
  supplierName: string | null;
  costPerUnitMyr: string;
  notes: string | null;
  productVariant: {
    sku: string;
    size: string;
    color: string;
    product: { name: string };
  };
  _count: { stockLevels: number; movements: number };
};

type VariantOption = {
  id: string;
  sku: string;
  size: string;
  color: string;
  product: { name: string };
};

type Props = {
  initialBatches: BatchRow[];
  variants: VariantOption[];
  canEdit: boolean;
};

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "numeric" });
}

export function BatchManagerClient({ initialBatches, variants, canEdit }: Props) {
  const router = useRouter();
  const [batches, setBatches] = useState(initialBatches);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    productVariantId: "",
    batchNumber: "",
    quantityProduced: "",
    productionDate: new Date().toISOString().slice(0, 10),
    expiryDate: "",
    supplierName: "",
    costPerUnitMyr: "",
    notes: "",
  });

  const filtered = batches.filter((b) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      b.batchNumber.toLowerCase().includes(q) ||
      b.productVariant.product.name.toLowerCase().includes(q) ||
      b.productVariant.sku.toLowerCase().includes(q) ||
      (b.supplierName ?? "").toLowerCase().includes(q)
    );
  });

  async function handleCreate() {
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/v1/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productVariantId: form.productVariantId,
          batchNumber: form.batchNumber,
          quantityProduced: parseInt(form.quantityProduced, 10),
          productionDate: new Date(form.productionDate).toISOString(),
          expiryDate: form.expiryDate ? new Date(form.expiryDate).toISOString() : undefined,
          supplierName: form.supplierName || undefined,
          costPerUnitMyr: parseFloat(form.costPerUnitMyr),
          notes: form.notes || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error?.message ?? "Failed to create batch");
        return;
      }
      setShowCreate(false);
      setForm({
        productVariantId: "", batchNumber: "", quantityProduced: "",
        productionDate: new Date().toISOString().slice(0, 10),
        expiryDate: "", supplierName: "", costPerUnitMyr: "", notes: "",
      });
      router.refresh();
      const updated = await fetch("/api/v1/batches?limit=200").then((r) => r.json());
      if (updated.data) setBatches(updated.data);
    } finally {
      setSaving(false);
    }
  }

  const isExpired = (d: string | null) => d ? new Date(d) < new Date() : false;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative sm:max-w-xs w-full">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input
            placeholder="Search batches…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
            aria-label="Search batches"
          />
        </div>
        {canEdit && (
          <div className="sm:ml-auto">
            <Button onClick={() => { setShowCreate(true); setError(""); }}>
              <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
              New Batch
            </Button>
          </div>
        )}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Batch #</TableHead>
              <TableHead>Product / SKU</TableHead>
              <TableHead className="text-right">Qty Produced</TableHead>
              <TableHead className="hidden sm:table-cell">Production Date</TableHead>
              <TableHead className="hidden md:table-cell">Expiry</TableHead>
              <TableHead className="hidden lg:table-cell">Cost/Unit</TableHead>
              <TableHead className="hidden lg:table-cell">Supplier</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                  No batches found
                </TableCell>
              </TableRow>
            )}
            {filtered.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="font-mono text-sm font-medium">{b.batchNumber}</TableCell>
                <TableCell>
                  <p className="text-sm font-medium">{b.productVariant.product.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{b.productVariant.sku} · {b.productVariant.color} {b.productVariant.size}</p>
                </TableCell>
                <TableCell className="text-right font-medium">{b.quantityProduced.toLocaleString()}</TableCell>
                <TableCell className="hidden sm:table-cell text-sm">{fmt(b.productionDate)}</TableCell>
                <TableCell className="hidden md:table-cell text-sm">
                  {b.expiryDate ? (
                    <Badge variant={isExpired(b.expiryDate) ? "destructive" : "secondary"}>
                      {fmt(b.expiryDate)}
                    </Badge>
                  ) : "—"}
                </TableCell>
                <TableCell className="hidden lg:table-cell text-sm">
                  RM {Number(b.costPerUnitMyr).toFixed(2)}
                </TableCell>
                <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                  {b.supplierName ?? "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Production Batch</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="grid gap-2">
              <Label htmlFor="b-variant">Product Variant *</Label>
              <select
                id="b-variant"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                value={form.productVariantId}
                onChange={(e) => setForm((p) => ({ ...p, productVariantId: e.target.value }))}
              >
                <option value="">Select a variant…</option>
                {variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.product.name} — {v.sku} ({v.color} {v.size})
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="b-num">Batch Number *</Label>
                <Input id="b-num" value={form.batchNumber} onChange={(e) => setForm((p) => ({ ...p, batchNumber: e.target.value }))} placeholder="e.g. BTH-2024-001" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="b-qty">Qty Produced *</Label>
                <Input id="b-qty" type="number" min="1" value={form.quantityProduced} onChange={(e) => setForm((p) => ({ ...p, quantityProduced: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="b-prod">Production Date *</Label>
                <Input id="b-prod" type="date" value={form.productionDate} onChange={(e) => setForm((p) => ({ ...p, productionDate: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="b-exp">Expiry Date</Label>
                <Input id="b-exp" type="date" value={form.expiryDate} onChange={(e) => setForm((p) => ({ ...p, expiryDate: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="b-cost">Cost/Unit (MYR) *</Label>
                <Input id="b-cost" type="number" min="0" step="0.01" value={form.costPerUnitMyr} onChange={(e) => setForm((p) => ({ ...p, costPerUnitMyr: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="b-sup">Supplier</Label>
                <Input id="b-sup" value={form.supplierName} onChange={(e) => setForm((p) => ({ ...p, supplierName: e.target.value }))} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="b-notes">Notes</Label>
              <Input id="b-notes" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button
              onClick={handleCreate}
              disabled={saving || !form.productVariantId || !form.batchNumber || !form.quantityProduced || !form.costPerUnitMyr}
            >
              {saving ? "Creating…" : "Create Batch"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
