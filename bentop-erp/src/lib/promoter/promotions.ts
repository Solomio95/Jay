type PromotionRuleMode = "SAME_SKU" | "MIX_AND_MATCH";

type PromotionItem = {
  productVariantId: string;
  productId: string;
  quantity: number;
  normalUnitPrice: number;
};

type PromoterSaleItem = {
  productVariantId: string;
  productId: string;
  quantity: number;
  sellingPriceMyr: number;
};

export type PromotionCandidate = {
  id: string;
  ruleMode: PromotionRuleMode;
  bundleQuantity: number;
  bundlePrice: number;
  productIds: string[];
  productVariantIds: string[];
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

export function calculatePromoterSaleLinePrices(input: {
  items: PromoterSaleItem[];
  promotions: PromotionCandidate[];
}) {
  const baseLines = input.items.map((item) => ({
    productVariantId: item.productVariantId,
    unitPrice: roundMoney(item.sellingPriceMyr),
    totalPrice: roundMoney(item.sellingPriceMyr * item.quantity),
    promotionId: null as string | null,
  }));

  const promotion = input.promotions.find((candidate) =>
    hasEligibleBundle(input.items, candidate),
  );

  if (!promotion) {
    return baseLines;
  }

  const eligibleItems = input.items.filter((item) =>
    isItemEligibleForPromotion(item, promotion),
  );
  const pricedUnits = calculatePromotionUnitPrices({
    ruleMode: promotion.ruleMode,
    bundleQuantity: promotion.bundleQuantity,
    bundlePrice: promotion.bundlePrice,
    items: eligibleItems.map((item) => ({
      productVariantId: item.productVariantId,
      productId: item.productId,
      quantity: item.quantity,
      normalUnitPrice: item.sellingPriceMyr,
    })),
  });

  return input.items.map((item) => {
    const itemUnits = pricedUnits.filter(
      (unit) => unit.productVariantId === item.productVariantId,
    );
    if (itemUnits.length === 0) {
      return {
        productVariantId: item.productVariantId,
        unitPrice: roundMoney(item.sellingPriceMyr),
        totalPrice: roundMoney(item.sellingPriceMyr * item.quantity),
        promotionId: null,
      };
    }

    const totalPrice = roundMoney(
      itemUnits.reduce((sum, unit) => sum + unit.effectiveUnitPrice, 0),
    );

    return {
      productVariantId: item.productVariantId,
      unitPrice: roundMoney(totalPrice / item.quantity),
      totalPrice,
      promotionId: itemUnits.some((unit) => unit.effectiveUnitPrice !== unit.normalUnitPrice)
        ? promotion.id
        : null,
    };
  });
}

function hasEligibleBundle(items: PromoterSaleItem[], promotion: PromotionCandidate) {
  const eligibleItems = items.filter((item) => isItemEligibleForPromotion(item, promotion));
  const eligibleQuantity = eligibleItems.reduce((sum, item) => sum + item.quantity, 0);

  if (promotion.ruleMode === "MIX_AND_MATCH") {
    return eligibleQuantity >= promotion.bundleQuantity;
  }

  return eligibleItems.some((item) => item.quantity >= promotion.bundleQuantity);
}

function isItemEligibleForPromotion(
  item: PromoterSaleItem,
  promotion: PromotionCandidate,
) {
  return (
    promotion.productVariantIds.includes(item.productVariantId) ||
    promotion.productIds.includes(item.productId)
  );
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
