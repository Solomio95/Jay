export function calculateAvailableStock(
  quantityOnHand: number,
  quantityReserved: number,
) {
  return Math.max(0, quantityOnHand - quantityReserved);
}

export function assertEnoughAvailableStock(input: {
  available: number;
  requested: number;
  itemLabel: string;
}) {
  if (input.available < input.requested) {
    throw new Error(
      `INSUFFICIENT_STOCK:Only ${input.available} available for ${input.itemLabel}, requested ${input.requested}`,
    );
  }
}

export function mergeRequestedQuantities<
  T extends { productVariantId: string; quantity: number },
>(items: T[]) {
  const quantities = new Map<string, number>();

  for (const item of items) {
    quantities.set(
      item.productVariantId,
      (quantities.get(item.productVariantId) ?? 0) + item.quantity,
    );
  }

  return quantities;
}
