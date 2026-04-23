"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  initialSearch: string;
  initialStatus: string;
  initialPayment: string;
  initialChannel: string;
  channels: { id: string; name: string }[];
};

const ORDER_STATUSES = [
  "DRAFT",
  "CONFIRMED",
  "PROCESSING",
  "PACKED",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "RETURNED",
] as const;

const PAYMENT_STATUSES = ["UNPAID", "PARTIAL", "PAID", "REFUNDED"] as const;

export function OrdersFilterBar({
  initialSearch,
  initialStatus,
  initialPayment,
  initialChannel,
  channels,
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [search, setSearch] = useState(initialSearch);
  const [status, setStatus] = useState(initialStatus);
  const [payment, setPayment] = useState(initialPayment);
  const [channel, setChannel] = useState(initialChannel);

  const apply = (next: Partial<{ search: string; status: string; payment: string; channel: string }>) => {
    const params = new URLSearchParams();
    const s = next.search ?? search;
    const st = next.status ?? status;
    const p = next.payment ?? payment;
    const ch = next.channel ?? channel;
    if (s) params.set("search", s);
    if (st) params.set("status", st);
    if (p) params.set("paymentStatus", p);
    if (ch) params.set("salesChannelId", ch);
    startTransition(() => {
      router.push(`/sales/orders${params.toString() ? `?${params}` : ""}`);
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-3 mb-4">
      <div className="relative flex-1 min-w-[220px] max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") apply({ search });
          }}
          placeholder="Search order # or customer..."
          className="pl-9"
        />
      </div>
      <Select
        value={status || "ALL"}
        onValueChange={(v) => {
          const next = v === "ALL" ? "" : v;
          setStatus(next);
          apply({ status: next });
        }}
      >
        <SelectTrigger className="w-40">
          <SelectValue placeholder="All statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All statuses</SelectItem>
          {ORDER_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={payment || "ALL"}
        onValueChange={(v) => {
          const next = v === "ALL" ? "" : v;
          setPayment(next);
          apply({ payment: next });
        }}
      >
        <SelectTrigger className="w-36">
          <SelectValue placeholder="Payment" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All payments</SelectItem>
          {PAYMENT_STATUSES.map((p) => (
            <SelectItem key={p} value={p}>
              {p}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {channels.length > 0 && (
        <Select
          value={channel || "ALL"}
          onValueChange={(v) => {
            const next = v === "ALL" ? "" : v;
            setChannel(next);
            apply({ channel: next });
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All channels" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All channels</SelectItem>
            {channels.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <Button variant="outline" onClick={() => apply({ search })}>
        Apply
      </Button>
    </div>
  );
}
