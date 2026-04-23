"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Pencil, Search, Mail, Phone, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";

type CustomerType = "RETAIL" | "WHOLESALE" | "CONSIGNMENT";

export type CustomerRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  companyName: string | null;
  customerType: CustomerType;
  creditLimitMyr: number | null;
  paymentTermsDays: number | null;
  isActive: boolean;
  orderCount: number;
  createdAt: string;
};

type Props = {
  initialCustomers: CustomerRow[];
  initialSearch: string;
  initialType: CustomerType | "";
  canEdit: boolean;
};

const TYPE_COLORS: Record<CustomerType, "default" | "secondary" | "success" | "warning"> = {
  RETAIL: "secondary",
  WHOLESALE: "default",
  CONSIGNMENT: "warning",
};

export function CustomerManagerClient({
  initialCustomers,
  initialSearch,
  initialType,
  canEdit,
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [search, setSearch] = useState(initialSearch);
  const [type, setType] = useState<CustomerType | "">(initialType);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerRow | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    companyName: "",
    customerType: "RETAIL" as CustomerType,
    taxId: "",
    creditLimitMyr: "",
    paymentTermsDays: "",
    notes: "",
    isActive: true,
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const applyFilters = (next: { search?: string; type?: CustomerType | "" }) => {
    const params = new URLSearchParams();
    const s = next.search ?? search;
    const t = next.type ?? type;
    if (s) params.set("search", s);
    if (t) params.set("type", t);
    startTransition(() => {
      router.push(`/sales/customers${params.toString() ? `?${params}` : ""}`);
    });
  };

  const openCreate = () => {
    setEditing(null);
    setForm({
      name: "",
      email: "",
      phone: "",
      companyName: "",
      customerType: "RETAIL",
      taxId: "",
      creditLimitMyr: "",
      paymentTermsDays: "",
      notes: "",
      isActive: true,
    });
    setError("");
    setDialogOpen(true);
  };

  const openEdit = (c: CustomerRow) => {
    setEditing(c);
    setForm({
      name: c.name,
      email: c.email || "",
      phone: c.phone || "",
      companyName: c.companyName || "",
      customerType: c.customerType,
      taxId: "",
      creditLimitMyr: c.creditLimitMyr != null ? String(c.creditLimitMyr) : "",
      paymentTermsDays: c.paymentTermsDays != null ? String(c.paymentTermsDays) : "",
      notes: "",
      isActive: c.isActive,
    });
    setError("");
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError("");

    const payload: Record<string, unknown> = {
      name: form.name,
      email: form.email || undefined,
      phone: form.phone || undefined,
      companyName: form.companyName || undefined,
      customerType: form.customerType,
      taxId: form.taxId || undefined,
      notes: form.notes || undefined,
      isActive: form.isActive,
    };
    if (form.creditLimitMyr) payload.creditLimitMyr = Number(form.creditLimitMyr);
    if (form.paymentTermsDays) payload.paymentTermsDays = parseInt(form.paymentTermsDays, 10);

    try {
      const url = editing ? `/api/v1/customers/${editing.id}` : "/api/v1/customers";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message || "Failed to save customer");
        return;
      }
      setDialogOpen(false);
      router.refresh();
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Filters + Add */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") applyFilters({ search });
            }}
            placeholder="Search name, company, email, or phone..."
            className="pl-9"
          />
        </div>
        <Select
          value={type || "ALL"}
          onValueChange={(v) => {
            const nt = v === "ALL" ? "" : (v as CustomerType);
            setType(nt);
            applyFilters({ type: nt });
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All types</SelectItem>
            <SelectItem value="RETAIL">Retail</SelectItem>
            <SelectItem value="WHOLESALE">Wholesale</SelectItem>
            <SelectItem value="CONSIGNMENT">Consignment</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={() => applyFilters({ search })}>
          Apply
        </Button>
        <div className="flex-1" />
        {canEdit && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            New Customer
          </Button>
        )}
      </div>

      {initialCustomers.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          No customers found.
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead className="text-right">Credit (MYR)</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-[90px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {initialCustomers.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link
                      href={`/sales/customers/${c.id}`}
                      className="font-medium hover:underline"
                    >
                      {c.name}
                    </Link>
                    {c.companyName && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Building2 className="h-3 w-3" />
                        {c.companyName}
                      </div>
                    )}
                    {!c.isActive && (
                      <Badge variant="secondary" className="text-xs ml-1 mt-0.5">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={TYPE_COLORS[c.customerType]} className="text-xs">
                      {c.customerType}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {c.email && (
                      <div className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {c.email}
                      </div>
                    )}
                    {c.phone && (
                      <div className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {c.phone}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{c.orderCount}</TableCell>
                  <TableCell className="text-right text-xs">
                    {c.creditLimitMyr != null ? c.creditLimitMyr.toLocaleString() : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(c.createdAt)}
                  </TableCell>
                  <TableCell>
                    {canEdit && (
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Customer" : "New Customer"}</DialogTitle>
            <DialogDescription>
              {editing ? "Update customer details." : "Create a new customer profile."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2 col-span-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customerType">Type *</Label>
                <Select
                  value={form.customerType}
                  onValueChange={(v) => setForm({ ...form, customerType: v as CustomerType })}
                >
                  <SelectTrigger id="customerType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RETAIL">Retail</SelectItem>
                    <SelectItem value="WHOLESALE">Wholesale</SelectItem>
                    <SelectItem value="CONSIGNMENT">Consignment</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyName">Company</Label>
                <Input
                  id="companyName"
                  value={form.companyName}
                  onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+60..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="taxId">Tax ID / SSM</Label>
                <Input
                  id="taxId"
                  value={form.taxId}
                  onChange={(e) => setForm({ ...form, taxId: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="creditLimitMyr">Credit limit (MYR)</Label>
                <Input
                  id="creditLimitMyr"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.creditLimitMyr}
                  onChange={(e) => setForm({ ...form, creditLimitMyr: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="paymentTermsDays">Payment terms (days)</Label>
                <Input
                  id="paymentTermsDays"
                  type="number"
                  min="0"
                  max="365"
                  value={form.paymentTermsDays}
                  onChange={(e) => setForm({ ...form, paymentTermsDays: e.target.value })}
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                />
              </div>
            </div>

            {editing && (
              <div className="flex items-center gap-2 pt-2">
                <input
                  id="isActive"
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="h-4 w-4 rounded border"
                />
                <Label htmlFor="isActive" className="cursor-pointer">Active</Label>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={loading || !form.name.trim()}>
              {loading ? "Saving..." : editing ? "Save changes" : "Create customer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
