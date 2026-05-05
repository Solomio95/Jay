"use client";

import { useEffect, useState } from "react";

type LeaderboardRow = {
  rank: number;
  promoterName: string;
  locationName: string;
  netSalesAmount: number;
  netQuantity: number;
  tierName: string | null;
};

export default function PromoterLeaderboardPage() {
  const [month] = useState(() => new Date().toISOString().slice(0, 7));
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [groupName, setGroupName] = useState("");

  useEffect(() => {
    fetch(`/api/v1/promoter/leaderboard?month=${month}`)
      .then((res) => res.json())
      .then((json) => {
        setRows(json.data?.rows ?? []);
        setGroupName(json.data?.group?.name ?? "Monthly Leaderboard");
      });
  }, [month]);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Monthly Leaderboard</h2>
        <p className="text-sm text-muted-foreground">{groupName} / {month}</p>
      </div>
      <section className="overflow-hidden rounded-md border bg-background">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="p-2">Rank</th>
              <th className="p-2">Promoter</th>
              <th className="p-2">Tier</th>
              <th className="p-2 text-right">Sales</th>
              <th className="p-2 text-right">Qty</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.rank} className="border-t">
                <td className="p-2 font-semibold">#{row.rank}</td>
                <td className="p-2">
                  <div className="font-medium">{row.promoterName}</div>
                  <div className="text-xs text-muted-foreground">{row.locationName}</div>
                </td>
                <td className="p-2">{row.tierName ?? "-"}</td>
                <td className="p-2 text-right">RM {row.netSalesAmount.toFixed(2)}</td>
                <td className="p-2 text-right">{row.netQuantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
