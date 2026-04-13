import { Store } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function POSPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Point of Sale</h2>
        <p className="text-muted-foreground">Retail store POS interface.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>POS Terminal</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            The POS interface will be built in Step 4. This will include quick product search, barcode scanning, cart management, and receipt generation.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
