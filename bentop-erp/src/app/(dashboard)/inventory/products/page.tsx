import { Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ProductsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Products</h2>
          <p className="text-muted-foreground">Manage your product catalog and variants.</p>
        </div>
        <Button>
          <Package className="mr-2 h-4 w-4" />
          Add Product
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Product Catalog</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Product catalog management will be built in Step 2. This page will include product listing with filters, search, and CRUD operations.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
