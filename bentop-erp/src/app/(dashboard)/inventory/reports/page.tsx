import { BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function InventoryReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Inventory Reports</h2>
        <p className="text-muted-foreground">Stock valuation, movement history, and analytics.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Reports</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Inventory reports will be built in Step 7. This will include stock valuation, movement history, slow-moving stock, and aging reports.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
