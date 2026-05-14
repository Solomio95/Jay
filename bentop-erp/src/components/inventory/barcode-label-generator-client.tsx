"use client";

import { useMemo, useState } from "react";
import { Download, Minus, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { VariantPicker, type VariantOption } from "@/components/inventory/variant-picker";

type LabelLine = {
  variant: VariantOption;
  copies: number;
};

export function BarcodeLabelGeneratorClient() {
  const [lines, setLines] = useState<LabelLine[]>([]);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const totalLabels = useMemo(
    () => lines.reduce((sum, line) => sum + line.copies, 0),
    [lines]
  );
  const missingBarcodeLines = lines.filter((line) => !line.variant.barcode?.trim());

  const addVariant = (variant: VariantOption) => {
    setMessage(null);
    setLines((current) => {
      if (current.some((line) => line.variant.id === variant.id)) {
        return current.map((line) =>
          line.variant.id === variant.id ? { ...line, copies: line.copies + 1 } : line
        );
      }
      return [...current, { variant, copies: 1 }];
    });
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
      const link = document.createElement("a");
      link.href = url;
      link.download = `bentop-barcode-labels-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setMessage(`Generated ${totalLabels} label${totalLabels === 1 ? "" : "s"}.`);
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
                Search or paste SKU/barcode lists to prepare 35 mm x 25 mm sticker labels.
              </p>
            </div>
            <VariantPicker
              onSelect={addVariant}
              excludeIds={lines.map((line) => line.variant.id)}
              placeholder="Search SKU, barcode, or product name..."
            />
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
    </div>
  );
}
