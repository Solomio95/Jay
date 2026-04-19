import {
    type CommissionLineItem,
    type CommissionRule,
    type Employee,
    type KpiMetricValue,
    type KpiRule,
    type SalesRecord,
    type Sen,
    addSen,
} from "@bentop/domain";

import { evaluateKpi } from "./kpi.js";
import { evaluateOverrideRegion, evaluateOverrideTeam } from "./override.js";
import { evaluateTieredPersonal } from "./tiered.js";

export interface PipelineInput {
    periodMonth: string;                          // ISO first-of-month
    employees: readonly Employee[];
    sales: readonly SalesRecord[];                // already filtered to period + not superseded
    commissionRules: readonly CommissionRule[];
    kpiRules: readonly KpiRule[];
    kpiMetrics: readonly KpiMetricValue[];
    // Hierarchy resolver: given a manager, which employeeIds report to them this period?
    directReportsOf: (managerEmployeeId: string) => readonly string[];
    allSubordinatesOf: (managerEmployeeId: string) => readonly string[];
    // For state managers: which employees belong to their region this period?
    employeesInRegionOf: (stateManagerEmployeeId: string) => readonly string[];
    regionNameOf: (stateManagerEmployeeId: string) => string;
}

export interface PipelineOutput {
    lineItems: CommissionLineItem[];
    totalsByEmployee: Map<string, Sen>;
}

// Single pass: feed every fact in, get every line item back. Same engine runs for
// live "commission-to-date" and the final payroll run; determinism is enforced
// by the caller snapshotting the scheme + sales before calling.
export const runCommissionPipeline = (input: PipelineInput): PipelineOutput => {
    const lineItems: CommissionLineItem[] = [];
    const netSalesByEmployee = aggregateNetSalesByEmployee(input.sales);

    for (const employee of input.employees) {
        const applicable = input.commissionRules
            .filter((r) => r.appliesToRole === employee.role)
            .sort((a, b) => a.priority - b.priority);

        for (const rule of applicable) {
            switch (rule.ruleType) {
                case "tiered_personal": {
                    if (rule.config.basis !== "personal_net_sales") continue;
                    const personal = netSalesByEmployee.get(employee.id) ?? (0 as Sen);
                    lineItems.push(
                        ...evaluateTieredPersonal({
                            employeeId: employee.id,
                            ruleId: rule.id,
                            config: rule.config,
                            personalNetSales: personal,
                        }),
                    );
                    break;
                }
                case "override_team": {
                    if (rule.config.basis !== "team_net_sales") continue;
                    const reportIds =
                        rule.config.teamScope === "direct_reports"
                            ? input.directReportsOf(employee.id)
                            : input.allSubordinatesOf(employee.id);
                    const teamNetSales = addSen(
                        ...reportIds.map((id) => netSalesByEmployee.get(id) ?? (0 as Sen)),
                    );
                    lineItems.push(
                        evaluateOverrideTeam({
                            managerEmployeeId: employee.id,
                            ruleId: rule.id,
                            config: rule.config,
                            teamNetSales,
                            reportIds,
                        }),
                    );
                    break;
                }
                case "override_region": {
                    if (rule.config.basis !== "region_net_sales") continue;
                    const regionEmployees = input.employeesInRegionOf(employee.id);
                    const regionNetSales = addSen(
                        ...regionEmployees.map(
                            (id) => netSalesByEmployee.get(id) ?? (0 as Sen),
                        ),
                    );
                    lineItems.push(
                        evaluateOverrideRegion({
                            managerEmployeeId: employee.id,
                            ruleId: rule.id,
                            config: rule.config,
                            regionNetSales,
                            regionName: input.regionNameOf(employee.id),
                        }),
                    );
                    break;
                }
                case "flat": {
                    if (rule.config.basis !== "flat") continue;
                    lineItems.push({
                        employeeId: employee.id,
                        ruleId: rule.id,
                        kpiRuleId: null,
                        basisAmount: 0 as Sen,
                        rate: 0,
                        computedAmount: rule.config.amount,
                        notes: { perUnit: rule.config.perUnit ?? null },
                    });
                    break;
                }
            }
        }

        for (const kpiRule of input.kpiRules) {
            if (kpiRule.appliesToRole !== employee.role) continue;
            const metricValue = input.kpiMetrics.find(
                (m) =>
                    m.employeeId === employee.id &&
                    m.metric === kpiRule.config.metric &&
                    m.periodMonth === input.periodMonth,
            )?.value;
            if (metricValue === undefined) continue;

            const item = evaluateKpi({
                employeeId: employee.id,
                rule: kpiRule,
                metricValue,
            });
            if (item) lineItems.push(item);
        }
    }

    const totalsByEmployee = new Map<string, Sen>();
    for (const item of lineItems) {
        const prev = totalsByEmployee.get(item.employeeId) ?? (0 as Sen);
        totalsByEmployee.set(item.employeeId, (prev + item.computedAmount) as Sen);
    }

    return { lineItems, totalsByEmployee };
};

const aggregateNetSalesByEmployee = (
    sales: readonly SalesRecord[],
): Map<string, Sen> => {
    const map = new Map<string, Sen>();
    for (const s of sales) {
        if (!s.employeeId || s.supersededBy) continue;
        const prev = map.get(s.employeeId) ?? (0 as Sen);
        map.set(s.employeeId, (prev + s.netAmount) as Sen);
    }
    return map;
};
