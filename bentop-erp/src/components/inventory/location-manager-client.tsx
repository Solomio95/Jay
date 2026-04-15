"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Warehouse, Store, Handshake, Phone, MapPin } from "lucide-react";
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

type LocationType = "WAREHOUSE" | "RETAIL_STORE" | "CONSIGNMENT";

type Location = {
  id: string;
  name: string;
  type: LocationType;
  address: string | null;
  contactPerson: string | null;
  contactPhone: string | null;
  isActive: boolean;
  stockRecords: number;
};

type Props = {
  initialLocations: Location[];
};

const TYPE_META: Record<LocationType, { label: string; icon: React.ReactNode; color: string }> = {
  WAREHOUSE: { label: "Warehouse", icon: <Warehouse className="h-4 w-4" />, color: "text-blue-600" },
  RETAIL_STORE: { label: "Retail Store", icon: <Store className="h-4 w-4" />, color: "text-green-600" },
  CONSIGNMENT: { label: "Consignment", icon: <Handshake className="h-4 w-4" />, color: "text-amber-600" },
};

export function LocationManagerClient({ initialLocations }: Props) {
  const router = useRouter();
  const [locations] = useState(initialLocations);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Location | null>(null);
  const [form, setForm] = useState({
    name: "",
    type: "WAREHOUSE" as LocationType,
    address: "",
    contactPerson: "",
    contactPhone: "",
    isActive: true,
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setForm({
      name: "",
      type: "WAREHOUSE",
      address: "",
      contactPerson: "",
      contactPhone: "",
      isActive: true,
    });
    setError("");
    setDialogOpen(true);
  };

  const openEdit = (loc: Location) => {
    setEditing(loc);
    setForm({
      name: loc.name,
      type: loc.type,
      address: loc.address || "",
      contactPerson: loc.contactPerson || "",
      contactPhone: loc.contactPhone || "",
      isActive: loc.isActive,
    });
    setError("");
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError("");

    const payload = {
      name: form.name,
      type: form.type,
      address: form.address || undefined,
      contactPerson: form.contactPerson || undefined,
      contactPhone: form.contactPhone || undefined,
      isActive: form.isActive,
    };

    try {
      const url = editing ? `/api/v1/locations/${editing.id}` : "/api/v1/locations";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message || "Failed to save location");
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

  const grouped = locations.reduce<Record<LocationType, Location[]>>(
    (acc, l) => {
      (acc[l.type] ||= []).push(l);
      return acc;
    },
    { WAREHOUSE: [], RETAIL_STORE: [], CONSIGNMENT: [] }
  );

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          New Location
        </Button>
      </div>

      {locations.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No locations yet. Create your first warehouse or store.
        </div>
      ) : (
        <div className="space-y-6">
          {(Object.keys(grouped) as LocationType[]).map((type) =>
            grouped[type].length === 0 ? null : (
              <div key={type}>
                <div className={`flex items-center gap-2 mb-2 ${TYPE_META[type].color}`}>
                  {TYPE_META[type].icon}
                  <h3 className="text-sm font-semibold uppercase tracking-wide">
                    {TYPE_META[type].label}
                  </h3>
                  <span className="text-xs text-muted-foreground">({grouped[type].length})</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {grouped[type].map((loc) => (
                    <div
                      key={loc.id}
                      className="border rounded-lg p-4 hover:border-primary/50 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="font-medium text-sm">{loc.name}</div>
                          <div className="flex items-center gap-2 mt-0.5">
                            {loc.isActive ? (
                              <Badge variant="success" className="text-xs">Active</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">Inactive</Badge>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {loc.stockRecords} stock records
                            </span>
                          </div>
                        </div>
                        <Button size="icon" variant="ghost" onClick={() => openEdit(loc)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="space-y-1 text-xs text-muted-foreground">
                        {loc.address && (
                          <div className="flex items-start gap-1.5">
                            <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
                            <span className="line-clamp-2">{loc.address}</span>
                          </div>
                        )}
                        {loc.contactPerson && (
                          <div>
                            <span className="font-medium">{loc.contactPerson}</span>
                          </div>
                        )}
                        {loc.contactPhone && (
                          <div className="flex items-center gap-1.5">
                            <Phone className="h-3 w-3" />
                            <span>{loc.contactPhone}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          )}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Location" : "New Location"}</DialogTitle>
            <DialogDescription>
              {editing ? "Update location details." : "Add a new warehouse, retail store, or consignment partner."}
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
                placeholder="e.g. Shah Alam Warehouse"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Type *</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as LocationType })}>
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WAREHOUSE">Warehouse</SelectItem>
                  <SelectItem value="RETAIL_STORE">Retail Store</SelectItem>
                  <SelectItem value="CONSIGNMENT">Consignment</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                rows={2}
                placeholder="Street, city, postcode"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="contactPerson">Contact person</Label>
                <Input
                  id="contactPerson"
                  value={form.contactPerson}
                  onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactPhone">Phone</Label>
                <Input
                  id="contactPhone"
                  value={form.contactPhone}
                  onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                  placeholder="+60..."
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
              {loading ? "Saving..." : editing ? "Save changes" : "Create location"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
