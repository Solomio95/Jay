import { Boxes } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ConsignmentPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Consignment</h2>
        <p className="text-muted-foreground">Track consignment stock and partner performance.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Consignment Management</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Consignment management will be built in Step 5. This will include partner management, stock tracking, sales recording, and fee calculations.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
