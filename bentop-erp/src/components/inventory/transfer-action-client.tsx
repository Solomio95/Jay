"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TransferStatus } from "@prisma/client";

type Props = {
  transferId: string;
  status: TransferStatus;
  canApprove: boolean;
  canComplete: boolean;
  canCancel: boolean;
};

export function TransferActionClient({
  transferId,
  status,
  canApprove,
  canComplete,
  canCancel,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");

  const doAction = async (action: "APPROVE" | "COMPLETE" | "CANCEL") => {
    if (action === "CANCEL" && !confirm("Cancel this transfer and release reserved stock?")) {
      return;
    }
    setLoading(action);
    setError("");
    const res = await fetch(`/api/v1/transfers/${transferId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setLoading(null);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error?.message || "Failed");
      return;
    }
    router.refresh();
  };

  const isTerminal = status === "COMPLETED" || status === "CANCELLED";
  if (isTerminal) return null;

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        {status === "REQUESTED" && canApprove && (
          <Button onClick={() => doAction("APPROVE")} disabled={loading !== null} size="sm">
            <Check className="mr-2 h-4 w-4" />
            {loading === "APPROVE" ? "Approving..." : "Approve"}
          </Button>
        )}
        {status === "APPROVED" && canComplete && (
          <Button onClick={() => doAction("COMPLETE")} disabled={loading !== null} size="sm">
            <CheckCircle2 className="mr-2 h-4 w-4" />
            {loading === "COMPLETE" ? "Completing..." : "Complete"}
          </Button>
        )}
        {canCancel && (
          <Button
            onClick={() => doAction("CANCEL")}
            disabled={loading !== null}
            size="sm"
            variant="outline"
          >
            <X className="mr-2 h-4 w-4" />
            {loading === "CANCEL" ? "Cancelling..." : "Cancel"}
          </Button>
        )}
      </div>
      {error && <div className="text-xs text-destructive">{error}</div>}
    </div>
  );
}
