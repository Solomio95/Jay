import { BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SalesReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Sales Reports</h2>
        <p className="text-muted-foreground">Revenue analytics, channel performance, and trends.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Reports & Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Sales reports will be built in Step 7. This will include revenue dashboards, channel performance, product analytics, and profit margins.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
