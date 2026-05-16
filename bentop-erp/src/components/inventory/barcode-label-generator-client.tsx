"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, ExternalLink, FileText, Minus, Plus, Search, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BulkVariantAdder } from "@/components/inventory/bulk-variant-adder";
import type { VariantOption } from "@/components/inventory/variant-picker";

type LabelLine = {
  variant: VariantOption;
  copies: number;
};

export function BarcodeLabelGeneratorClient() {
  const [lines, setLines] = useState<LabelLine[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<VariantOption[]>([]);
  const [selectedResultIds, setSelectedResultIds] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pdfResult, setPdfResult] = useState<{ url: string; fileName: string } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const totalLabels = useMemo(
    () => lines.reduce((sum, line) => sum + line.copies, 0),
    [lines]
  );
  const missingBarcodeLines = lines.filter((line) => !line.variant.barcode?.trim());
  const lineIds = useMemo(() => lines.map((line) => line.variant.id), [lines]);
  const availableResults = results.filter((variant) => !lineIds.includes(variant.id));
  const allAvailableSelected =
    availableResults.length > 0 &&
    availableResults.every((variant) => selectedResultIds.includes(variant.id));

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const searchText = query.trim();

    if (!searchText) {
      setResults([]);
      setSelectedResultIds([]);
      setSearching(false);
      return;
    }

    timerRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(`/api/v1/variants?search=${encodeURIComponent(searchText)}&limit=50`);
        if (response.ok) {
          const payload = await response.json();
          setResults(payload.data as VariantOption[]);
          setSelectedResultIds([]);
        }
      } finally {
        setSearching(false);
      }
    }, 200);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query]);

  useEffect(() => {
    return () => {
      if (pdfResult?.url) URL.revokeObjectURL(pdfResult.url);
    };
  }, [pdfResult]);

  const addVariant = (variant: VariantOption) => {
    setMessage(null);
    setPdfResult(null);
    setLines((current) => {
      if (current.some((line) => line.variant.id === variant.id)) {
        return current.map((line) =>
          line.variant.id === variant.id ? { ...line, copies: line.copies + 1 } : line
        );
      }
      return [...current, { variant, copies: 1 }];
    });
  };

  const addSelectedResults = () => {
    const selected = results.filter((variant) => selectedResultIds.includes(variant.id));
    selected.forEach(addVariant);
    setSelectedResultIds([]);
  };

  const toggleAllAvailableResults = () => {
    setSelectedResultIds(
      allAvailableSelected ? [] : availableResults.map((variant) => variant.id)
    );
  };

  const updateCopies = (variantId: string, copies: number) => {
    setLines((current) =>
      current.map((line) =>
        line.variant.id === variantId
          ? { ...line, copies: Math.min(500, Math.max(1, Math.floor(copies || 1))) }
          : line
      )
    );
  };

  const removeLine = (variantId: string) => {
    setLines((current) => current.filter((line) => line.variant.id !== variantId));
  };

  const generatePdf = async () => {
    if (lines.length === 0) {
      setMessage("Select at least one SKU before generating labels.");
      return;
    }

    if (missingBarcodeLines.length > 0) {
      setMessage(
        `Add barcode values before printing: ${missingBarcodeLines
          .map((line) => line.variant.sku)
          .join(", ")}`
      );
      return;
    }

    setGenerating(true);
    setMessage(null);
    if (pdfResult?.url) URL.revokeObjectURL(pdfResult.url);
    setPdfResult(null);

    try {
      const response = await fetch("/api/v1/barcode-labels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: lines.map((line) => ({
            productVariantId: line.variant.id,
            copies: line.copies,
          })),
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error?.message || "Unable to generate barcode labels.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const fileName = `bentop-barcode-labels-${new Date().toISOString().slice(0, 10)}.pdf`;
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setPdfResult({ url, fileName });
      setMessage(
        `Generated ${totalLabels} label${totalLabels === 1 ? "" : "s"}. Use Open PDF if the download is not visible.`
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to generate barcode labels.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="space-y-3">
            <div>
              <h3 className="font-semibold">Select Product Variants</h3>
              <p className="text-sm text-muted-foreground">
                Search a product name, SKU, or barcode, then select multiple variants at once.
              </p>
            </div>
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search product name, SKU, or barcode..."
                  className="pl-9"
                />
              </div>

              {query.trim() && (
                <div className="rounded-md border">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/20 px-3 py-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={allAvailableSelected}
                        onCheckedChange={toggleAllAvailableResults}
                        aria-label="Select all search results"
                        disabled={availableResults.length === 0}
                      />
                      <span>
                        {searching
                          ? "Searching..."
                          : `${availableResults.length} available result${availableResults.length === 1 ? "" : "s"}`}
                      </span>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={addSelectedResults}
                      disabled={selectedResultIds.length === 0}
                    >
                      <Plus className="h-4 w-4" />
                      Add Selected ({selectedResultIds.length})
                    </Button>
                  </div>

                  <div className="max-h-72 overflow-y-auto">
                    {availableResults.length === 0 ? (
                      <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                        {searching ? "Searching..." : "No variants available to add."}
                      </p>
                    ) : (
                      availableResults.map((variant) => (
                        <label
                          key={variant.id}
                          className="flex cursor-pointer items-center gap-3 border-b px-3 py-2 text-sm last:border-b-0 hover:bg-muted/40"
                        >
                          <Checkbox
                            checked={selectedResultIds.includes(variant.id)}
                            onCheckedChange={(checked) => {
                              setSelectedResultIds((current) =>
                                checked
                                  ? Array.from(new Set([...current, variant.id]))
                                  : current.filter((id) => id !== variant.id)
                              );
                            }}
                            aria-label={`Select ${variant.sku}`}
                          />
                          <span
                            className="h-3 w-3 rounded-full ring-1 ring-border"
                            style={{ backgroundColor: variant.colorHex || "#999" }}
                          />
                          <span className="min-w-36 font-mono text-xs">{variant.sku}</span>
                          <span className="flex-1 text-muted-foreground">
                            {variant.productName} / {variant.color} / {variant.size}
                          </span>
                          {variant.barcode ? (
                            <span className="font-mono text-xs text-muted-foreground">
                              {variant.barcode}
                            </span>
                          ) : (
                            <Badge variant="warning">Missing barcode</Badge>
                          )}
                        </label>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <BulkVariantAdder
              onAdd={addVariant}
              excludeIds={lines.map((line) => line.variant.id)}
            />
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
          <div>
            <h3 className="font-semibold">Label Queue</h3>
            <p className="text-sm text-muted-foreground">
              {lines.length} SKU{lines.length === 1 ? "" : "s"} selected, {totalLabels} total label
              {totalLabels === 1 ? "" : "s"}.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={missingBarcodeLines.length ? "warning" : "secondary"}>
              {missingBarcodeLines.length} missing barcode
            </Badge>
            <Button onClick={generatePdf} disabled={generating || lines.length === 0}>
              <Download className="h-4 w-4" />
              {generating ? "Generating..." : "Generate PDF"}
            </Button>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Artical No</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Colour</TableHead>
              <TableHead>Barcode</TableHead>
              <TableHead className="w-32">Copies</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  Select product variants to create barcode labels.
                </TableCell>
              </TableRow>
            ) : (
              lines.map((line) => (
                <TableRow key={line.variant.id}>
                  <TableCell className="font-mono text-xs">{line.variant.sku}</TableCell>
                  <TableCell>{line.variant.productName}</TableCell>
                  <TableCell>{line.variant.size}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span
                        className="h-3 w-3 rounded-full ring-1 ring-border"
                        style={{ backgroundColor: line.variant.colorHex || "#999" }}
                      />
                      {line.variant.color}
                    </div>
                  </TableCell>
                  <TableCell>
                    {line.variant.barcode ? (
                      <span className="font-mono text-xs">{line.variant.barcode}</span>
                    ) : (
                      <Badge variant="warning">Missing</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => updateCopies(line.variant.id, line.copies - 1)}
                        aria-label="Decrease copies"
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <Input
                        type="number"
                        min={1}
                        max={500}
                        value={line.copies}
                        onChange={(event) =>
                          updateCopies(line.variant.id, Number(event.target.value))
                        }
                        className="h-9 w-16 text-center"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => updateCopies(line.variant.id, line.copies + 1)}
                        aria-label="Increase copies"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeLine(line.variant.id)}
                      aria-label="Remove variant"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {message && <p className="text-sm text-muted-foreground">{message}</p>}

      {pdfResult && (
        <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-medium">{pdfResult.fileName}</p>
              <p className="text-xs text-muted-foreground">
                The browser also saves it to your default Downloads folder.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" asChild>
              <a href={pdfResult.url} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" />
                Open PDF
              </a>
            </Button>
            <Button type="button" asChild>
              <a href={pdfResult.url} download={pdfResult.fileName}>
                <Download className="h-4 w-4" />
                Download Again
              </a>
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
