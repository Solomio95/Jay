import {
    type CommissionLineItem,
    type Sen,
    type Tier,
    type TieredPersonalConfig,
    addSen,
    mulPct,
} from "@bentop/domain";

// Evaluate tiered-personal rule: each tier only earns on the slice of sales falling inside it.
// Returns one line item per tier that contributed, so payslips can explain the breakdown.
export const evaluateTieredPersonal = (params: {
    employeeId: string;
    ruleId: string;
    config: TieredPersonalConfig;
    personalNetSales: Sen;
}): CommissionLineItem[] => {
    const { employeeId, ruleId, config, personalNetSales } = params;
    const items: CommissionLineItem[] = [];

    for (let i = 0; i < config.tiers.length; i++) {
        const tier = config.tiers[i]!;
        const sliceStart = tier.min;
        const sliceEnd = tier.max ?? personalNetSales;
        if (personalNetSales <= sliceStart) break;

        const appliedUpper = Math.min(personalNetSales, sliceEnd) as Sen;
        const sliceAmount = (appliedUpper - sliceStart) as Sen;
        if (sliceAmount <= 0) continue;

        items.push({
            employeeId,
            ruleId,
            kpiRuleId: null,
            basisAmount: sliceAmount,
            rate: tier.pct,
            computedAmount: mulPct(sliceAmount, tier.pct),
            notes: { tierIndex: i, tier },
        });
    }

    return items;
};

export const sumLineItems = (items: readonly CommissionLineItem[]): Sen =>
    addSen(...items.map((i) => i.computedAmount));

// Used by the admin scheme designer for validation.
export const validateTiers = (tiers: readonly Tier[]): string | null => {
    if (tiers.length === 0) return "must define at least one tier";
    for (let i = 0; i < tiers.length - 1; i++) {
        const t = tiers[i]!;
        const next = tiers[i + 1]!;
        if (t.max === null) return `tier ${i} has no max but isn't the last tier`;
        if (next.min !== t.max) return `tier ${i + 1} doesn't start where tier ${i} ends`;
    }
    return null;
};
