"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function InvoicePrintActions() {
  return (
    <Button type="button" onClick={() => window.print()} size="sm">
      <Printer className="mr-2 h-4 w-4" />
      Print
    </Button>
  );
}
