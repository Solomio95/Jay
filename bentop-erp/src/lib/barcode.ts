export type ScannableVariant = {
  sku: string;
  barcode?: string | null;
};

export function normalizeScanValue(value: string) {
  return value.trim();
}

export function findScannedVariant<T extends ScannableVariant>(
  variants: T[],
  scanValue: string,
) {
  const normalized = normalizeScanValue(scanValue);
  if (!normalized) return null;

  const barcodeMatch = variants.find((variant) => variant.barcode === normalized);
  if (barcodeMatch) return barcodeMatch;

  const scanSku = normalized.toLowerCase();
  return variants.find((variant) => variant.sku.toLowerCase() === scanSku) ?? null;
}
