import { Boxes } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function StockPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Stock Levels</h2>
        <p className="text-muted-foreground">Real-time stock levels across all locations.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Stock Dashboard</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Stock management dashboard will be built in Step 3. This page will show real-time stock levels with visual indicators across all locations.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
