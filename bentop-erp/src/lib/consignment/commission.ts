export type CommissionTier = {
  name: string;
  minPrice: number;
  maxPrice: number | null;
  commissionRate: number;
};

export type CommissionOverride = {
  tierName: string;
  commissionRate: number;
};

export type CommissionSource = "tier" | "override";

export type CalculateCommissionInput = {
  actualUnitPrice: number;
  quantitySold?: number;
  override?: CommissionOverride | null;
  tiers?: readonly CommissionTier[];
};

export type CommissionCalculation = {
  tierName: string;
  commissionRate: number;
  source: CommissionSource;
  grossAmount: number;
  commissionAmount: number;
  netAmount: number;
};

export const DEFAULT_COMMISSION_TIERS = [
  {
    name: "Super Best Buy",
    minPrice: 0,
    maxPrice: 49.99,
    commissionRate: 20,
  },
  {
    name: "Best Buy",
    minPrice: 50,
    maxPrice: 109.99,
    commissionRate: 25,
  },
  {
    name: "Normal",
    minPrice: 110,
    maxPrice: null,
    commissionRate: 30,
  },
] as const satisfies readonly CommissionTier[];

export function calculateCommission({
  actualUnitPrice,
  quantitySold = 1,
  override,
  tiers = DEFAULT_COMMISSION_TIERS,
}: CalculateCommissionInput): CommissionCalculation {
  const roundedUnitPrice = roundMoney(actualUnitPrice);
  const source: CommissionSource = override ? "override" : "tier";
  const selected = override
    ? {
        tierName: override.tierName,
        commissionRate: override.commissionRate,
      }
    : (() => {
        const tier = findTierForPrice(roundedUnitPrice, tiers);

        return {
          tierName: tier.name,
          commissionRate: tier.commissionRate,
        };
      })();
  const grossAmount = roundMoney(roundedUnitPrice * quantitySold);
  const commissionAmount = roundMoney((grossAmount * selected.commissionRate) / 100);

  return {
    tierName: selected.tierName,
    commissionRate: selected.commissionRate,
    source,
    grossAmount,
    commissionAmount,
    netAmount: roundMoney(grossAmount - commissionAmount),
  };
}

function findTierForPrice(
  actualUnitPrice: number,
  tiers: readonly CommissionTier[],
): CommissionTier {
  const tier = tiers.find(
    ({ minPrice, maxPrice }) =>
      actualUnitPrice >= minPrice &&
      (maxPrice === null || actualUnitPrice <= maxPrice),
  );

  if (!tier) {
    throw new Error(
      `No commission tier configured for unit price ${actualUnitPrice}.`,
    );
  }

  return tier;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
