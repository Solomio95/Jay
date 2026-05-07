export type PurchaseReceiptStatus = "ORDERED" | "PARTIAL_RECEIVED" | "RECEIVED";

export type PurchaseReceiptLineState = {
  quantityOrdered: number;
  quantityReceived: number;
};

export function summarizePurchaseOrderReceiptState(
  items: PurchaseReceiptLineState[]
): PurchaseReceiptStatus {
  const totalOrdered = items.reduce((sum, item) => sum + item.quantityOrdered, 0);
  const totalReceived = items.reduce((sum, item) => sum + item.quantityReceived, 0);

  if (totalOrdered > 0 && items.every((item) => item.quantityReceived >= item.quantityOrdered)) {
    return "RECEIVED";
  }

  if (totalReceived > 0) {
    return "PARTIAL_RECEIVED";
  }

  return "ORDERED";
}
