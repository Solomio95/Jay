"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, Settings2, AlertTriangle, XCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

type Location = { id: string; name: string; type: string };

type Row = {
  id: string;
  quantityOnHand: number;
  quantityReserved: number;
  reorderPoint: number;
  reorderQuantity: number;
  binLocation: string | null;
  productVariantId: string;
  sku: string;
  size: string;
  color: string;
  colorHex: string | null;
  productName: string;
  productSkuPrefix: string;
  locationId: string;
  locationName: string;
  locationType: string;
};

type Props = {
  locations: Location[];
  rows: Row[];
  initialSearch: string;
  initialLocationId: string;
  initialFilter: string;
  page: number;
  totalPages: number;
  totalRows: number;
};

export function StockLevelsClient({
  locations,
  rows,
  initialSearch,
  initialLocationId,
  initialFilter,
  page,
  totalPages,
  totalRows,
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [search, setSearch] = useState(initialSearch);
  const [reorderDialog, setReorderDialog] = useState<Row | null>(null);
  const [reorderForm, setReorderForm] = useState({ reorderPoint: 0, reorderQuantity: 0, binLocation: "" });
  const [saving, setSaving] = useState(false);

  const applyParams = (updates: Record<string, string | undefined>) => {
    const params = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(updates)) {
      if (!v) params.delete(k);
      else params.set(k, v);
    }
    // reset page on filter change
    if (!("page" in updates)) params.delete("page");
    startTransition(() => router.push(`/inventory/stock?${params.toString()}`));
  };

  const openReorder = (row: Row) => {
    setReorderDialog(row);
    setReorderForm({
      reorderPoint: row.reorderPoint,
      reorderQuantity: row.reorderQuantity,
      binLocation: row.binLocation || "",
    });
  };

  const saveReorder = async () => {
    if (!reorderDialog) return;
    setSaving(true);
    const res = await fetch("/api/v1/stock-levels", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productVariantId: reorderDialog.productVariantId,
        locationId: reorderDialog.locationId,
        reorderPoint: reorderForm.reorderPoint,
        reorderQuantity: reorderForm.reorderQuantity,
        binLocation: reorderForm.binLocation || undefined,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setReorderDialog(null);
      router.refresh();
    }
  };

  const rowStatus = (r: Row) => {
    if (r.quantityOnHand <= 0) return { label: "Out", variant: "destructive" as const, icon: <XCircle className="h-3 w-3" /> };
    if (r.reorderPoint > 0 && r.quantityOnHand <= r.reorderPoint)
      return { label: "Low", variant: "warning" as const, icon: <AlertTriangle className="h-3 w-3" /> };
    return { label: "OK", variant: "success" as const, icon: null };
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search SKU or product..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") applyParams({ search: search || undefined });
            }}
            className="pl-9"
          />
        </div>

        <Select
          value={initialLocationId || "all"}
          onValueChange={(v) => applyParams({ locationId: v === "all" ? undefined : v })}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All locations</SelectItem>
            {locations.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {l.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={initialFilter}
          onValueChange={(v) => applyParams({ filter: v === "all" ? undefined : v })}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stock</SelectItem>
            <SelectItem value="low">Low stock</SelectItem>
            <SelectItem value="out">Out of stock</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU / Product</TableHead>
              <TableHead>Variant</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Bin</TableHead>
              <TableHead className="text-right">On Hand</TableHead>
              <TableHead className="text-right">Reserved</TableHead>
              <TableHead className="text-right">Reorder Pt</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  No stock records found.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => {
                const status = rowStatus(r);
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-mono text-xs">{r.sku}</div>
                      <div className="text-xs text-muted-foreground">{r.productName}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-xs">
                        <span
                          className="inline-block h-3 w-3 rounded-full ring-1 ring-border"
                          style={{ backgroundColor: r.colorHex || "#999" }}
                        />
                        <span>{r.color}</span>
                        <span className="text-muted-foreground">·</span>
                        <span className="font-medium">{r.size}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">{r.locationName}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {r.binLocation || "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {r.quantityOnHand.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {r.quantityReserved > 0 ? r.quantityReserved.toLocaleString() : "—"}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {r.reorderPoint > 0 ? r.reorderPoint : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={status.variant} className="text-xs gap-1">
                        {status.icon}
                        {status.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" onClick={() => openReorder(r)} title="Reorder settings">
                        <Settings2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {totalRows > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div>
            Showing {(page - 1) * 50 + 1}–{Math.min(page * 50, totalRows)} of {totalRows}
          </div>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => applyParams({ page: String(page - 1) })}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => applyParams({ page: String(page + 1) })}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <Dialog open={!!reorderDialog} onOpenChange={(o) => !o && setReorderDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reorder settings</DialogTitle>
          </DialogHeader>
          {reorderDialog && (
            <div className="space-y-4">
              <div className="text-sm">
                <div className="font-mono">{reorderDialog.sku}</div>
                <div className="text-muted-foreground">
                  {reorderDialog.productName} · {reorderDialog.locationName}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="rp">Reorder point</Label>
                  <Input
                    id="rp"
                    type="number"
                    min={0}
                    value={reorderForm.reorderPoint}
                    onChange={(e) =>
                      setReorderForm({ ...reorderForm, reorderPoint: Number(e.target.value) || 0 })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rq">Reorder qty</Label>
                  <Input
                    id="rq"
                    type="number"
                    min={0}
                    value={reorderForm.reorderQuantity}
                    onChange={(e) =>
                      setReorderForm({ ...reorderForm, reorderQuantity: Number(e.target.value) || 0 })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bin">Bin location</Label>
                <Input
                  id="bin"
                  value={reorderForm.binLocation}
                  onChange={(e) => setReorderForm({ ...reorderForm, binLocation: e.target.value })}
                  placeholder="e.g. A-3-05"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReorderDialog(null)}>Cancel</Button>
            <Button onClick={saveReorder} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
