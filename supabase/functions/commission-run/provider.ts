// deno-lint-ignore-file no-explicit-any
//
// Supabase-backed CommissionOrchestrationProvider.
//
// Loads the scheme + rules + employees + sales + KPI data, precomputes the
// hierarchy maps from employee_assignments, and persists the run + line items.
// Every numeric value flows through toSen() at the DB edge so the pipeline
// sees integer sen throughout.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.46.1";
import type {
    CommissionLineItem,
    CommissionRule,
    CommissionRuleConfig,
    CommissionRuleType,
    Employee,
    KpiMetricValue,
    KpiRule,
    KpiRuleConfig,
    Role,
    SalesRecord,
    Sen,
    WageType,
} from "@bentop/domain";
import { toSen } from "@bentop/domain";
import type {
    CommissionOrchestrationProvider,
    CommissionPipelineFacts,
    CommissionRunMeta,
} from "@bentop/commission";

const endOfMonth = (periodMonth: string): string => {
    const [y, m] = periodMonth.split("-").map(Number);
    const d = new Date(Date.UTC(y!, m!, 0));
    return d.toISOString().slice(0, 10);
};

export const buildProvider = (
    supabase: SupabaseClient,
): CommissionOrchestrationProvider => ({
    async loadFacts(meta: CommissionRunMeta): Promise<CommissionPipelineFacts> {
        const schemeId = await resolveSchemeId(supabase, meta);

        const [
            commissionRules,
            kpiRules,
            kpiMetrics,
            employees,
            sales,
            hierarchy,
        ] = await Promise.all([
            loadCommissionRules(supabase, schemeId),
            loadKpiRules(supabase, schemeId),
            loadKpiMetrics(supabase, meta.periodMonth),
            loadEmployees(supabase),
            loadSales(supabase, meta.periodMonth),
            loadHierarchy(supabase, meta.periodMonth),
        ]);

        return {
            schemeId,
            employees,
            sales,
            commissionRules,
            kpiRules,
            kpiMetrics,
            directReports: hierarchy.directReports,
            allSubordinates: hierarchy.allSubordinates,
            regionEmployees: hierarchy.regionEmployees,
            regionNames: hierarchy.regionNames,
        };
    },

    async createRunRow(
        facts: CommissionPipelineFacts,
        meta: CommissionRunMeta,
    ): Promise<string> {
        const { data, error } = await supabase
            .from("commission_runs")
            .insert({
                period_month: meta.periodMonth,
                scheme_id: facts.schemeId,
                status: "draft",
                run_by: meta.runBy ?? null,
            })
            .select("id")
            .single();
        if (error || !data) {
            throw new Error(`commission_runs insert failed: ${error?.message}`);
        }
        return data.id as string;
    },

    async writeLineItems(runId: string, items: CommissionLineItem[]): Promise<void> {
        if (items.length === 0) return;
        const rows = items.map((item) => ({
            commission_run_id: runId,
            employee_id: item.employeeId,
            rule_id: item.ruleId,
            kpi_rule_id: item.kpiRuleId,
            basis_amount: item.basisAmount / 100,
            rate: item.rate,
            computed_amount: item.computedAmount / 100,
            notes: item.notes,
        }));
        const { error } = await supabase.from("commission_line_items").insert(rows);
        if (error) {
            throw new Error(`commission_line_items insert failed: ${error.message}`);
        }
    },

    async markApproved(runId: string): Promise<void> {
        const { error } = await supabase
            .from("commission_runs")
            .update({ status: "approved" })
            .eq("id", runId);
        if (error) {
            throw new Error(`commission_runs status update failed: ${error.message}`);
        }
    },
});

// --- Loaders --------------------------------------------------------------

const resolveSchemeId = async (
    supabase: SupabaseClient,
    meta: CommissionRunMeta,
): Promise<string> => {
    if (meta.schemeId) {
        const { data, error } = await supabase
            .from("commission_schemes")
            .select("id, status")
            .eq("id", meta.schemeId)
            .single();
        if (error || !data) {
            throw new Error(`scheme ${meta.schemeId} not found: ${error?.message}`);
        }
        return data.id as string;
    }

    const { data, error } = await supabase
        .from("commission_schemes")
        .select("id")
        .eq("status", "active")
        .lte("effective_from", meta.periodMonth)
        .or(`effective_to.is.null,effective_to.gte.${meta.periodMonth}`)
        .order("effective_from", { ascending: false })
        .limit(1)
        .maybeSingle();
    if (error) {
        throw new Error(`scheme lookup failed: ${error.message}`);
    }
    if (!data) {
        throw new Error(`no active commission scheme covers ${meta.periodMonth}`);
    }
    return data.id as string;
};

const loadCommissionRules = async (
    supabase: SupabaseClient,
    schemeId: string,
): Promise<CommissionRule[]> => {
    const { data, error } = await supabase
        .from("commission_rules")
        .select("id, scheme_id, applies_to_role, rule_type, priority, config")
        .eq("scheme_id", schemeId);
    if (error) {
        throw new Error(`commission_rules lookup failed: ${error.message}`);
    }
    return (data ?? []).map((row: any) => ({
        id: row.id as string,
        schemeId: row.scheme_id as string,
        appliesToRole: row.applies_to_role as Role,
        ruleType: row.rule_type as CommissionRuleType,
        priority: row.priority as number,
        config: row.config as CommissionRuleConfig,
    }));
};

const loadKpiRules = async (
    supabase: SupabaseClient,
    schemeId: string,
): Promise<KpiRule[]> => {
    const { data, error } = await supabase
        .from("kpi_rules")
        .select("id, scheme_id, applies_to_role, name, config")
        .eq("scheme_id", schemeId);
    if (error) {
        throw new Error(`kpi_rules lookup failed: ${error.message}`);
    }
    return (data ?? []).map((row: any) => ({
        id: row.id as string,
        schemeId: row.scheme_id as string,
        appliesToRole: row.applies_to_role as Role,
        name: row.name as string,
        config: row.config as KpiRuleConfig,
    }));
};

const loadKpiMetrics = async (
    supabase: SupabaseClient,
    periodMonth: string,
): Promise<KpiMetricValue[]> => {
    const { data, error } = await supabase
        .from("kpi_metrics")
        .select("employee_id, period_month, metric, value")
        .eq("period_month", periodMonth);
    if (error) {
        throw new Error(`kpi_metrics lookup failed: ${error.message}`);
    }
    return (data ?? []).map((row: any) => ({
        employeeId: row.employee_id as string,
        periodMonth: row.period_month as string,
        metric: row.metric,
        value: Number(row.value),
    }));
};

const loadEmployees = async (supabase: SupabaseClient): Promise<Employee[]> => {
    const { data, error } = await supabase
        .from("employees")
        .select(`
            id, profile_id, employee_no, base_salary, wage_type, dependents,
            pcb_category, hourly_rate, daily_rate, epf_no, socso_no, tax_no,
            profile:profiles!inner(full_name, role, status)
        `)
        .eq("profile.status", "active");
    if (error) {
        throw new Error(`employees lookup failed: ${error.message}`);
    }
    return (data ?? []).map((row: any) => ({
        id: row.id as string,
        profileId: row.profile_id as string,
        employeeNo: row.employee_no as string,
        fullName: row.profile?.full_name ?? "Unknown",
        role: (row.profile?.role ?? "promoter") as Role,
        wageType: (row.wage_type ?? "monthly") as WageType,
        baseSalary: toSen(Number(row.base_salary ?? 0)),
        hourlyRate: row.hourly_rate ? toSen(Number(row.hourly_rate)) : undefined,
        dailyRate: row.daily_rate ? toSen(Number(row.daily_rate)) : undefined,
        pcbCategory: row.pcb_category ?? undefined,
        dependents: Number(row.dependents ?? 0),
        epfNo: row.epf_no ?? undefined,
        socsoNo: row.socso_no ?? undefined,
        taxNo: row.tax_no ?? undefined,
    }));
};

const loadSales = async (
    supabase: SupabaseClient,
    periodMonth: string,
): Promise<SalesRecord[]> => {
    const monthEnd = endOfMonth(periodMonth);
    const { data, error } = await supabase
        .from("sales_records")
        .select(`
            id, external_id, counter_id, employee_id, sale_date,
            gross_amount, returns_amount, net_amount, currency,
            erp_version, superseded_by
        `)
        .gte("sale_date", periodMonth)
        .lte("sale_date", monthEnd)
        .is("superseded_by", null);
    if (error) {
        throw new Error(`sales_records lookup failed: ${error.message}`);
    }
    return (data ?? []).map((row: any): SalesRecord => ({
        id: row.id as string,
        externalId: row.external_id as string,
        counterId: row.counter_id as string,
        employeeId: (row.employee_id ?? null) as string | null,
        saleDate: row.sale_date as string,
        grossAmount: toSen(Number(row.gross_amount ?? 0)),
        returnsAmount: toSen(Number(row.returns_amount ?? 0)),
        netAmount: toSen(Number(row.net_amount ?? 0)),
        currency: "MYR",
        erpVersion: Number(row.erp_version ?? 1),
    }));
};

interface HierarchyMaps {
    directReports: Map<string, string[]>;
    allSubordinates: Map<string, string[]>;
    regionEmployees: Map<string, string[]>;
    regionNames: Map<string, string>;
}

const loadHierarchy = async (
    supabase: SupabaseClient,
    periodMonth: string,
): Promise<HierarchyMaps> => {
    const monthEnd = endOfMonth(periodMonth);
    const { data, error } = await supabase
        .from("employee_assignments")
        .select(`
            employee_id, manager_id, counter_id,
            counter:counters(outlet:outlets(state_id, state:states(name, id))),
            effective_from, effective_to
        `)
        .lte("effective_from", monthEnd)
        .or(`effective_to.is.null,effective_to.gte.${periodMonth}`);
    if (error) {
        throw new Error(`employee_assignments lookup failed: ${error.message}`);
    }
    const rows = (data ?? []) as any[];

    const directReports = new Map<string, string[]>();
    for (const row of rows) {
        if (!row.manager_id) continue;
        const list = directReports.get(row.manager_id) ?? [];
        if (!list.includes(row.employee_id)) list.push(row.employee_id);
        directReports.set(row.manager_id, list);
    }

    // Transitive closure for allSubordinates: BFS from each manager.
    const allSubordinates = new Map<string, string[]>();
    for (const manager of directReports.keys()) {
        const seen = new Set<string>();
        const queue = [...(directReports.get(manager) ?? [])];
        while (queue.length > 0) {
            const next = queue.shift()!;
            if (seen.has(next)) continue;
            seen.add(next);
            for (const child of directReports.get(next) ?? []) queue.push(child);
        }
        allSubordinates.set(manager, Array.from(seen));
    }

    // Region scope: map each state manager to every employee in the same state.
    // We pick "state manager" by cross-referencing employees with role.
    const employeesByState = new Map<string, string[]>();
    const stateNames = new Map<string, string>();
    for (const row of rows) {
        const state = row.counter?.outlet?.state;
        if (!state?.id) continue;
        stateNames.set(state.id as string, state.name as string);
        const list = employeesByState.get(state.id) ?? [];
        if (!list.includes(row.employee_id)) list.push(row.employee_id);
        employeesByState.set(state.id, list);
    }

    const { data: stateMgrRows } = await supabase
        .from("employees")
        .select(`
            id, profile_id,
            profile:profiles!inner(role),
            assignments:employee_assignments(
                counter:counters(outlet:outlets(state_id))
            )
        `)
        .eq("profile.role", "state_manager");
    const regionEmployees = new Map<string, string[]>();
    const regionNames = new Map<string, string>();
    for (const row of (stateMgrRows ?? []) as any[]) {
        const stateId = row.assignments?.[0]?.counter?.outlet?.state_id;
        if (!stateId) continue;
        regionEmployees.set(row.id, employeesByState.get(stateId) ?? []);
        regionNames.set(row.id, stateNames.get(stateId) ?? "");
    }

    return { directReports, allSubordinates, regionEmployees, regionNames };
};
