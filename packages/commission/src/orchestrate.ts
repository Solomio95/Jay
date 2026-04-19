// Pure commission-run orchestrator.
//
// The edge function wraps this with a Supabase-backed provider; tests wrap it
// with an in-memory provider. Like the payroll orchestrator, this module has
// zero I/O: it asks the provider for scheme / rules / sales / hierarchy,
// hands them to `runCommissionPipeline`, and asks the provider to persist
// the resulting `commission_runs` row + `commission_line_items`.
//
// dryRun: true  → compute and return totals, persist nothing.
// dryRun: false → persist run row + items, flip status to `approved`.

import type {
    CommissionLineItem,
    CommissionRule,
    Employee,
    KpiMetricValue,
    KpiRule,
    SalesRecord,
    Sen,
} from "@bentop/domain";
import { runCommissionPipeline } from "./pipeline.js";

export interface CommissionRunMeta {
    periodMonth: string;       // "YYYY-MM-01"
    schemeId?: string;         // omitted → provider picks active scheme for period
    dryRun: boolean;
    runBy?: string | null;     // auth.users.id of the actor, for audit
}

export interface CommissionPipelineFacts {
    schemeId: string;
    employees: readonly Employee[];
    sales: readonly SalesRecord[];
    commissionRules: readonly CommissionRule[];
    kpiRules: readonly KpiRule[];
    kpiMetrics: readonly KpiMetricValue[];
    // Hierarchy precomputed for the period; keys are employee ids.
    directReports: ReadonlyMap<string, readonly string[]>;
    allSubordinates: ReadonlyMap<string, readonly string[]>;
    regionEmployees: ReadonlyMap<string, readonly string[]>;
    regionNames: ReadonlyMap<string, string>;
}

export interface CommissionOrchestrationProvider {
    loadFacts(meta: CommissionRunMeta): Promise<CommissionPipelineFacts>;
    createRunRow(
        facts: CommissionPipelineFacts,
        meta: CommissionRunMeta,
    ): Promise<string>;
    writeLineItems(runId: string, items: CommissionLineItem[]): Promise<void>;
    markApproved(runId: string): Promise<void>;
}

export interface CommissionOrchestrationResult {
    runId: string | null;
    periodMonth: string;
    schemeId: string;
    status: "draft" | "approved";
    lineItemCount: number;
    totalPayoutSen: Sen;
    totalsByEmployee: Array<{ employeeId: string; totalSen: Sen }>;
}

export const orchestrateCommissionRun = async (
    meta: CommissionRunMeta,
    provider: CommissionOrchestrationProvider,
): Promise<CommissionOrchestrationResult> => {
    const facts = await provider.loadFacts(meta);

    const { lineItems, totalsByEmployee } = runCommissionPipeline({
        periodMonth: meta.periodMonth,
        employees: facts.employees,
        sales: facts.sales,
        commissionRules: facts.commissionRules,
        kpiRules: facts.kpiRules,
        kpiMetrics: facts.kpiMetrics,
        directReportsOf: (id) => facts.directReports.get(id) ?? [],
        allSubordinatesOf: (id) => facts.allSubordinates.get(id) ?? [],
        employeesInRegionOf: (id) => facts.regionEmployees.get(id) ?? [],
        regionNameOf: (id) => facts.regionNames.get(id) ?? "",
    });

    const totalsArr: Array<{ employeeId: string; totalSen: Sen }> = [];
    let totalPayout = 0;
    for (const [employeeId, totalSen] of totalsByEmployee) {
        totalsArr.push({ employeeId, totalSen });
        totalPayout += totalSen;
    }

    if (meta.dryRun) {
        return {
            runId: null,
            periodMonth: meta.periodMonth,
            schemeId: facts.schemeId,
            status: "draft",
            lineItemCount: lineItems.length,
            totalPayoutSen: totalPayout as Sen,
            totalsByEmployee: totalsArr,
        };
    }

    const runId = await provider.createRunRow(facts, meta);
    await provider.writeLineItems(runId, lineItems);
    await provider.markApproved(runId);

    return {
        runId,
        periodMonth: meta.periodMonth,
        schemeId: facts.schemeId,
        status: "approved",
        lineItemCount: lineItems.length,
        totalPayoutSen: totalPayout as Sen,
        totalsByEmployee: totalsArr,
    };
};
