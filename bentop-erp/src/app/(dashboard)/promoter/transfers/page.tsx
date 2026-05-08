"use client";

import { useEffect, useState } from "react";

type Transfer = {
  id: string;
  transferNumber: string;
  status: string;
  fromLocation: { name: string };
  toLocation: { name: string };
  items: Array<{ quantity: number; productVariant: { sku: string; product: { name: string } } }>;
};

export default function PromoterTransfersPage() {
  const [transfers, setTransfers] = useState<Transfer[]>([]);

  useEffect(() => {
    fetch("/api/v1/transfers")
      .then((res) => res.json())
      .then((json) => setTransfers(json.data ?? []));
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Transfer Requests</h2>
        <p className="text-sm text-muted-foreground">Requests sent to supervisor first, then escalated after 4 hours.</p>
      </div>
      <section className="overflow-hidden rounded-md border bg-background">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="p-2">Transfer</th>
              <th className="p-2">Route</th>
              <th className="p-2">Items</th>
              <th className="p-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {transfers.map((transfer) => (
              <tr key={transfer.id} className="border-t">
                <td className="p-2 font-medium">{transfer.transferNumber}</td>
                <td className="p-2">
                  {transfer.fromLocation.name} to {transfer.toLocation.name}
                </td>
                <td className="p-2">
                  {transfer.items.map((item) => `${item.productVariant.sku} x ${item.quantity}`).join(", ")}
                </td>
                <td className="p-2">{transfer.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
