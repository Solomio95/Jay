"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { COLLECTION_STATUSES } from "@/lib/validators/collections";
import { collectionStatusLabel, type CollectionStatus } from "@/lib/consignment/collections";

export function CollectionFollowUpForm({
  invoiceId,
  defaultStatus,
}: {
  invoiceId: string;
  defaultStatus: CollectionStatus;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  async function submit(formData: FormData) {
    setError("");
    const response = await fetch(`/api/v1/consignment/invoices/${invoiceId}/follow-ups`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        collectionStatus: formData.get("collectionStatus"),
        note: formData.get("note"),
        nextFollowUpDate: formData.get("nextFollowUpDate") || null,
      }),
    });

    if (!response.ok) {
      const json = await response.json().catch(() => null);
      setError(json?.error?.message ?? "Could not record follow-up");
      return;
    }

    startTransition(() => router.refresh());
  }

  return (
    <form action={submit} className="space-y-2 rounded-md border p-3">
      <div className="grid gap-2 md:grid-cols-[160px_1fr_150px_auto]">
        <select
          name="collectionStatus"
          defaultValue={defaultStatus}
          className="h-10 rounded-md border bg-background px-3 text-sm"
        >
          {COLLECTION_STATUSES.map((status) => (
            <option key={status} value={status}>
              {collectionStatusLabel(status)}
            </option>
          ))}
        </select>
        <Input name="note" placeholder="Follow-up note" required maxLength={2000} />
        <Input name="nextFollowUpDate" type="date" />
        <Button type="submit" disabled={isPending}>
          <MessageSquarePlus className="mr-2 h-4 w-4" />
          Add
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </form>
  );
}
