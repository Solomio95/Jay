import { ShoppingCart } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function OrdersPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Orders</h2>
          <p className="text-muted-foreground">Manage sales orders across all channels.</p>
        </div>
        <Button>
          <ShoppingCart className="mr-2 h-4 w-4" />
          New Order
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Order Management</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Order management will be built in Step 4. This page will include order creation, lifecycle management, and listing with filters.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
