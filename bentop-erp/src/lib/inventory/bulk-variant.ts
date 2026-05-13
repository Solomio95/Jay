export type BulkVariantCandidate = {
  id: string;
  sku: string;
  barcode: string | null;
};

export function parseBulkVariantTokens(input: string) {
  const seen = new Set<string>();
  const tokens = input
    .split(/[\s,]+/)
    .map((token) => token.trim())
    .filter(Boolean);

  return tokens.filter((token) => {
    const key = token.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function pickBulkVariantMatch<T extends BulkVariantCandidate>(token: string, candidates: T[]) {
  const normalized = token.trim().toLowerCase();
  const exactSku = candidates.find((candidate) => candidate.sku.toLowerCase() === normalized);
  if (exactSku) return exactSku;

  const exactBarcode = candidates.find((candidate) => candidate.barcode?.toLowerCase() === normalized);
  if (exactBarcode) return exactBarcode;

  return candidates.length === 1 ? candidates[0] : null;
}
