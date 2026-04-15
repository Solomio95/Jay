"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { CheckCircle, Package, Truck, XCircle, Undo2, ShieldCheck } from "lucide-react";

type OrderStatus =
  | "DRAFT"
  | "CONFIRMED"
  | "PROCESSING"
  | "PACKED"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "RETURNED";

type PaymentStatus = "UNPAID" | "PARTIAL" | "PAID" | "REFUNDED";

const NEXT_ACTIONS: Partial<
  Record<OrderStatus, { label: string; to: OrderStatus; icon: React.ReactNode; variant?: "default" | "destructive" | "outline" }[]>
> = {
  DRAFT: [
    { label: "Confirm", to: "CONFIRMED", icon: <CheckCircle className="h-4 w-4" /> },
    { label: "Cancel", to: "CANCELLED", icon: <XCircle className="h-4 w-4" />, variant: "outline" },
  ],
  CONFIRMED: [
    { label: "Start Processing", to: "PROCESSING", icon: <Package className="h-4 w-4" /> },
    { label: "Cancel", to: "CANCELLED", icon: <XCircle className="h-4 w-4" />, variant: "outline" },
  ],
  PROCESSING: [
    { label: "Mark Packed", to: "PACKED", icon: <Package className="h-4 w-4" /> },
    { label: "Cancel", to: "CANCELLED", icon: <XCircle className="h-4 w-4" />, variant: "outline" },
  ],
  PACKED: [
    { label: "Mark Shipped", to: "SHIPPED", icon: <Truck className="h-4 w-4" /> },
    { label: "Cancel", to: "CANCELLED", icon: <XCircle className="h-4 w-4" />, variant: "outline" },
  ],
  SHIPPED: [
    { label: "Mark Delivered", to: "DELIVERED", icon: <CheckCircle className="h-4 w-4" /> },
    { label: "Return", to: "RETURNED", icon: <Undo2 className="h-4 w-4" />, variant: "outline" },
  ],
  DELIVERED: [{ label: "Return", to: "RETURNED", icon: <Undo2 className="h-4 w-4" />, variant: "outline" }],
};

type Props = {
  orderId: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: string | null;
  paymentReference: string | null;
  canEdit: boolean;
};

export function OrderStatusActions({ orderId, status, paymentStatus, paymentMethod, paymentReference, canEdit }: Props) {
  const router = useRouter();
  const [transitionDialog, setTransitionDialog] = useState<OrderStatus | null>(null);
  const [paymentDialog, setPaymentDialog] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [payForm, setPayForm] = useState({
    paymentStatus,
    paymentMethod: paymentMethod ?? "",
    paymentReference: paymentReference ?? "",
  });

  const actions = NEXT_ACTIONS[status] ?? [];

  const submitTransition = async () => {
    if (!transitionDialog) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/v1/orders/${orderId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toStatus: transitionDialog, reason: reason || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message || "Failed to update status");
        return;
      }
      setTransitionDialog(null);
      setReason("");
      router.refresh();
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  };

  const submitPayment = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/v1/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentStatus: payForm.paymentStatus,
          paymentMethod: payForm.paymentMethod || undefined,
          paymentReference: payForm.paymentReference || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message || "Failed to update payment");
        return;
      }
      setPaymentDialog(false);
      router.refresh();
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  };

  if (!canEdit) return null;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {actions.map((a) => (
          <Button
            key={a.to}
            variant={a.variant ?? "default"}
            onClick={() => {
              setReason("");
              setError("");
              setTransitionDialog(a.to);
            }}
          >
            {a.icon}
            <span className="ml-1">{a.label}</span>
          </Button>
        ))}
        <Button variant="outline" onClick={() => setPaymentDialog(true)}>
          <ShieldCheck className="h-4 w-4 mr-1" />
          Update Payment
        </Button>
      </div>

      <Dialog
        open={transitionDialog !== null}
        onOpenChange={(open) => !open && setTransitionDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change status to {transitionDialog}</DialogTitle>
            <DialogDescription>
              {transitionDialog === "CONFIRMED" && "This will reserve inventory at the order's fulfillment location."}
              {transitionDialog === "PROCESSING" && "This will deduct stock from the fulfillment location using FIFO."}
              {transitionDialog === "CANCELLED" && "This will release any reservation and restore deducted stock."}
              {transitionDialog === "RETURNED" && "This will restore stock to the fulfillment location."}
            </DialogDescription>
          </DialogHeader>
          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="reason">Reason / notes (optional)</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransitionDialog(null)}>Cancel</Button>
            <Button onClick={submitTransition} disabled={loading}>
              {loading ? "Saving..." : `Confirm ${transitionDialog}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={paymentDialog} onOpenChange={setPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Payment</DialogTitle>
            <DialogDescription>
              Record a payment update against this order.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="payStatus">Status</Label>
              <Select
                value={payForm.paymentStatus}
                onValueChange={(v) => setPayForm({ ...payForm, paymentStatus: v as PaymentStatus })}
              >
                <SelectTrigger id="payStatus">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UNPAID">Unpaid</SelectItem>
                  <SelectItem value="PARTIAL">Partial</SelectItem>
                  <SelectItem value="PAID">Paid</SelectItem>
                  <SelectItem value="REFUNDED">Refunded</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="payMethod">Method</Label>
              <Input
                id="payMethod"
                value={payForm.paymentMethod}
                onChange={(e) => setPayForm({ ...payForm, paymentMethod: e.target.value })}
                placeholder="Cash, Bank Transfer, Card..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payRef">Reference</Label>
              <Input
                id="payRef"
                value={payForm.paymentReference}
                onChange={(e) => setPayForm({ ...payForm, paymentReference: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialog(false)}>Cancel</Button>
            <Button onClick={submitPayment} disabled={loading}>
              {loading ? "Saving..." : "Save payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
