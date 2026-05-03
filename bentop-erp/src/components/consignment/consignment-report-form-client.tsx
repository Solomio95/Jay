"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Save, Send } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { calculateCommission, type CommissionTier } from "@/lib/consignment/commission";
import { formatCurrency } from "@/lib/utils";

type ReportItem = {
  id: string;
  productId: string;
  productName: string;
  productVariantId: string;
  sku: string;
  color: string;
  size: string;
  colorHex: string | null;
  quantityShipped: number;
  quantitySold: number;
  quantityReturned: number;
  unitPrice: number;
};

type Override = {
  productId: string | null;
  productVariantId: string | null;
  tierName: string;
  commissionRate: number;
};

type LineState = {
  quantitySold: string;
  quantityReturned: string;
  actualUnitPrice: string;
};

type Props = {
  shipmentId: string;
  shipmentNumber: string;
  partnerName: string;
  items: ReportItem[];
  tiers: CommissionTier[];
  overrides: Override[];
};

export function ConsignmentReportFormClient({
  shipmentId,
  shipmentNumber,
  partnerName,
  items,
  tiers,
  overrides,
}: Props) {
  const router = useRouter();
  const [periodStart, setPeriodStart] = useState(todayInputValue());
  const [periodEnd, setPeriodEnd] = useState(todayInputValue());
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Record<string, LineState>>(() =>
    Object.fromEntries(
      items.map((item) => [
        item.id,
        {
          quantitySold: "",
          quantityReturned: "",
          actualUnitPrice: item.unitPrice ? String(item.unitPrice) : "",
        },
      ]),
    ),
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const previews = useMemo(
    () =>
      items.map((item) => {
        const state = lines[item.id];
        const quantitySold = Number(state?.quantitySold) || 0;
        const quantityReturned = Number(state?.quantityReturned) || 0;
        const actualUnitPrice = Number(state?.actualUnitPrice) || 0;
        const remaining = item.quantityShipped - item.quantitySold - item.quantityReturned;
        const override = findOverride(item, overrides);
        const commission =
          quantitySold > 0
            ? calculateCommission({ actualUnitPrice, quantitySold, tiers, override })
            : null;

        return {
          item,
          quantitySold,
          quantityReturned,
          actualUnitPrice,
          remaining,
          over: quantitySold + quantityReturned > remaining,
          tierName: commission?.tierName ?? override?.tierName ?? "-",
          commissionRate: commission?.commissionRate ?? override?.commissionRate ?? 0,
          grossAmount: commission?.grossAmount ?? 0,
          commissionAmount: commission?.commissionAmount ?? 0,
          netAmount: commission?.netAmount ?? 0,
        };
      }),
    [items, lines, overrides, tiers],
  );

  const groupedSummary = useMemo(() => {
    return Object.values(
      previews.reduce<
        Record<
          string,
          {
            productId: string;
            productName: string;
            sold: number;
            returned: number;
            grossAmount: number;
            commissionAmount: number;
            netAmount: number;
          }
        >
      >((groups, preview) => {
        groups[preview.item.productId] ??= {
          productId: preview.item.productId,
          productName: preview.item.productName,
          sold: 0,
          returned: 0,
          grossAmount: 0,
          commissionAmount: 0,
          netAmount: 0,
        };
        groups[preview.item.productId].sold += preview.quantitySold;
        groups[preview.item.productId].returned += preview.quantityReturned;
        groups[preview.item.productId].grossAmount += preview.grossAmount;
        groups[preview.item.productId].commissionAmount += preview.commissionAmount;
        groups[preview.item.productId].netAmount += preview.netAmount;
        return groups;
      }, {}),
    ).filter((row) => row.sold > 0 || row.returned > 0);
  }, [previews]);

  const totals = groupedSummary.reduce(
    (sum, row) => ({
      sold: sum.sold + row.sold,
      returned: sum.returned + row.returned,
      grossAmount: sum.grossAmount + row.grossAmount,
      commissionAmount: sum.commissionAmount + row.commissionAmount,
      netAmount: sum.netAmount + row.netAmount,
    }),
    { sold: 0, returned: 0, grossAmount: 0, commissionAmount: 0, netAmount: 0 },
  );

  const submit = async (finalize: boolean) => {
    setLoading(true);
    setError("");
    try {
      const payload = {
        periodStart,
        periodEnd,
        notes: notes.trim() || undefined,
        finalize,
        lines: previews
          .filter((preview) => preview.quantitySold > 0 || preview.quantityReturned > 0)
          .map((preview) => ({
            shipmentItemId: preview.item.id,
            quantitySold: preview.quantitySold,
            quantityReturned: preview.quantityReturned,
            actualUnitPrice: preview.actualUnitPrice,
          })),
      };

      const response = await fetch(`/api/v1/consignment/shipments/${shipmentId}/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error?.message || "Failed to save report");
        return;
      }
      router.push(`/consignment/shipments/${shipmentId}`);
      router.refresh();
    } catch {
      setError("Network error - please try again");
    } finally {
      setLoading(false);
    }
  };

  const hasLines = previews.some((preview) => preview.quantitySold > 0 || preview.quantityReturned > 0);
  const hasOverages = previews.some((preview) => preview.over);

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <div className="space-y-2">
          <Label>Shipment</Label>
          <Input value={shipmentNumber} disabled />
        </div>
        <div className="space-y-2">
          <Label>Partner</Label>
          <Input value={partnerName} disabled />
        </div>
        <div className="space-y-2">
          <Label>Period Start</Label>
          <Input type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Period End</Label>
          <Input type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        <Metric label="Sold Units" value={totals.sold.toLocaleString()} />
        <Metric label="Returned Units" value={totals.returned.toLocaleString()} />
        <Metric label="Gross Sales" value={formatCurrency(totals.grossAmount, "MYR")} />
        <Metric label="Commission" value={formatCurrency(totals.commissionAmount, "MYR")} />
        <Metric label="Net To Bentop" value={formatCurrency(totals.netAmount, "MYR")} />
      </div>

      {groupedSummary.length > 0 && (
        <div className="rounded-lg border">
          <div className="border-b bg-muted/30 px-4 py-3 text-sm font-medium">
            Product Summary
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">Product</th>
                  <th className="px-4 py-2 text-right">Sold</th>
                  <th className="px-4 py-2 text-right">Returned</th>
                  <th className="px-4 py-2 text-right">Gross</th>
                  <th className="px-4 py-2 text-right">Commission</th>
                  <th className="px-4 py-2 text-right">Net</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {groupedSummary.map((row) => (
                  <tr key={row.productId}>
                    <td className="px-4 py-2 font-medium">{row.productName}</td>
                    <td className="px-4 py-2 text-right">{row.sold}</td>
                    <td className="px-4 py-2 text-right">{row.returned}</td>
                    <td className="px-4 py-2 text-right">{formatCurrency(row.grossAmount, "MYR")}</td>
                    <td className="px-4 py-2 text-right">{formatCurrency(row.commissionAmount, "MYR")}</td>
                    <td className="px-4 py-2 text-right font-medium">{formatCurrency(row.netAmount, "MYR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="rounded-lg border">
        <div className="border-b bg-muted/30 px-4 py-3 text-sm font-medium">
          SKU Details
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">SKU / Variant</th>
                <th className="px-3 py-2 text-right">Remaining</th>
                <th className="px-3 py-2 text-right">Sold</th>
                <th className="px-3 py-2 text-right">Returned</th>
                <th className="px-3 py-2 text-right">Selling Price</th>
                <th className="px-3 py-2 text-left">Group</th>
                <th className="px-3 py-2 text-right">Net</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {previews.map((preview) => (
                <tr key={preview.item.id}>
                  <td className="px-3 py-2">
                    <div className="font-mono text-xs">{preview.item.sku}</div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full ring-1 ring-border"
                        style={{ backgroundColor: preview.item.colorHex || "#999" }}
                      />
                      {preview.item.productName} - {preview.item.color} {preview.item.size}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">{preview.remaining}</td>
                  <td className="px-3 py-2">
                    <Input
                      className={`ml-auto w-24 text-right ${preview.over ? "border-destructive" : ""}`}
                      type="number"
                      min={0}
                      max={preview.remaining}
                      value={lines[preview.item.id]?.quantitySold ?? ""}
                      onChange={(event) =>
                        setLines((current) => ({
                          ...current,
                          [preview.item.id]: {
                            ...current[preview.item.id],
                            quantitySold: event.target.value,
                          },
                        }))
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      className={`ml-auto w-24 text-right ${preview.over ? "border-destructive" : ""}`}
                      type="number"
                      min={0}
                      max={preview.remaining}
                      value={lines[preview.item.id]?.quantityReturned ?? ""}
                      onChange={(event) =>
                        setLines((current) => ({
                          ...current,
                          [preview.item.id]: {
                            ...current[preview.item.id],
                            quantityReturned: event.target.value,
                          },
                        }))
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      className="ml-auto w-28 text-right"
                      type="number"
                      min={0}
                      step="0.01"
                      value={lines[preview.item.id]?.actualUnitPrice ?? ""}
                      onChange={(event) =>
                        setLines((current) => ({
                          ...current,
                          [preview.item.id]: {
                            ...current[preview.item.id],
                            actualUnitPrice: event.target.value,
                          },
                        }))
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={preview.commissionRate > 0 ? "secondary" : "outline"}>
                      {preview.tierName}
                      {preview.commissionRate > 0 ? ` ${preview.commissionRate}%` : ""}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-right font-medium">
                    {formatCurrency(preview.netAmount, "MYR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Notes</Label>
        <Textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} />
      </div>

      {hasOverages && (
        <div className="text-sm text-destructive">
          One or more lines report more units than remain on the shipment.
        </div>
      )}

      <div className="flex items-center justify-between border-t pt-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FileText className="h-4 w-4" />
          Finalizing creates stock movements and an issued invoice.
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={!hasLines || hasOverages || loading}
            onClick={() => submit(false)}
          >
            <Save className="mr-2 h-4 w-4" />
            Save Draft
          </Button>
          <Button disabled={!hasLines || hasOverages || loading} onClick={() => submit(true)}>
            <Send className="mr-2 h-4 w-4" />
            {loading ? "Saving..." : "Finalize And Invoice"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}

function findOverride(item: ReportItem, overrides: Override[]) {
  const override =
    overrides.find((entry) => entry.productVariantId === item.productVariantId) ??
    overrides.find((entry) => entry.productId === item.productId);

  return override
    ? { tierName: override.tierName, commissionRate: override.commissionRate }
    : null;
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}
