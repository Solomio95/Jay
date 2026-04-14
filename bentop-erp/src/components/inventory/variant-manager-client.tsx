"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Wand2, Barcode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Variant = {
  id: string;
  sku: string;
  size: string;
  color: string;
  colorHex: string | null;
  barcode: string | null;
  isActive: boolean;
  stockLevelsCount: number;
  orderItemsCount: number;
};

type Color = { name: string; hex: string };

type Props = {
  productId: string;
  skuPrefix: string;
  existingVariants: Variant[];
};

const COMMON_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "3XL"];

const COMMON_COLORS: Color[] = [
  { name: "Black", hex: "#000000" },
  { name: "White", hex: "#FFFFFF" },
  { name: "Navy", hex: "#1B2A4A" },
  { name: "Grey", hex: "#808080" },
  { name: "Red", hex: "#D32F2F" },
  { name: "Blue", hex: "#1976D2" },
  { name: "Green", hex: "#388E3C" },
  { name: "Khaki", hex: "#C3B091" },
  { name: "Pink", hex: "#EC407A" },
  { name: "Brown", hex: "#6D4C41" },
];

export function VariantManagerClient({ productId, skuPrefix, existingVariants }: Props) {
  const router = useRouter();
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [selectedColors, setSelectedColors] = useState<Color[]>([]);
  const [customSize, setCustomSize] = useState("");
  const [customColorName, setCustomColorName] = useState("");
  const [customColorHex, setCustomColorHex] = useState("#000000");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Identify which SKUs already exist
  const existingSkus = new Set(existingVariants.map((v) => v.sku));
  const existingByColorSize = new Map(
    existingVariants.map((v) => [`${v.color}|${v.size}`, v])
  );

  const toggleSize = (size: string) => {
    setSelectedSizes((prev) =>
      prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size]
    );
  };

  const toggleColor = (color: Color) => {
    setSelectedColors((prev) =>
      prev.some((c) => c.name === color.name)
        ? prev.filter((c) => c.name !== color.name)
        : [...prev, color]
    );
  };

  const addCustomSize = () => {
    const size = customSize.trim().toUpperCase();
    if (size && !selectedSizes.includes(size)) {
      setSelectedSizes([...selectedSizes, size]);
      setCustomSize("");
    }
  };

  const addCustomColor = () => {
    const name = customColorName.trim();
    if (name && !selectedColors.some((c) => c.name === name)) {
      setSelectedColors([...selectedColors, { name, hex: customColorHex }]);
      setCustomColorName("");
      setCustomColorHex("#000000");
    }
  };

  const generateVariants = async () => {
    if (selectedSizes.length === 0 || selectedColors.length === 0) {
      setMessage({ type: "error", text: "Please select at least one size and one color." });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/v1/products/${productId}/variants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sizes: selectedSizes,
          colors: selectedColors,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: "error", text: data.error?.message || "Failed to generate variants" });
        return;
      }

      const { created, skipped } = data.meta || { created: 0, skipped: 0 };
      setMessage({
        type: "success",
        text: `Generated ${created} new variants${skipped > 0 ? ` (${skipped} already existed)` : ""}.`,
      });
      setSelectedSizes([]);
      setSelectedColors([]);
      router.refresh();
    } catch {
      setMessage({ type: "error", text: "Network error — please try again" });
    } finally {
      setLoading(false);
    }
  };

  const toggleVariantActive = async (variantId: string, isActive: boolean) => {
    const res = await fetch(`/api/v1/products/${productId}/variants`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variantId, isActive: !isActive }),
    });
    if (res.ok) {
      router.refresh();
    }
  };

  const previewCount = selectedSizes.length * selectedColors.length;
  const previewSkus = selectedColors.flatMap((color) =>
    selectedSizes.map((size) => {
      const colorCode = color.name.substring(0, 3).toUpperCase();
      return {
        sku: `${skuPrefix}-${colorCode}-${size}`,
        color,
        size,
        exists: existingByColorSize.has(`${color.name}|${size}`),
      };
    })
  );

  return (
    <div className="space-y-6">
      {message && (
        <div
          className={
            message.type === "success"
              ? "rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800"
              : "rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive"
          }
        >
          {message.text}
        </div>
      )}

      {/* Size Selection */}
      <div>
        <Label className="mb-2 block">Sizes</Label>
        <div className="flex flex-wrap gap-2 mb-2">
          {COMMON_SIZES.map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => toggleSize(size)}
              className={`px-3 py-1.5 rounded-md border text-sm font-medium transition-colors ${
                selectedSizes.includes(size)
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background hover:bg-muted"
              }`}
            >
              {size}
            </button>
          ))}
          {selectedSizes
            .filter((s) => !COMMON_SIZES.includes(s))
            .map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => toggleSize(size)}
                className="px-3 py-1.5 rounded-md border border-primary bg-primary text-primary-foreground text-sm font-medium flex items-center gap-1"
              >
                {size}
                <X className="h-3 w-3" />
              </button>
            ))}
        </div>
        <div className="flex gap-2 max-w-xs">
          <Input
            value={customSize}
            onChange={(e) => setCustomSize(e.target.value)}
            placeholder="Custom size"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustomSize();
              }
            }}
          />
          <Button type="button" variant="outline" size="sm" onClick={addCustomSize}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Color Selection */}
      <div>
        <Label className="mb-2 block">Colors</Label>
        <div className="flex flex-wrap gap-2 mb-2">
          {COMMON_COLORS.map((color) => {
            const isSelected = selectedColors.some((c) => c.name === color.name);
            return (
              <button
                key={color.name}
                type="button"
                onClick={() => toggleColor(color)}
                className={`px-3 py-1.5 rounded-md border text-sm font-medium transition-colors flex items-center gap-2 ${
                  isSelected
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background hover:bg-muted"
                }`}
              >
                <span
                  className="inline-block h-4 w-4 rounded-full ring-1 ring-border"
                  style={{ backgroundColor: color.hex }}
                />
                {color.name}
              </button>
            );
          })}
          {selectedColors
            .filter((c) => !COMMON_COLORS.some((cc) => cc.name === c.name))
            .map((color) => (
              <button
                key={color.name}
                type="button"
                onClick={() => toggleColor(color)}
                className="px-3 py-1.5 rounded-md border border-primary bg-primary text-primary-foreground text-sm font-medium flex items-center gap-2"
              >
                <span
                  className="inline-block h-4 w-4 rounded-full ring-1 ring-white/30"
                  style={{ backgroundColor: color.hex }}
                />
                {color.name}
                <X className="h-3 w-3" />
              </button>
            ))}
        </div>
        <div className="flex gap-2 max-w-md">
          <Input
            value={customColorName}
            onChange={(e) => setCustomColorName(e.target.value)}
            placeholder="Custom color name"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustomColor();
              }
            }}
          />
          <Input
            type="color"
            value={customColorHex}
            onChange={(e) => setCustomColorHex(e.target.value)}
            className="w-16 p-1"
          />
          <Button type="button" variant="outline" size="sm" onClick={addCustomColor}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Preview & Generate */}
      {previewCount > 0 && (
        <div className="border rounded-lg p-4 bg-muted/30">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-semibold">
                Preview: {previewCount} variants will be generated
              </p>
              <p className="text-xs text-muted-foreground">
                {previewSkus.filter((p) => p.exists).length} already exist and will be skipped
              </p>
            </div>
            <Button onClick={generateVariants} disabled={loading}>
              <Wand2 className="mr-2 h-4 w-4" />
              {loading ? "Generating..." : "Generate Variants"}
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
            {previewSkus.map((p) => (
              <div
                key={p.sku}
                className={`text-xs font-mono px-2 py-1 rounded border ${
                  p.exists
                    ? "bg-muted text-muted-foreground line-through"
                    : "bg-background border-dashed"
                }`}
              >
                <span
                  className="inline-block h-2 w-2 rounded-full mr-1.5"
                  style={{ backgroundColor: p.color.hex }}
                />
                {p.sku}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Existing Variants */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">
            Existing Variants ({existingVariants.length})
          </h3>
        </div>
        {existingVariants.length === 0 ? (
          <div className="border rounded-lg py-8 text-center text-muted-foreground text-sm">
            No variants yet. Select sizes and colors above to generate the first variants.
          </div>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Color</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Barcode</TableHead>
                  <TableHead>Stock Records</TableHead>
                  <TableHead>Sold</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {existingVariants.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-mono text-xs">{v.sku}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block h-4 w-4 rounded-full ring-1 ring-border"
                          style={{ backgroundColor: v.colorHex || "#999" }}
                        />
                        {v.color}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{v.size}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground flex items-center gap-1">
                      <Barcode className="h-3 w-3" />
                      {v.barcode}
                    </TableCell>
                    <TableCell>{v.stockLevelsCount}</TableCell>
                    <TableCell>{v.orderItemsCount}</TableCell>
                    <TableCell>
                      {v.isActive ? (
                        <Badge variant="success">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toggleVariantActive(v.id, v.isActive)}
                      >
                        {v.isActive ? "Deactivate" : "Activate"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
