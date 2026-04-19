// deno-lint-ignore-file no-explicit-any
//
// Supabase-backed OrchestrationProvider for the payroll-run edge function.
//
// The orchestrator is pure and lives in @bentop/payroll-my; this file is the
// one place that speaks to Postgres and Storage. Every query keeps payload
// minimal (select only the columns the orchestrator needs) and fails fast
// with a clear message — the orchestrator wraps these in a 500 response.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.46.1";
import type { Payslip, Sen } from "@bentop/domain";
import { toSen } from "@bentop/domain";
import type {
    EmployeeRunContext,
    OrchestrationProvider,
    PayrollRunMeta,
} from "@bentop/payroll-my";
import type { PayslipPdfCompany, PayslipPdfEmployee } from "@bentop/pdf";

const REQUIRED_STATUTORY_KINDS = ["epf", "socso", "eis", "pcb"] as const;
const PAYSLIP_BUCKET = "payslips";

const rmToSen = (rm: number | string | null | undefined): Sen =>
    toSen(Number(rm ?? 0));

export const buildProvider = (supabase: SupabaseClient): OrchestrationProvider => ({
    async assertRatesCoverPayDate(payDate: string) {
        for (const kind of REQUIRED_STATUTORY_KINDS) {
            const { data, error } = await supabase
                .from("statutory_rate_tables")
                .select("id")
                .eq("kind", kind)
                .lte("effective_from", payDate)
                .or(`effective_to.is.null,effective_to.gte.${payDate}`)
                .limit(1);
            if (error) {
                throw new Error(`statutory rate lookup failed for ${kind}: ${error.message}`);
            }
            if (!data || data.length === 0) {
                throw new Error(
                    `no statutory rate row covers pay_date ${payDate} for ${kind}`,
                );
            }
        }
    },

    async assertCommissionRunApproved(periodMonth: string) {
        const { data, error } = await supabase
            .from("commission_runs")
            .select("id, status")
            .eq("period_month", periodMonth)
            .order("run_at", { ascending: false })
            .limit(1)
            .maybeSingle();
        if (error) {
            throw new Error(`commission_runs lookup failed: ${error.message}`);
        }
        if (!data) {
            throw new Error(`no commission run exists for ${periodMonth}`);
        }
        if (data.status !== "approved" && data.status !== "locked") {
            throw new Error(
                `commission run for ${periodMonth} is ${data.status}, not approved`,
            );
        }
    },

    async listEmployeeContexts(run: PayrollRunMeta): Promise<EmployeeRunContext[]> {
        // Pull active employees + their profile for PDF metadata.
        const { data: employees, error: empErr } = await supabase
            .from("employees")
            .select(`
                id,
                employee_no,
                epf_no,
                socso_no,
                tax_no,
                bank_name,
                bank_account,
                pcb_category,
                base_salary,
                profile:profiles!inner(
                    id, full_name, ic_number, status
                )
            `)
            .eq("profile.status", "active");
        if (empErr) {
            throw new Error(`employees lookup failed: ${empErr.message}`);
        }

        const contexts: EmployeeRunContext[] = [];
        for (const emp of employees ?? []) {
            const ytd = await fetchYtd(supabase, emp.id, run.periodMonth);
            const monthTotals = await fetchMonthTotals(
                supabase,
                emp.id,
                run.periodMonth,
            );

            const input = {
                employeeId: emp.id as string,
                payrollRunId: run.id,
                periodMonth: run.periodMonth,
                monthIndex: run.monthIndex,
                ageYears: 30, // TODO: derive from profiles.ic_number; placeholder until IC-parser lands
                pcbCategory: (emp.pcb_category ?? "K") as string,
                grossBasic: rmToSen(emp.base_salary),
                grossAllowances: toSen(0),
                grossOt: monthTotals.ot,
                grossCommission: monthTotals.commission,
                grossKpiBonus: monthTotals.kpiBonus,
                grossOtherAdditional: toSen(0),
                ytdNormalTaxableSen: ytd.normalTaxable,
                ytdAdditionalTaxableSen: ytd.additionalTaxable,
                ytdEpfEmployeeSen: ytd.epfEmployee,
                ytdSocsoEmployeeSen: ytd.socsoEmployee,
                ytdZakatSen: toSen(0),
                ytdMtdPaidSen: ytd.mtdPaid,
            };

            const profile = emp.profile as any;
            const employee: PayslipPdfEmployee = {
                fullName: profile?.full_name ?? "Unknown",
                employeeNo: emp.employee_no as string,
                icNo: profile?.ic_number ?? undefined,
                bankName: emp.bank_name ?? undefined,
                bankAccount: emp.bank_account ?? undefined,
                epfNo: emp.epf_no ?? undefined,
                socsoNo: emp.socso_no ?? undefined,
                taxNo: emp.tax_no ?? undefined,
            };
            contexts.push({ input, employee });
        }
        return contexts;
    },

    async getCompany(): Promise<PayslipPdfCompany> {
        const { data, error } = await supabase
            .from("app_settings")
            .select("value")
            .eq("key", "company_profile")
            .maybeSingle();
        if (error) {
            throw new Error(`app_settings lookup failed: ${error.message}`);
        }
        if (!data?.value) {
            throw new Error("company_profile not set in app_settings");
        }
        const v = data.value as any;
        return {
            name: v.name,
            registrationNo: v.registration_no,
            addressLines: v.address_lines ?? [],
        };
    },

    async upsertPayslip(payslip: Payslip, employeeId: string): Promise<string> {
        const row = {
            payroll_run_id: payslip.payrollRunId,
            employee_id: employeeId,
            version: 1,
            gross_basic: payslip.grossBasic / 100,
            gross_allowances: payslip.grossAllowances / 100,
            gross_commission: payslip.grossCommission / 100,
            gross_ot: payslip.grossOt / 100,
            gross_kpi_bonus: payslip.grossKpiBonus / 100,
            gross_total: payslip.grossTotal / 100,
            epf_employee: payslip.epfEmployee / 100,
            epf_employer: payslip.epfEmployer / 100,
            socso_employee: payslip.socsoEmployee / 100,
            socso_employer: payslip.socsoEmployer / 100,
            eis_employee: payslip.eisEmployee / 100,
            eis_employer: payslip.eisEmployer / 100,
            pcb: payslip.pcb / 100,
            other_deductions: payslip.otherDeductions,
            net_pay: payslip.netPay / 100,
        };
        const { data, error } = await supabase
            .from("payslips")
            .upsert(row, {
                onConflict: "payroll_run_id,employee_id,version",
            })
            .select("id")
            .single();
        if (error || !data) {
            throw new Error(`payslips upsert failed: ${error?.message}`);
        }
        return data.id as string;
    },

    async uploadPayslipPdf(
        payslipId: string,
        run: PayrollRunMeta,
        employee: PayslipPdfEmployee,
        bytes: Uint8Array,
    ): Promise<string> {
        const [year, month] = run.periodMonth.split("-");
        const path = `${year}/${month}/${employee.employeeNo}-${payslipId}.pdf`;
        const { error } = await supabase.storage
            .from(PAYSLIP_BUCKET)
            .upload(path, bytes, {
                contentType: "application/pdf",
                upsert: true,
            });
        if (error) {
            throw new Error(`payslip upload failed: ${error.message}`);
        }
        return `storage://${PAYSLIP_BUCKET}/${path}`;
    },

    async setPayslipPdfUrl(payslipId: string, pdfUrl: string): Promise<void> {
        const { error } = await supabase
            .from("payslips")
            .update({ pdf_url: pdfUrl })
            .eq("id", payslipId);
        if (error) {
            throw new Error(`payslip pdf_url update failed: ${error.message}`);
        }
    },

    async transitionRunStatus(runId: string, status: "previewed" | "approved") {
        const { error } = await supabase
            .from("payroll_runs")
            .update({ status })
            .eq("id", runId);
        if (error) {
            throw new Error(`payroll_runs status update failed: ${error.message}`);
        }
    },
});

// --- Helpers --------------------------------------------------------------

interface YtdTotals {
    normalTaxable: Sen;
    additionalTaxable: Sen;
    epfEmployee: Sen;
    socsoEmployee: Sen;
    mtdPaid: Sen;
}

const fetchYtd = async (
    supabase: SupabaseClient,
    employeeId: string,
    periodMonth: string,
): Promise<YtdTotals> => {
    const yearStart = `${periodMonth.slice(0, 4)}-01-01`;
    const { data, error } = await supabase
        .from("payslips")
        .select(`
            gross_basic, gross_allowances, gross_ot,
            gross_commission, gross_kpi_bonus,
            epf_employee, socso_employee, pcb,
            payroll_run:payroll_runs!inner(period_month)
        `)
        .eq("employee_id", employeeId)
        .gte("payroll_run.period_month", yearStart)
        .lt("payroll_run.period_month", periodMonth);
    if (error) {
        throw new Error(`ytd payslips lookup failed: ${error.message}`);
    }
    const rows = (data ?? []) as any[];
    let normalRm = 0;
    let additionalRm = 0;
    let epfRm = 0;
    let socsoRm = 0;
    let mtdRm = 0;
    for (const r of rows) {
        normalRm += Number(r.gross_basic ?? 0) + Number(r.gross_allowances ?? 0) + Number(r.gross_ot ?? 0);
        additionalRm += Number(r.gross_commission ?? 0) + Number(r.gross_kpi_bonus ?? 0);
        epfRm += Number(r.epf_employee ?? 0);
        socsoRm += Number(r.socso_employee ?? 0);
        mtdRm += Number(r.pcb ?? 0);
    }
    return {
        normalTaxable: toSen(normalRm),
        additionalTaxable: toSen(additionalRm),
        epfEmployee: toSen(epfRm),
        socsoEmployee: toSen(socsoRm),
        mtdPaid: toSen(mtdRm),
    };
};

interface MonthTotals {
    commission: Sen;
    kpiBonus: Sen;
    ot: Sen;
}

const fetchMonthTotals = async (
    supabase: SupabaseClient,
    employeeId: string,
    periodMonth: string,
): Promise<MonthTotals> => {
    const { data: commissionRows, error: cErr } = await supabase
        .from("commission_line_items")
        .select(`
            computed_amount,
            kpi_rule_id,
            commission_run:commission_runs!inner(period_month, status)
        `)
        .eq("employee_id", employeeId)
        .eq("commission_run.period_month", periodMonth);
    if (cErr) {
        throw new Error(`commission lookup failed: ${cErr.message}`);
    }
    let commissionRm = 0;
    let kpiRm = 0;
    for (const row of (commissionRows ?? []) as any[]) {
        const amt = Number(row.computed_amount ?? 0);
        if (row.kpi_rule_id) kpiRm += amt;
        else commissionRm += amt;
    }

    const monthStart = periodMonth;
    const monthEnd = endOfMonth(periodMonth);
    const { data: otRows, error: oErr } = await supabase
        .from("ot_records")
        .select("hours, rate_multiplier")
        .eq("employee_id", employeeId)
        .eq("status", "approved")
        .eq("disposition", "pay")
        .gte("work_date", monthStart)
        .lte("work_date", monthEnd);
    if (oErr) {
        throw new Error(`ot_records lookup failed: ${oErr.message}`);
    }
    // OT pay assumes hourly_rate already baked in at approval time. For now we
    // treat `hours * rate_multiplier` as an approximate sen amount placeholder;
    // the commission/OT pipeline will refine this in Phase 2.
    let otRm = 0;
    for (const row of (otRows ?? []) as any[]) {
        otRm += Number(row.hours ?? 0) * Number(row.rate_multiplier ?? 1.5);
    }

    return {
        commission: toSen(commissionRm),
        kpiBonus: toSen(kpiRm),
        ot: toSen(otRm),
    };
};

const endOfMonth = (periodMonth: string): string => {
    const [y, m] = periodMonth.split("-").map(Number);
    const d = new Date(Date.UTC(y!, m!, 0));
    return d.toISOString().slice(0, 10);
};
