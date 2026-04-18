import {
    type CommissionLineItem,
    type OverrideRegionConfig,
    type OverrideTeamConfig,
    type Sen,
    mulPct,
} from "@bentop/domain";

export const evaluateOverrideTeam = (params: {
    managerEmployeeId: string;
    ruleId: string;
    config: OverrideTeamConfig;
    teamNetSales: Sen;
    reportIds: readonly string[];
}): CommissionLineItem => ({
    employeeId: params.managerEmployeeId,
    ruleId: params.ruleId,
    kpiRuleId: null,
    basisAmount: params.teamNetSales,
    rate: params.config.pct,
    computedAmount: mulPct(params.teamNetSales, params.config.pct),
    notes: {
        teamScope: params.config.teamScope,
        reportCount: params.reportIds.length,
    },
});

export const evaluateOverrideRegion = (params: {
    managerEmployeeId: string;
    ruleId: string;
    config: OverrideRegionConfig;
    regionNetSales: Sen;
    regionName: string;
}): CommissionLineItem => ({
    employeeId: params.managerEmployeeId,
    ruleId: params.ruleId,
    kpiRuleId: null,
    basisAmount: params.regionNetSales,
    rate: params.config.pct,
    computedAmount: mulPct(params.regionNetSales, params.config.pct),
    notes: { regionName: params.regionName },
});
