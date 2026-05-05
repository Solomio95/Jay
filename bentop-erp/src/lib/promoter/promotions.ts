type PromotionRuleMode = "SAME_SKU" | "MIX_AND_MATCH";

type PromotionItem = {
  productVariantId: string;
  productId: string;
  quantity: number;
  normalUnitPrice: number;
};

type PromotionUnitPrice = {
  productVariantId: string;
  productId: string;
  normalUnitPrice: number;
  effectiveUnitPrice: number;
};

export function calculatePromotionUnitPrices(input: {
  ruleMode: PromotionRuleMode;
  bundleQuantity: number;
  bundlePrice: number;
  items: PromotionItem[];
}): PromotionUnitPrice[] {
  if (input.bundleQuantity <= 0) {
    throw new Error("Promotion bundle quantity must be positive");
  }

  const bundleUnitPrice = roundMoney(input.bundlePrice / input.bundleQuantity);
  const units = expandItems(input.items);

  if (input.ruleMode === "SAME_SKU") {
    applySameSkuBundles(units, input.bundleQuantity, bundleUnitPrice);
    return units;
  }

  applyBundlePrice(units, input.bundleQuantity, bundleUnitPrice);
  return units;
}

function expandItems(items: PromotionItem[]): PromotionUnitPrice[] {
  return items.flatMap((item) =>
    Array.from({ length: item.quantity }, () => ({
      productVariantId: item.productVariantId,
      productId: item.productId,
      normalUnitPrice: item.normalUnitPrice,
      effectiveUnitPrice: item.normalUnitPrice,
    })),
  );
}

function applySameSkuBundles(
  units: PromotionUnitPrice[],
  bundleQuantity: number,
  bundleUnitPrice: number,
) {
  const groupedIndexes = new Map<string, number[]>();

  units.forEach((unit, index) => {
    const indexes = groupedIndexes.get(unit.productVariantId) ?? [];
    indexes.push(index);
    groupedIndexes.set(unit.productVariantId, indexes);
  });

  for (const indexes of groupedIndexes.values()) {
    const eligibleCount =
      Math.floor(indexes.length / bundleQuantity) * bundleQuantity;

    for (const index of indexes.slice(0, eligibleCount)) {
      units[index].effectiveUnitPrice = bundleUnitPrice;
    }
  }
}

function applyBundlePrice(
  units: PromotionUnitPrice[],
  bundleQuantity: number,
  bundleUnitPrice: number,
) {
  const eligibleCount = Math.floor(units.length / bundleQuantity) * bundleQuantity;

  for (let index = 0; index < eligibleCount; index += 1) {
    units[index].effectiveUnitPrice = bundleUnitPrice;
  }
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
