"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2 } from "lucide-react";
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
import { formatDate } from "@/lib/utils";

type ExchangeRateRow = {
  id: string;
  fromCurrency: string;
  toCurrency: string;
  rate: string;
  effectiveDate: string;
  source: string | null;
  createdAt: string;
};

type Props = {
  canEdit: boolean;
  initialRates: ExchangeRateRow[];
};

const CURRENCIES = ["MYR", "USD", "RMB"] as const;

export function ExchangeRateClient({ canEdit, initialRates }: Props) {
  const router = useRouter();
  const [rates, setRates] = useState<ExchangeRateRow[]>(initialRates);
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Form state
  const [fromCurrency, setFromCurrency] = useState<string>("USD");
  const [toCurrency, setToCurrency] = useState<string>("MYR");
  const [rate, setRate] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [source, setSource] = useState("");

  const resetForm = () => {
    setFromCurrency("USD");
    setToCurrency("MYR");
    setRate("");
    setEffectiveDate(new Date().toISOString().slice(0, 10));
    setSource("");
    setError("");
  };

  const openCreate = () => {
    resetForm();
    setEditId(null);
    setShowCreate(true);
  };

  const openEdit = (r: ExchangeRateRow) => {
    setFromCurrency(r.fromCurrency);
    setToCurrency(r.toCurrency);
    setRate(r.rate);
    setEffectiveDate(r.effectiveDate.slice(0, 10));
    setSource(r.source ?? "");
    setError("");
    setEditId(r.id);
    setShowCreate(true);
  };

  const closeDialog = () => {
    setShowCreate(false);
    setEditId(null);
    resetForm();
  };

  const handleSave = async () => {
    setLoading(true);
    setError("");
    try {
      const url = editId
        ? `/api/v1/exchange-rates/${editId}`
        : "/api/v1/exchange-rates";
      const method = editId ? "PATCH" : "POST";
      const body = editId
        ? { rate: Number(rate), effectiveDate, source: source || undefined }
        : {
            fromCurrency,
            toCurrency,
            rate: Number(rate),
            effectiveDate,
            source: source || undefined,
          };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message || "Failed to save");
        return;
      }
      closeDialog();
      router.refresh();
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this exchange rate entry?")) return;
    try {
      const res = await fetch(`/api/v1/exchange-rates/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error?.message || "Failed to delete");
        return;
      }
      router.refresh();
    } catch {
      alert("Network error");
    }
  };

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex justify-end">
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add Rate
          </Button>
        </div>
      )}

      {rates.length === 0 ? (
        <div className="text-center text-sm text-muted-foreground py-8">
          No exchange rates configured. Add a rate to enable multi-currency orders.
        </div>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pair</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead>Effective Date</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Created</TableHead>
                {canEdit && <TableHead className="w-20"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rates.map((r, idx) => {
                const isLatest =
                  idx === 0 ||
                  rates[idx - 1].fromCurrency !== r.fromCurrency ||
                  rates[idx - 1].toCurrency !== r.toCurrency;
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      <span className="font-medium">{r.fromCurrency}</span>
                      <span className="text-muted-foreground mx-1">→</span>
                      <span className="font-medium">{r.toCurrency}</span>
                      {isLatest && (
                        <Badge variant="success" className="ml-2 text-xs">
                          Latest
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {Number(r.rate).toFixed(4)}
                    </TableCell>
                    <TableCell className="text-sm">{formatDate(r.effectiveDate)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.source || "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(r.createdAt)}
                    </TableCell>
                    {canEdit && (
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openEdit(r)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => handleDelete(r.id)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Exchange Rate" : "Add Exchange Rate"}</DialogTitle>
          </DialogHeader>
          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          <div className="space-y-4">
            {!editId && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>From Currency</Label>
                  <Select value={fromCurrency} onValueChange={setFromCurrency}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c} value={c} disabled={c === toCurrency}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>To Currency</Label>
                  <Select value={toCurrency} onValueChange={setToCurrency}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c} value={c} disabled={c === fromCurrency}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label>
                Rate (1 {editId ? rates.find((r) => r.id === editId)?.fromCurrency : fromCurrency} ={" "}
                ? {editId ? rates.find((r) => r.id === editId)?.toCurrency : toCurrency})
              </Label>
              <Input
                type="number"
                step="0.000001"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                placeholder="e.g. 4.7200"
              />
            </div>
            <div className="space-y-2">
              <Label>Effective Date</Label>
              <Input
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Source (optional)</Label>
              <Input
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="e.g. Bank Negara, XE.com"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={loading || !rate}>
              {loading ? "Saving..." : editId ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
