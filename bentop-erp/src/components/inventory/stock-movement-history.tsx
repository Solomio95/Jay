import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";

type Movement = {
  id: string;
  createdAt: string;
  sku: string;
  productName: string;
  color: string;
  colorHex: string | null;
  size: string;
  movementType: string;
  quantity: number;
  fromLocation: string | null;
  toLocation: string | null;
  reason: string | null;
  referenceNumber: string | null;
  performedBy: string;
  notes: string | null;
};

export function StockMovementHistory({ movements }: { movements: Movement[] }) {
  if (movements.length === 0) {
    return <div className="text-sm text-muted-foreground text-center py-8">No movements yet.</div>;
  }

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-40">Date</TableHead>
            <TableHead>SKU / Variant</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Reason</TableHead>
            <TableHead>By</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {movements.map((m) => (
            <TableRow key={m.id}>
              <TableCell className="text-xs text-muted-foreground">
                {formatDateTime(m.createdAt)}
              </TableCell>
              <TableCell>
                <div className="font-mono text-xs">{m.sku}</div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span
                    className="inline-block h-2 w-2 rounded-full ring-1 ring-border"
                    style={{ backgroundColor: m.colorHex || "#999" }}
                  />
                  {m.color} · {m.size}
                </div>
              </TableCell>
              <TableCell>
                <Badge
                  variant={
                    m.movementType === "INBOUND"
                      ? "success"
                      : m.movementType === "OUTBOUND"
                      ? "destructive"
                      : "secondary"
                  }
                  className="text-xs"
                >
                  {m.movementType}
                </Badge>
              </TableCell>
              <TableCell className="text-right font-medium">{m.quantity}</TableCell>
              <TableCell className="text-xs">
                {m.fromLocation && m.toLocation ? (
                  <span>
                    {m.fromLocation} → {m.toLocation}
                  </span>
                ) : m.fromLocation ? (
                  <span className="text-destructive">− {m.fromLocation}</span>
                ) : m.toLocation ? (
                  <span className="text-green-700">+ {m.toLocation}</span>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">{m.reason || "—"}</TableCell>
              <TableCell className="text-xs">{m.performedBy}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
