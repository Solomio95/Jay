"use client";

import { useState } from "react";
import { ListPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { parseBulkVariantTokens, pickBulkVariantMatch } from "@/lib/inventory/bulk-variant";
import type { VariantOption } from "./variant-picker";

type Props = {
  onAdd: (variant: VariantOption) => void | Promise<void>;
  excludeIds?: string[];
};

export function BulkVariantAdder({ onAdd, excludeIds = [] }: Props) {
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);

  const addBulk = async () => {
    const tokens = parseBulkVariantTokens(value);
    if (tokens.length === 0) {
      setSummary("Paste at least one SKU or barcode.");
      return;
    }

    setLoading(true);
    setSummary(null);

    const added: string[] = [];
    const skipped: string[] = [];
    const usedIds = new Set(excludeIds);

    try {
      for (const token of tokens) {
        const response = await fetch(`/api/v1/variants?search=${encodeURIComponent(token)}&limit=10`);
        if (!response.ok) {
          skipped.push(token);
          continue;
        }

        const payload = await response.json();
        const match = pickBulkVariantMatch(token, payload.data as VariantOption[]);
        if (!match || usedIds.has(match.id)) {
          skipped.push(token);
          continue;
        }

        await onAdd(match);
        usedIds.add(match.id);
        added.push(match.sku);
      }

      setValue("");
      setSummary(
        skipped.length > 0
          ? `Added ${added.length}. Could not match ${skipped.length}: ${skipped.join(", ")}`
          : `Added ${added.length} item${added.length === 1 ? "" : "s"}.`
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2 rounded-md border bg-muted/20 p-3">
      <Label>Bulk Add SKUs / Barcodes</Label>
      <Textarea
        rows={3}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Paste SKU or barcode list. Separate by line, comma, tab, or space."
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Exact SKU or barcode will be selected automatically.
        </p>
        <Button type="button" variant="outline" size="sm" onClick={addBulk} disabled={loading}>
          <ListPlus className="mr-2 h-4 w-4" />
          {loading ? "Adding..." : "Add List"}
        </Button>
      </div>
      {summary && <p className="text-xs text-muted-foreground">{summary}</p>}
    </div>
  );
}
