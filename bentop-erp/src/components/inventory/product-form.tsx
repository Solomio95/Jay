"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Category = { id: string; name: string };

type FormData = {
  id?: string;
  name: string;
  slug?: string;
  skuPrefix: string;
  description: string;
  categoryId: string;
  brand: string;
  baseCostMyr: number;
  baseCostUsd: number | null;
  baseCostRmb: number | null;
  weightKg: number | null;
  material: string;
  careInstructions: string;
  isActive: boolean;
};

type Props = {
  categories: Category[];
  initialData?: FormData;
};

const emptyForm: FormData = {
  name: "",
  skuPrefix: "",
  description: "",
  categoryId: "",
  brand: "Bentop Collection",
  baseCostMyr: 0,
  baseCostUsd: null,
  baseCostRmb: null,
  weightKg: null,
  material: "",
  careInstructions: "",
  isActive: true,
};

export function ProductForm({ categories, initialData }: Props) {
  const router = useRouter();
  const isEdit = !!initialData?.id;
  const [form, setForm] = useState<FormData>(initialData || emptyForm);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const update = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const payload = {
      name: form.name,
      skuPrefix: form.skuPrefix,
      description: form.description || undefined,
      categoryId: form.categoryId,
      brand: form.brand,
      baseCostMyr: Number(form.baseCostMyr),
      baseCostUsd: form.baseCostUsd ? Number(form.baseCostUsd) : null,
      baseCostRmb: form.baseCostRmb ? Number(form.baseCostRmb) : null,
      weightKg: form.weightKg ? Number(form.weightKg) : null,
      material: form.material || undefined,
      careInstructions: form.careInstructions || undefined,
      isActive: form.isActive,
    };

    try {
      const url = isEdit ? `/api/v1/products/${initialData!.id}` : "/api/v1/products";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message || "Failed to save product");
        return;
      }
      const productId = data.data?.id || initialData?.id;
      if (!isEdit) {
        router.push(`/inventory/products/${productId}/variants`);
      } else {
        router.refresh();
        setError("");
      }
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!initialData?.id) return;
    if (!confirm(`Deactivate product "${form.name}"? You can reactivate it later.`)) return;

    const res = await fetch(`/api/v1/products/${initialData.id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/inventory/products");
    } else {
      const data = await res.json();
      setError(data.error?.message || "Failed to delete");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="name">Product Name *</Label>
          <Input
            id="name"
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            placeholder="e.g. Classic Crew Tee"
            required
            maxLength={200}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="skuPrefix">SKU Prefix *</Label>
          <Input
            id="skuPrefix"
            value={form.skuPrefix}
            onChange={(e) => update("skuPrefix", e.target.value.toUpperCase())}
            placeholder="e.g. BT-TS-001"
            required
            maxLength={20}
            className="font-mono"
          />
          <p className="text-xs text-muted-foreground">
            Variants will use: [prefix]-[color]-[size]
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="category">Category *</Label>
          <Select
            value={form.categoryId}
            onValueChange={(v) => update("categoryId", v)}
          >
            <SelectTrigger id="category">
              <SelectValue placeholder="Select a category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="brand">Brand</Label>
          <Input
            id="brand"
            value={form.brand}
            onChange={(e) => update("brand", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="material">Material</Label>
          <Input
            id="material"
            value={form.material}
            onChange={(e) => update("material", e.target.value)}
            placeholder="e.g. 100% Cotton"
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="care">Care Instructions</Label>
          <Textarea
            id="care"
            value={form.careInstructions}
            onChange={(e) => update("careInstructions", e.target.value)}
            rows={2}
            placeholder="e.g. Machine wash cold, tumble dry low"
          />
        </div>
      </div>

      <div className="border-t pt-4">
        <h3 className="text-sm font-semibold mb-3">Pricing &amp; Weight</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label htmlFor="cost-myr">Base Cost (MYR) *</Label>
            <Input
              id="cost-myr"
              type="number"
              step="0.01"
              min="0"
              value={form.baseCostMyr}
              onChange={(e) => update("baseCostMyr", Number(e.target.value))}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cost-usd">USD</Label>
            <Input
              id="cost-usd"
              type="number"
              step="0.01"
              min="0"
              value={form.baseCostUsd ?? ""}
              onChange={(e) => update("baseCostUsd", e.target.value ? Number(e.target.value) : null)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cost-rmb">RMB</Label>
            <Input
              id="cost-rmb"
              type="number"
              step="0.01"
              min="0"
              value={form.baseCostRmb ?? ""}
              onChange={(e) => update("baseCostRmb", e.target.value ? Number(e.target.value) : null)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="weight">Weight (kg)</Label>
            <Input
              id="weight"
              type="number"
              step="0.001"
              min="0"
              value={form.weightKg ?? ""}
              onChange={(e) => update("weightKg", e.target.value ? Number(e.target.value) : null)}
            />
          </div>
        </div>
      </div>

      <div className="border-t pt-4 flex items-center gap-2">
        <Checkbox
          id="active"
          checked={form.isActive}
          onCheckedChange={(v) => update("isActive", v === true)}
        />
        <Label htmlFor="active" className="cursor-pointer">
          Active (available for sale)
        </Label>
      </div>

      <div className="flex items-center justify-between border-t pt-4">
        <div>
          {isEdit && (
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={loading}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Deactivate
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" asChild>
            <Link href="/inventory/products">Cancel</Link>
          </Button>
          <Button type="submit" disabled={loading}>
            <Save className="mr-2 h-4 w-4" />
            {loading ? "Saving..." : isEdit ? "Save Changes" : "Create Product"}
          </Button>
        </div>
      </div>
    </form>
  );
}
