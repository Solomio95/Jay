"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { WalletCards } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";

const PAYMENT_METHODS = [
  ["BANK_TRANSFER", "Bank transfer"],
  ["EWALLET", "Ewallet"],
  ["CARD", "Card"],
  ["CHEQUE", "Cheque"],
  ["OTHER", "Other"],
] as const;

export function InvoicePaymentForm({
  invoiceId,
  outstandingAmount,
  disabled,
}: {
  invoiceId: string;
  outstandingAmount: number;
  disabled: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  async function submit(formData: FormData) {
    setError("");
    const amount = Number(formData.get("amount"));
    const response = await fetch(`/api/v1/consignment/invoices/${invoiceId}/payments`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        paymentDate: formData.get("paymentDate") || undefined,
        amount,
        paymentMethod: formData.get("paymentMethod"),
        referenceNumber: formData.get("referenceNumber") || undefined,
        notes: formData.get("notes") || undefined,
      }),
    });

    if (!response.ok) {
      const json = await response.json().catch(() => null);
      setError(json?.error?.message ?? "Could not record payment");
      return;
    }

    startTransition(() => router.refresh());
  }

  if (disabled) {
    return (
      <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
        No payment can be recorded because this invoice is already settled or void.
      </div>
    );
  }

  return (
    <form action={submit} className="space-y-3 rounded-md border p-3">
      <div className="text-sm font-medium">Record Payment</div>
      <div className="text-xs text-muted-foreground">
        Outstanding: {formatCurrency(outstandingAmount, "MYR")}
      </div>
      <div className="grid gap-2">
        <Input name="paymentDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
        <Input
          name="amount"
          type="number"
          min="0.01"
          max={outstandingAmount.toFixed(2)}
          step="0.01"
          defaultValue={outstandingAmount.toFixed(2)}
          required
        />
        <select name="paymentMethod" defaultValue="BANK_TRANSFER" className="h-10 rounded-md border bg-background px-3 text-sm">
          {PAYMENT_METHODS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <Input name="referenceNumber" placeholder="Reference number" maxLength={100} />
        <Input name="notes" placeholder="Notes" maxLength={1000} />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={isPending} className="w-full">
        <WalletCards className="mr-2 h-4 w-4" />
        Save Payment
      </Button>
    </form>
  );
}
