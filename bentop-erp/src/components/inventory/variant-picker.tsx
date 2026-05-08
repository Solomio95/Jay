"use client";

import { useState, useEffect, useRef } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";

export type VariantOption = {
  id: string;
  sku: string;
  size: string;
  color: string;
  colorHex: string | null;
  barcode: string | null;
  sellingPriceMyr: number;
  productId: string;
  productName: string;
  productSkuPrefix: string;
};

type Props = {
  onSelect: (v: VariantOption) => void;
  excludeIds?: string[];
  placeholder?: string;
};

export function VariantPicker({ onSelect, excludeIds = [], placeholder }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<VariantOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!query.trim()) {
      // Clear results asynchronously to avoid setState-in-effect warning
      timerRef.current = setTimeout(() => setResults([]), 0);
      return;
    }
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      const res = await fetch(`/api/v1/variants?search=${encodeURIComponent(query)}&limit=20`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.data);
      }
      setLoading(false);
    }, 200);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query]);

  const filtered = results.filter((r) => !excludeIds.includes(r.id));

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder || "Search by SKU, barcode, or product name..."}
          className="pl-9 pr-9"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setResults([]);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {open && query.trim() && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg max-h-72 overflow-y-auto">
          {loading ? (
            <div className="p-3 text-sm text-muted-foreground">Searching...</div>
          ) : filtered.length === 0 ? (
            <div className="p-3 text-sm text-muted-foreground">No matches</div>
          ) : (
            filtered.map((v) => (
              <button
                key={v.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(v);
                  setQuery("");
                  setResults([]);
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-2 hover:bg-muted flex items-center gap-2 text-sm"
              >
                <span
                  className="inline-block h-3 w-3 rounded-full ring-1 ring-border flex-shrink-0"
                  style={{ backgroundColor: v.colorHex || "#999" }}
                />
                <span className="font-mono text-xs">{v.sku}</span>
                <span className="text-xs text-muted-foreground flex-1">
                  {v.productName} · {v.color} · {v.size}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
