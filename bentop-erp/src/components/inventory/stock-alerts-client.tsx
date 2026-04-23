"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, AlertTriangle, AlertOctagon, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type AlertRow = {
  id: string;
  alertType: "LOW_STOCK" | "OUT_OF_STOCK" | "OVERSTOCK";
  threshold: number;
  currentQuantity: number;
  isAcknowledged: boolean;
  acknowledgedAt: string | null;
  createdAt: string;
  productVariant: {
    sku: string;
    size: string;
    color: string;
    product: { name: string };
  };
  location: { name: string; type: string };
  acknowledgedBy: { name: string } | null;
};

type Props = {
  initialAlerts: AlertRow[];
  canAcknowledge: boolean;
};

const ALERT_ICONS = {
  LOW_STOCK: AlertTriangle,
  OUT_OF_STOCK: AlertOctagon,
  OVERSTOCK: TrendingUp,
};

const ALERT_COLORS: Record<string, string> = {
  LOW_STOCK: "warning",
  OUT_OF_STOCK: "destructive",
  OVERSTOCK: "default",
};

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "numeric" });
}

export function StockAlertsClient({ initialAlerts, canAcknowledge }: Props) {
  const router = useRouter();
  const [alerts, setAlerts] = useState(initialAlerts);
  const [showAcknowledged, setShowAcknowledged] = useState(false);
  const [acknowledging, setAcknowledging] = useState<string | null>(null);

  const filtered = showAcknowledged ? alerts : alerts.filter((a) => !a.isAcknowledged);

  const unacknowledgedCount = alerts.filter((a) => !a.isAcknowledged).length;

  async function acknowledge(id: string) {
    setAcknowledging(id);
    try {
      const res = await fetch(`/api/v1/stock-alerts/${id}/acknowledge`, { method: "POST" });
      if (res.ok) {
        router.refresh();
        const updated = await fetch("/api/v1/stock-alerts?includeAcknowledged=true").then((r) => r.json());
        if (updated.data) setAlerts(updated.data);
      }
    } finally {
      setAcknowledging(null);
    }
  }

  async function acknowledgeAll() {
    const pending = alerts.filter((a) => !a.isAcknowledged);
    for (const a of pending) {
      await acknowledge(a.id);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex items-center gap-2">
          {unacknowledgedCount > 0 ? (
            <Badge variant="destructive">{unacknowledgedCount} unacknowledged</Badge>
          ) : (
            <Badge variant="secondary">All clear</Badge>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={showAcknowledged}
            onChange={(e) => setShowAcknowledged(e.target.checked)}
            className="rounded"
          />
          Show acknowledged
        </label>
        {canAcknowledge && unacknowledgedCount > 1 && (
          <div className="sm:ml-auto">
            <Button variant="outline" size="sm" onClick={acknowledgeAll}>
              <CheckCircle className="h-4 w-4 mr-2" aria-hidden="true" />
              Acknowledge All
            </Button>
          </div>
        )}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Location</TableHead>
              <TableHead className="text-right">Current</TableHead>
              <TableHead className="text-right hidden sm:table-cell">Threshold</TableHead>
              <TableHead className="hidden md:table-cell">Created</TableHead>
              <TableHead>Status</TableHead>
              {canAcknowledge && <TableHead className="w-[120px]" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={canAcknowledge ? 8 : 7} className="text-center text-muted-foreground py-8">
                  {showAcknowledged ? "No alerts" : "No active alerts — all stock levels are healthy"}
                </TableCell>
              </TableRow>
            )}
            {filtered.map((alert) => {
              const Icon = ALERT_ICONS[alert.alertType];
              return (
                <TableRow key={alert.id} className={alert.isAcknowledged ? "opacity-50" : undefined}>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      <Badge variant={ALERT_COLORS[alert.alertType] as "default" | "secondary" | "destructive" | "outline" | "warning"}>
                        {alert.alertType.replace("_", " ")}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm font-medium">{alert.productVariant.product.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {alert.productVariant.sku} · {alert.productVariant.color} {alert.productVariant.size}
                    </p>
                  </TableCell>
                  <TableCell className="text-sm">{alert.location.name}</TableCell>
                  <TableCell className="text-right font-bold text-sm">
                    {alert.currentQuantity}
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground hidden sm:table-cell">
                    {alert.threshold}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground hidden md:table-cell">
                    {fmt(alert.createdAt)}
                  </TableCell>
                  <TableCell>
                    {alert.isAcknowledged ? (
                      <span className="text-xs text-muted-foreground">
                        by {alert.acknowledgedBy?.name ?? "—"}
                      </span>
                    ) : (
                      <Badge variant="secondary">Open</Badge>
                    )}
                  </TableCell>
                  {canAcknowledge && (
                    <TableCell>
                      {!alert.isAcknowledged && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => acknowledge(alert.id)}
                          disabled={acknowledging === alert.id}
                          aria-label="Acknowledge alert"
                        >
                          <CheckCircle className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
                          {acknowledging === alert.id ? "…" : "Ack"}
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
