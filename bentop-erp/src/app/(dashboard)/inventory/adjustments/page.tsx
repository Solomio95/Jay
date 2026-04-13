import { ClipboardList } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdjustmentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Stock Adjustments</h2>
        <p className="text-muted-foreground">Record stock adjustments and corrections.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Adjustment History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Stock adjustment management will be built in Step 3. This page will include manual corrections with mandatory reason codes and audit logging.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
