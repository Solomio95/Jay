import { ArrowLeftRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function TransfersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Stock Transfers</h2>
        <p className="text-muted-foreground">Manage stock transfers between locations.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Transfer Management</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Stock transfer management will be built in Step 3. This page will include transfer request, approval, and completion workflows.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
