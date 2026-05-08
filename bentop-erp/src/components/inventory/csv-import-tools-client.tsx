"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Download, FileCheck2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

type ImportType = "product-variants" | "locations" | "consignment-partners" | "opening-stock";

type ValidationError = {
  rowNumber: number;
  messages: string[];
};

type ValidationResult = {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errors: ValidationError[];
};

type ApplySummary = {
  created: number;
  updated: number;
  skipped: number;
};

const importOptions: { value: ImportType; label: string }[] = [
  { value: "product-variants", label: "Product variants" },
  { value: "locations", label: "Locations" },
  { value: "consignment-partners", label: "Consignment partners" },
  { value: "opening-stock", label: "Opening stock" },
];

export function CsvImportToolsClient() {
  const [type, setType] = useState<ImportType>("product-variants");
  const [csv, setCsv] = useState("");
  const [confirm, setConfirm] = useState("");
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [summary, setSummary] = useState<ApplySummary | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const templateUrl = useMemo(() => `/api/v1/imports/templates/${type}`, [type]);
  const canApply = Boolean(csv.trim()) && validation?.invalidRows === 0 && confirm === "IMPORT";

  async function postImportRequest(dryRun: boolean) {
    setLoading(true);
    setMessage("");
    setSummary(null);
    try {
      const response = await fetch(dryRun ? "/api/v1/imports/validate" : "/api/v1/imports/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dryRun ? { type, csv } : { type, csv, dryRun: false, confirm }),
      });
      const json = await response.json();
      if (!response.ok) {
        setMessage(json.error?.message ?? "Import request failed.");
        return;
      }

      const result = dryRun ? json.data : json.data?.validation;
      setValidation(result ?? null);
      if (!dryRun) {
        setSummary(json.data?.summary ?? null);
        setMessage("Import applied.");
      } else {
        setMessage(result?.invalidRows ? "Fix row errors before importing." : "CSV is ready for dry-run/apply.");
      }
    } catch {
      setMessage("Network error while checking import.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <div className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="importType">Import type</Label>
          <Select value={type} onValueChange={(value) => setType(value as ImportType)}>
            <SelectTrigger id="importType">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {importOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
          <Button asChild variant="outline" size="sm">
            <a href={templateUrl}>
              <Download className="h-4 w-4" />
              Template
            </a>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!csv.trim() || loading}
            onClick={() => postImportRequest(true)}
          >
            <FileCheck2 className="h-4 w-4" />
            Validate
          </Button>
        </div>
        <div className="space-y-2">
          <Label htmlFor="importConfirm">Apply confirmation</Label>
          <input
            id="importConfirm"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            placeholder='Type "IMPORT"'
          />
        </div>
        <Button
          type="button"
          className="w-full"
          disabled={!canApply || loading}
          onClick={() => postImportRequest(false)}
        >
          <Upload className="h-4 w-4" />
          Apply Import
        </Button>
      </div>

      <div className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="csvText">CSV rows</Label>
          <Textarea
            id="csvText"
            value={csv}
            onChange={(event) => {
              setCsv(event.target.value);
              setValidation(null);
              setSummary(null);
              setMessage("");
            }}
            rows={9}
            placeholder="Paste CSV header and rows here"
          />
        </div>

        {validation && (
          <div className="rounded-md border p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={validation.invalidRows ? "warning" : "success"}>
                {validation.validRows}/{validation.totalRows} valid
              </Badge>
              <span className="text-muted-foreground">
                {validation.invalidRows} row error{validation.invalidRows === 1 ? "" : "s"}
              </span>
            </div>
            {validation.errors.length > 0 && (
              <div className="mt-3 space-y-2">
                {validation.errors.slice(0, 8).map((error) => (
                  <div key={error.rowNumber} className="rounded-md bg-muted/60 p-2">
                    <div className="font-medium">Row {error.rowNumber}</div>
                    <div className="text-muted-foreground">{error.messages.join("; ")}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {summary && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-900">
            <CheckCircle2 className="h-4 w-4" />
            Created {summary.created}, updated {summary.updated}, skipped {summary.skipped}.
          </div>
        )}

        {message && <p className="text-sm text-muted-foreground">{message}</p>}
      </div>
    </div>
  );
}
