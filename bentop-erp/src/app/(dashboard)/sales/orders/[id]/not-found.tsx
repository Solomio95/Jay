import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function OrderNotFound() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <ShoppingCart className="h-7 w-7 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-bold">Order not found</h2>
        <p className="text-sm text-muted-foreground">
          This order may have been removed or the link is invalid.
        </p>
        <Button variant="outline" asChild>
          <Link href="/sales/orders">Back to Orders</Link>
        </Button>
      </div>
    </div>
  );
}
