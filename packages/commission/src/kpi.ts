import {
    type CommissionLineItem,
    type KpiRule,
    type Sen,
} from "@bentop/domain";

// Evaluate one KPI rule against the employee's measured metric value.
// Returns a line item only if a band matches.
export const evaluateKpi = (params: {
    employeeId: string;
    rule: KpiRule;
    metricValue: number;
}): CommissionLineItem | null => {
    const { employeeId, rule, metricValue } = params;

    for (const band of rule.config.bands) {
        const gteOk = band.gte === undefined || metricValue >= band.gte;
        const lteOk = band.lte === undefined || metricValue <= band.lte;
        if (gteOk && lteOk) {
            return {
                employeeId,
                ruleId: null,
                kpiRuleId: rule.id,
                basisAmount: 0 as Sen,
                rate: 0,
                computedAmount: band.bonus,
                notes: { metric: rule.config.metric, metricValue, band },
            };
        }
    }
    return null;
};
