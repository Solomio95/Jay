"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Store, ShoppingBag, Globe, Video, Handshake, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

type ChannelType =
  | "PHYSICAL_STORE"
  | "SHOPEE"
  | "TIKTOK"
  | "SHOPIFY"
  | "WEBSITE"
  | "WHOLESALE"
  | "CONSIGNMENT";

export type ChannelRow = {
  id: string;
  name: string;
  type: ChannelType;
  commissionRate: number | null;
  isActive: boolean;
  orderCount: number;
};

const TYPE_META: Record<
  ChannelType,
  { label: string; icon: React.ReactNode; color: string }
> = {
  PHYSICAL_STORE: { label: "Physical Store", icon: <Store className="h-4 w-4" />, color: "text-green-600" },
  SHOPEE: { label: "Shopee", icon: <ShoppingBag className="h-4 w-4" />, color: "text-orange-600" },
  TIKTOK: { label: "TikTok Shop", icon: <Video className="h-4 w-4" />, color: "text-pink-600" },
  SHOPIFY: { label: "Shopify", icon: <ShoppingBag className="h-4 w-4" />, color: "text-emerald-600" },
  WEBSITE: { label: "Website", icon: <Globe className="h-4 w-4" />, color: "text-blue-600" },
  WHOLESALE: { label: "Wholesale", icon: <Users className="h-4 w-4" />, color: "text-indigo-600" },
  CONSIGNMENT: { label: "Consignment", icon: <Handshake className="h-4 w-4" />, color: "text-amber-600" },
};

type Props = {
  initialChannels: ChannelRow[];
  canEdit: boolean;
};

export function SalesChannelClient({ initialChannels, canEdit }: Props) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ChannelRow | null>(null);
  const [form, setForm] = useState({
    name: "",
    type: "PHYSICAL_STORE" as ChannelType,
    commissionRate: "",
    isActive: true,
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", type: "PHYSICAL_STORE", commissionRate: "", isActive: true });
    setError("");
    setDialogOpen(true);
  };

  const openEdit = (c: ChannelRow) => {
    setEditing(c);
    setForm({
      name: c.name,
      type: c.type,
      commissionRate: c.commissionRate != null ? String(c.commissionRate) : "",
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
      type: form.type,
      isActive: form.isActive,
    };
    if (form.commissionRate) payload.commissionRate = Number(form.commissionRate);
    else if (editing) payload.commissionRate = null;

    try {
      const url = editing ? `/api/v1/sales-channels/${editing.id}` : "/api/v1/sales-channels";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message || "Failed to save channel");
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
      {canEdit && (
        <div className="flex justify-end mb-4">
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            New Channel
          </Button>
        </div>
      )}

      {initialChannels.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          No sales channels configured yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {initialChannels.map((c) => {
            const meta = TYPE_META[c.type];
            return (
              <div key={c.id} className="border rounded-lg p-4 hover:border-primary/50 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div className={`flex items-center gap-2 ${meta.color}`}>
                    {meta.icon}
                    <span className="text-xs font-semibold uppercase tracking-wide">{meta.label}</span>
                  </div>
                  {canEdit && (
                    <Button size="icon" variant="ghost" onClick={() => openEdit(c)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="font-medium text-sm">{c.name}</div>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {c.isActive ? (
                    <Badge variant="success" className="text-xs">Active</Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">Inactive</Badge>
                  )}
                  {c.commissionRate != null && (
                    <Badge variant="secondary" className="text-xs">
                      {c.commissionRate}% commission
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground ml-auto">
                    {c.orderCount} orders
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Sales Channel" : "New Sales Channel"}</DialogTitle>
            <DialogDescription>
              Configure a sales channel for order attribution and commission tracking.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Shopee MY Main Store"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Type *</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as ChannelType })}>
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(TYPE_META) as ChannelType[]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {TYPE_META[t].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="commissionRate">Commission rate (%)</Label>
              <Input
                id="commissionRate"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={form.commissionRate}
                onChange={(e) => setForm({ ...form, commissionRate: e.target.value })}
                placeholder="e.g. 5.5"
              />
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
              {loading ? "Saving..." : editing ? "Save changes" : "Create channel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
