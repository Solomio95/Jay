"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Mail, Pencil, Phone, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Supplier = {
  id: string;
  name: string;
  code: string | null;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  paymentTermsDays: number | null;
  notes: string | null;
  isActive: boolean;
  _count: { purchaseOrders: number };
};

type SupplierForm = {
  name: string;
  code: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  paymentTermsDays: string;
  notes: string;
  isActive: boolean;
};

const emptyForm: SupplierForm = {
  name: "",
  code: "",
  contactPerson: "",
  email: "",
  phone: "",
  address: "",
  paymentTermsDays: "0",
  notes: "",
  isActive: true,
};

export function SupplierManagerClient({ initialSuppliers }: { initialSuppliers: Supplier[] }) {
  const router = useRouter();
  const [suppliers] = useState(initialSuppliers);
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState<SupplierForm>(emptyForm);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const filteredSuppliers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return suppliers;
    return suppliers.filter((supplier) =>
      [supplier.name, supplier.code, supplier.contactPerson, supplier.email, supplier.phone]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)),
    );
  }, [query, suppliers]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setDialogOpen(true);
  }

  function openEdit(supplier: Supplier) {
    setEditing(supplier);
    setForm({
      name: supplier.name,
      code: supplier.code ?? "",
      contactPerson: supplier.contactPerson ?? "",
      email: supplier.email ?? "",
      phone: supplier.phone ?? "",
      address: supplier.address ?? "",
      paymentTermsDays: String(supplier.paymentTermsDays ?? 0),
      notes: supplier.notes ?? "",
      isActive: supplier.isActive,
    });
    setError("");
    setDialogOpen(true);
  }

  async function submit() {
    setError("");
    if (!form.name.trim()) {
      setError("Supplier name is required");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim() || undefined,
        contactPerson: form.contactPerson.trim() || undefined,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        address: form.address.trim() || undefined,
        paymentTermsDays: form.paymentTermsDays ? Number(form.paymentTermsDays) : undefined,
        notes: form.notes.trim() || undefined,
        isActive: form.isActive,
      };

      const response = await fetch(editing ? `/api/v1/suppliers/${editing.id}` : "/api/v1/suppliers", {
        method: editing ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok) {
        setError(json?.error?.message ?? "Could not save supplier");
        return;
      }
      setDialogOpen(false);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search supplier, code, contact, phone, or email"
          className="max-w-md"
        />
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          New Supplier
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Terms</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">POs</TableHead>
              <TableHead className="w-24 text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSuppliers.map((supplier) => (
              <TableRow key={supplier.id}>
                <TableCell>
                  <div className="font-medium">{supplier.name}</div>
                  {supplier.address && <div className="text-xs text-muted-foreground">{supplier.address}</div>}
                </TableCell>
                <TableCell>{supplier.code || "-"}</TableCell>
                <TableCell>
                  <div>{supplier.contactPerson || "-"}</div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {supplier.phone && (
                      <span className="inline-flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {supplier.phone}
                      </span>
                    )}
                    {supplier.email && (
                      <span className="inline-flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {supplier.email}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>{supplier.paymentTermsDays ?? 0} days</TableCell>
                <TableCell>
                  <Badge variant={supplier.isActive ? "success" : "secondary"}>
                    {supplier.isActive ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">{supplier._count.purchaseOrders}</TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" onClick={() => openEdit(supplier)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {filteredSuppliers.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  No suppliers found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Supplier" : "New Supplier"}</DialogTitle>
            <DialogDescription>
              Supplier details are used when creating purchase orders and receiving stock.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            {error && (
              <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="supplierName">Supplier name</Label>
                <Input
                  id="supplierName"
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  placeholder="e.g. Guangzhou Textile Co."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplierCode">Code</Label>
                <Input
                  id="supplierCode"
                  value={form.code}
                  onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })}
                  placeholder="e.g. GZ-TEXTILE"
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="contactPerson">Contact person</Label>
                <Input
                  id="contactPerson"
                  value={form.contactPerson}
                  onChange={(event) => setForm({ ...form, contactPerson: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-[1fr_180px]">
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Textarea
                  id="address"
                  rows={2}
                  value={form.address}
                  onChange={(event) => setForm({ ...form, address: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="terms">Payment terms days</Label>
                <Input
                  id="terms"
                  type="number"
                  min="0"
                  max="365"
                  value={form.paymentTermsDays}
                  onChange={(event) => setForm({ ...form, paymentTermsDays: event.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                rows={2}
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
              />
            </div>

            {editing && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
                  className="h-4 w-4 rounded border"
                />
                Supplier active
              </label>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={loading}>
              <Building2 className="mr-2 h-4 w-4" />
              {loading ? "Saving..." : editing ? "Save Supplier" : "Create Supplier"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
