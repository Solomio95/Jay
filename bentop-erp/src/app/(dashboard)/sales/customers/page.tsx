import { Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function CustomersPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Customers</h2>
          <p className="text-muted-foreground">Manage retail, wholesale, and consignment customers.</p>
        </div>
        <Button>
          <Users className="mr-2 h-4 w-4" />
          Add Customer
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Customer Database</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Customer management will be built in Step 4. This page will include customer CRUD, purchase history, and credit management.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
