import { Barcode, Package } from "lucide-react";
import { Card } from "@/components/ui/card";
import { BarcodeLabelGeneratorClient } from "@/components/inventory/barcode-label-generator-client";

export default function BarcodeLabelsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Barcode Labels</h2>
          <p className="text-muted-foreground">
            Generate Bentop Collection sticker labels for product tags.
          </p>
        </div>
        <Card className="flex items-center gap-3 px-4 py-3">
          <Barcode className="h-5 w-5 text-primary" />
          <div>
            <p className="text-sm font-medium">PDF label size</p>
            <p className="text-xs text-muted-foreground">35 mm x 25 mm each</p>
          </div>
        </Card>
      </div>

      <Card className="flex items-center gap-3 p-4">
        <Package className="h-5 w-5 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Labels use variant SKU as Artical No, variant size, variant colour, and the saved
          barcode value. Variants without barcodes must be updated before printing.
        </p>
      </Card>

      <BarcodeLabelGeneratorClient />
    </div>
  );
}
