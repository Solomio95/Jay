"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Save, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type TierForm = {
  name: string;
  minPrice: string;
  maxPrice: string;
  commissionRate: string;
  sortOrder: number;
};

type OverrideForm = {
  productId: string;
  productVariantId: string;
  tierName: string;
  commissionRate: string;
  notes: string;
};

type PartnerRow = {
  id: string;
  name: string;
  contactPerson: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  locationId: string | null;
  paymentTermsDays: number | null;
  isActive: boolean;
  tiers: TierForm[];
  overrides: OverrideForm[];
};

type LocationOption = {
  id: string;
  name: string;
};

type ProductOption = {
  id: string;
  name: string;
  variants: {
    id: string;
    sku: string;
    color: string;
    size: string;
  }[];
};

type Props = {
  initialPartners: PartnerRow[];
  locations: LocationOption[];
  products: ProductOption[];
  canEdit: boolean;
};

const DEFAULT_TIERS: TierForm[] = [
  { name: "Super Best Buy", minPrice: "0", maxPrice: "49.90", commissionRate: "23", sortOrder: 1 },
  { name: "Best Buy", minPrice: "50", maxPrice: "109", commissionRate: "25", sortOrder: 2 },
  { name: "Normal", minPrice: "110", maxPrice: "", commissionRate: "32", sortOrder: 3 },
];

const EMPTY_OVERRIDE: OverrideForm = {
  productId: "",
  productVariantId: "",
  tierName: "",
  commissionRate: "",
  notes: "",
};

function blankForm() {
  return {
    name: "",
    contactPerson: "",
    contactPhone: "",
    contactEmail: "",
    locationId: "",
    paymentTermsDays: "",
    tiers: DEFAULT_TIERS.map((tier) => ({ ...tier })),
    overrides: [] as OverrideForm[],
  };
}

export function ConsignmentPartnerFormClient({
  initialPartners,
  locations,
  products,
  canEdit,
}: Props) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(initialPartners[0]?.id ?? null);
  const [form, setForm] = useState(() => {
    const first = initialPartners[0];
    return first ? formFromPartner(first) : blankForm();
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const selectedPartner = initialPartners.find((partner) => partner.id === editingId) ?? null;

  const variantsByProduct = useMemo(
    () => new Map(products.map((product) => [product.id, product.variants])),
    [products],
  );

  const openCreate = () => {
    setEditingId(null);
    setForm(blankForm());
    setError("");
  };

  const openEdit = (partner: PartnerRow) => {
    setEditingId(partner.id);
    setForm(formFromPartner(partner));
    setError("");
  };

  const updateTier = (index: number, patch: Partial<TierForm>) => {
    setForm((current) => ({
      ...current,
      tiers: current.tiers.map((tier, i) => (i === index ? { ...tier, ...patch } : tier)),
    }));
  };

  const updateOverride = (index: number, patch: Partial<OverrideForm>) => {
    setForm((current) => ({
      ...current,
      overrides: current.overrides.map((override, i) =>
        i === index ? { ...override, ...patch } : override,
      ),
    }));
  };

  const submit = async () => {
    setLoading(true);
    setError("");

    const payload = {
      name: form.name.trim(),
      contactPerson: emptyToNull(form.contactPerson),
      contactPhone: emptyToNull(form.contactPhone),
      contactEmail: emptyToNull(form.contactEmail),
      locationId: emptyToNull(form.locationId),
      paymentTermsDays: form.paymentTermsDays ? Number(form.paymentTermsDays) : null,
      tiers: form.tiers.map((tier, index) => ({
        name: tier.name.trim(),
        minPrice: Number(tier.minPrice),
        maxPrice: tier.maxPrice ? Number(tier.maxPrice) : null,
        commissionRate: Number(tier.commissionRate),
        sortOrder: index + 1,
      })),
      overrides: form.overrides
        .filter((override) => override.tierName.trim() && override.commissionRate)
        .map((override) => ({
          productId: emptyToNull(override.productId),
          productVariantId: emptyToNull(override.productVariantId),
          tierName: override.tierName.trim(),
          commissionRate: Number(override.commissionRate),
          notes: override.notes.trim() || undefined,
        })),
    };

    try {
      const url = editingId
        ? `/api/v1/consignment/partners/${editingId}`
        : "/api/v1/consignment/partners";
      const method = editingId ? "PUT" : "POST";
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error?.message || "Failed to save partner");
        return;
      }
      router.refresh();
      if (!editingId && data.data?.id) {
        setEditingId(data.data.id);
      }
    } catch {
      setError("Network error - please try again");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {initialPartners.map((partner) => (
          <button
            key={partner.id}
            type="button"
            onClick={() => openEdit(partner)}
            className={`rounded-lg border p-4 text-left transition-colors ${
              editingId === partner.id ? "border-primary bg-primary/5" : "hover:border-primary/50"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-medium">{partner.name}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {partner.paymentTermsDays ?? 0} day terms
                </div>
              </div>
              <Badge variant={partner.isActive ? "success" : "secondary"} className="text-xs">
                {partner.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {partner.tiers.map((tier) => (
                <Badge key={`${partner.id}-${tier.name}`} variant="secondary" className="text-xs">
                  {tier.name} {tier.commissionRate}%
                </Badge>
              ))}
            </div>
          </button>
        ))}
      </div>

      {canEdit && (
        <div className="flex justify-end">
          <Button variant="outline" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            New Partner
          </Button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            {selectedPartner ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {selectedPartner ? "Partner Setup" : "New Partner Setup"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label>Partner Name *</Label>
              <Input
                value={form.name}
                disabled={!canEdit}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Linked Consignment Location</Label>
              <Select
                value={form.locationId || "_none"}
                disabled={!canEdit}
                onValueChange={(value) =>
                  setForm({ ...form, locationId: value === "_none" ? "" : value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">No fixed location</SelectItem>
                  {locations.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Payment Terms (days)</Label>
              <Input
                type="number"
                min={0}
                disabled={!canEdit}
                value={form.paymentTermsDays}
                onChange={(event) => setForm({ ...form, paymentTermsDays: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Contact Person</Label>
              <Input
                value={form.contactPerson}
                disabled={!canEdit}
                onChange={(event) => setForm({ ...form, contactPerson: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                value={form.contactPhone}
                disabled={!canEdit}
                onChange={(event) => setForm({ ...form, contactPhone: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.contactEmail}
                disabled={!canEdit}
                onChange={(event) => setForm({ ...form, contactEmail: event.target.value })}
              />
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold">Commission Tiers</h3>
              <p className="text-xs text-muted-foreground">
                Actual selling price chooses the tier unless an item override exists.
              </p>
            </div>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Group</th>
                    <th className="px-3 py-2 text-right">Min RM</th>
                    <th className="px-3 py-2 text-right">Max RM</th>
                    <th className="px-3 py-2 text-right">Rate %</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {form.tiers.map((tier, index) => (
                    <tr key={`${tier.name}-${index}`}>
                      <td className="px-3 py-2">
                        <Input
                          value={tier.name}
                          disabled={!canEdit}
                          onChange={(event) => updateTier(index, { name: event.target.value })}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          className="text-right"
                          type="number"
                          min={0}
                          value={tier.minPrice}
                          disabled={!canEdit}
                          onChange={(event) => updateTier(index, { minPrice: event.target.value })}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          className="text-right"
                          type="number"
                          min={0}
                          value={tier.maxPrice}
                          disabled={!canEdit}
                          placeholder="No max"
                          onChange={(event) => updateTier(index, { maxPrice: event.target.value })}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          className="text-right"
                          type="number"
                          min={0}
                          max={100}
                          value={tier.commissionRate}
                          disabled={!canEdit}
                          onChange={(event) =>
                            updateTier(index, { commissionRate: event.target.value })
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">Item Overrides</h3>
                <p className="text-xs text-muted-foreground">
                  Overrides are configured before report entry and win over price tiers.
                </p>
              </div>
              {canEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      overrides: [...current.overrides, { ...EMPTY_OVERRIDE }],
                    }))
                  }
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Override
                </Button>
              )}
            </div>

            {form.overrides.length === 0 ? (
              <div className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
                No item-specific commission overrides.
              </div>
            ) : (
              <div className="space-y-3">
                {form.overrides.map((override, index) => {
                  const variants = override.productId
                    ? variantsByProduct.get(override.productId) ?? []
                    : [];
                  return (
                    <div key={index} className="grid gap-3 rounded-lg border p-3 lg:grid-cols-5">
                      <div className="space-y-2">
                        <Label>Product</Label>
                        <Select
                          value={override.productId || "_none"}
                          disabled={!canEdit}
                          onValueChange={(value) =>
                            updateOverride(index, {
                              productId: value === "_none" ? "" : value,
                              productVariantId: "",
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none">Choose product</SelectItem>
                            {products.map((product) => (
                              <SelectItem key={product.id} value={product.id}>
                                {product.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Variant</Label>
                        <Select
                          value={override.productVariantId || "_none"}
                          disabled={!canEdit || variants.length === 0}
                          onValueChange={(value) =>
                            updateOverride(index, {
                              productVariantId: value === "_none" ? "" : value,
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none">All variants</SelectItem>
                            {variants.map((variant) => (
                              <SelectItem key={variant.id} value={variant.id}>
                                {variant.sku} - {variant.color} {variant.size}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Group</Label>
                        <Input
                          value={override.tierName}
                          disabled={!canEdit}
                          onChange={(event) =>
                            updateOverride(index, { tierName: event.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Rate %</Label>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={override.commissionRate}
                          disabled={!canEdit}
                          onChange={(event) =>
                            updateOverride(index, { commissionRate: event.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Notes</Label>
                        <div className="flex gap-2">
                          <Textarea
                            rows={1}
                            value={override.notes}
                            disabled={!canEdit}
                            onChange={(event) =>
                              updateOverride(index, { notes: event.target.value })
                            }
                          />
                          {canEdit && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() =>
                                setForm((current) => ({
                                  ...current,
                                  overrides: current.overrides.filter((_, i) => i !== index),
                                }))
                              }
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {canEdit && (
            <div className="flex justify-end border-t pt-4">
              <Button onClick={submit} disabled={loading || !form.name.trim()}>
                <Save className="mr-2 h-4 w-4" />
                {loading ? "Saving..." : "Save Partner Setup"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function formFromPartner(partner: PartnerRow) {
  return {
    name: partner.name,
    contactPerson: partner.contactPerson ?? "",
    contactPhone: partner.contactPhone ?? "",
    contactEmail: partner.contactEmail ?? "",
    locationId: partner.locationId ?? "",
    paymentTermsDays:
      partner.paymentTermsDays !== null && partner.paymentTermsDays !== undefined
        ? String(partner.paymentTermsDays)
        : "",
    tiers: partner.tiers.map((tier) => ({ ...tier })),
    overrides: partner.overrides.map((override) => ({ ...override })),
  };
}

function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}
