"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Send, DollarSign, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/utils";

type Item = {
  id: string;
  sku: string;
  productName: string;
  color: string;
  size: string;
  quantityShipped: number;
  quantitySold: number;
  quantityReturned: number;
  unitPrice: number;
};

type Props = {
  shipmentId: string;
  status: string;
  items: Item[];
};

type OpenDialog = null | "ship" | "record-sales" | "settle" | "cancel";

export function ConsignmentShipmentActions({ shipmentId, status, items }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState<OpenDialog>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Ship dialog state
  const [shipNotes, setShipNotes] = useState("");

  // Record-sales state: map itemId -> additional qty to record as sold
  const [soldEntries, setSoldEntries] = useState<Record<string, number>>({});
  const [recordNotes, setRecordNotes] = useState("");

  // Settle state
  const [returnUnsold, setReturnUnsold] = useState(true);
  const [settleNotes, setSettleNotes] = useState("");

  // Cancel state
  const [cancelReason, setCancelReason] = useState("");

  const closeAll = () => {
    setOpen(null);
    setError("");
    setShipNotes("");
    setSoldEntries({});
    setRecordNotes("");
    setReturnUnsold(true);
    setSettleNotes("");
    setCancelReason("");
  };

  const callApi = async (path: string, body: unknown) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/v1/consignment/shipments/${shipmentId}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message || "Action failed");
        setLoading(false);
        return false;
      }
      setLoading(false);
      closeAll();
      router.refresh();
      return true;
    } catch {
      setError("Network error — please try again");
      setLoading(false);
      return false;
    }
  };

  const onShip = () => callApi("/ship", { notes: shipNotes || undefined });

  const onRecordSales = () => {
    const entries = Object.entries(soldEntries)
      .filter(([, q]) => q > 0)
      .map(([itemId, quantitySold]) => ({ itemId, quantitySold }));
    if (entries.length === 0) {
      setError("Enter at least one quantity");
      return;
    }
    return callApi("/record-sales", { entries, notes: recordNotes || undefined });
  };

  const onSettle = () =>
    callApi("/settle", { returnUnsold, notes: settleNotes || undefined });

  const onCancel = () =>
    callApi("/cancel", { reason: cancelReason || undefined });

  const canShip = status === "DRAFT";
  const canRecordSales = status === "SHIPPED" || status === "PARTIAL_SETTLED";
  const canSettle = status === "SHIPPED" || status === "PARTIAL_SETTLED";
  const canCancel = status !== "SETTLED" && status !== "CANCELLED";

  return (
    <div className="flex flex-wrap gap-2">
      {canShip && (
        <Button onClick={() => setOpen("ship")} size="sm">
          <Send className="h-4 w-4 mr-1.5" />
          Ship
        </Button>
      )}
      {canRecordSales && (
        <Button asChild size="sm" variant="default">
          <Link href={`/consignment/shipments/${shipmentId}/reports/new`}>
            <DollarSign className="h-4 w-4 mr-1.5" />
            New Report
          </Link>
        </Button>
      )}
      {canSettle && (
        <Button onClick={() => setOpen("settle")} size="sm" variant="outline">
          <CheckCircle2 className="h-4 w-4 mr-1.5" />
          Settle
        </Button>
      )}
      {canCancel && (
        <Button
          onClick={() => setOpen("cancel")}
          size="sm"
          variant="outline"
          className="text-destructive"
        >
          <XCircle className="h-4 w-4 mr-1.5" />
          Cancel
        </Button>
      )}

      {/* Ship dialog */}
      <Dialog open={open === "ship"} onOpenChange={(o) => !o && closeAll()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ship Consignment</DialogTitle>
            <DialogDescription>
              Stock will move from the source to the consignee location and a CONSIGNMENT_OUT
              movement will be recorded. This cannot be undone except by cancellation.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea
              rows={2}
              value={shipNotes}
              onChange={(e) => setShipNotes(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeAll} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={onShip} disabled={loading}>
              {loading ? "Shipping..." : "Confirm Ship"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record sales dialog */}
      <Dialog open={open === "record-sales"} onOpenChange={(o) => !o && closeAll()}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Record Sales</DialogTitle>
            <DialogDescription>
              Enter additional units sold by the consignee since the last update.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          <div className="border rounded-lg max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2">SKU / Variant</th>
                  <th className="text-right px-3 py-2">Remaining</th>
                  <th className="text-right px-3 py-2">Unit Price</th>
                  <th className="w-28 px-3 py-2">Sold now</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((i) => {
                  const remaining = i.quantityShipped - i.quantitySold - i.quantityReturned;
                  return (
                    <tr key={i.id}>
                      <td className="px-3 py-2">
                        <div className="font-mono text-xs">{i.sku}</div>
                        <div className="text-xs text-muted-foreground">
                          {i.productName} · {i.color} · {i.size}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right">{remaining}</td>
                      <td className="px-3 py-2 text-right">
                        {formatCurrency(i.unitPrice, "MYR")}
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          min={0}
                          max={remaining}
                          disabled={remaining <= 0}
                          value={soldEntries[i.id] ?? ""}
                          onChange={(e) =>
                            setSoldEntries((prev) => ({
                              ...prev,
                              [i.id]: Math.max(
                                0,
                                Math.min(remaining, Number(e.target.value) || 0)
                              ),
                            }))
                          }
                          className="w-24"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea
              rows={2}
              value={recordNotes}
              onChange={(e) => setRecordNotes(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeAll} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={onRecordSales} disabled={loading}>
              {loading ? "Recording..." : "Record Sales"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settle dialog */}
      <Dialog open={open === "settle"} onOpenChange={(o) => !o && closeAll()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Settle Consignment</DialogTitle>
            <DialogDescription>
              Finalize this consignment. Unsold units can be returned to the source location
              automatically.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          <div className="flex items-center gap-2">
            <Checkbox
              id="returnUnsold"
              checked={returnUnsold}
              onCheckedChange={(v) => setReturnUnsold(Boolean(v))}
            />
            <Label htmlFor="returnUnsold" className="text-sm cursor-pointer">
              Return unsold units to the source location
            </Label>
          </div>
          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea
              rows={2}
              value={settleNotes}
              onChange={(e) => setSettleNotes(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeAll} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={onSettle} disabled={loading}>
              {loading ? "Settling..." : "Confirm Settlement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel dialog */}
      <Dialog open={open === "cancel"} onOpenChange={(o) => !o && closeAll()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Shipment</DialogTitle>
            <DialogDescription>
              Any remaining consignee stock will be returned to the source location. Already-sold
              units stay attributed to this shipment.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label>Reason (optional)</Label>
            <Textarea
              rows={2}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeAll} disabled={loading}>
              Keep
            </Button>
            <Button variant="destructive" onClick={onCancel} disabled={loading}>
              {loading ? "Cancelling..." : "Cancel Shipment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
