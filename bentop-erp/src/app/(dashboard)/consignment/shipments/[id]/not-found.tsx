import Link from "next/link";
import { Boxes } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ShipmentNotFound() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <Boxes className="h-7 w-7 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-bold">Shipment not found</h2>
        <p className="text-sm text-muted-foreground">
          This consignment shipment may have been removed or the link is invalid.
        </p>
        <Button variant="outline" asChild>
          <Link href="/consignment">Back to Consignment</Link>
        </Button>
      </div>
    </div>
  );
}
