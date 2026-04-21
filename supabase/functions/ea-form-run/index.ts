// Generate Form EA PDFs for every employee with at least one payslip in the
// requested year. Upload to Storage, upsert `ea_forms`, return a summary.
//
// This runs once at year-end (HR has until the last day of February).
// Re-running is safe: the upsert-by-(employee_id, year) overwrites the row
// and the uploaded PDF is keyed by the same path, so the latest run wins.

import { corsHeaders } from "../_shared/cors.ts";
import { serviceClient } from "../_shared/supabase.ts";
import type { Sen } from "@bentop/domain";
import { aggregateEaForm } from "@bentop/payroll-my";
import { renderEaFormPdf } from "@bentop/pdf";

const BUCKET = "ea-forms";

const jsonResponse = (body: unknown, status = 200): Response =>
    new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, "content-type": "application/json" },
    });

interface RunRequest {
    year: number;
}

interface PayslipRow {
    id: string;
    employee_id: string;
    period_month: string;
    gross_basic: number;
    gross_allowances: number;
    gross_commission: number;
    gross_ot: number;
    gross_kpi_bonus: number;
    gross_total: number;
    epf_employee: number;
    epf_employer: number;
    socso_employee: number;
    socso_employer: number;
    eis_employee: number;
    eis_employer: number;
    pcb: number;
    net_pay: number;
}

interface EmployeeRow {
    id: string;
    employee_no: string;
    epf_no: string | null;
    socso_no: string | null;
    tax_no: string | null;
    profile: {
        full_name: string;
        ic_number: string | null;
        hired_on: string | null;
        terminated_on: string | null;
    } | null;
}

const rmToSen = (rm: number | string | null | undefined): Sen =>
    Math.round(Number(rm ?? 0) * 100) as Sen;

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }
    if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

    let body: RunRequest;
    try {
        body = (await req.json()) as RunRequest;
    } catch {
        return jsonResponse({ error: "invalid_json_body" }, 400);
    }
    const year = Number(body.year);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
        return jsonResponse({ error: "invalid_year" }, 400);
    }

    const supabase = serviceClient();

    // Employer info is kept in app_settings so HR can update it without a code release.
    const { data: employerSetting } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "payroll.employer")
        .maybeSingle();
    const employer = (employerSetting?.value ?? null) as
        | { name: string; employerE: string; address: string[] }
        | null;
    if (!employer) {
        return jsonResponse(
            { error: "missing_employer_setting", detail: "app_settings.payroll.employer is not set" },
            500,
        );
    }

    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;

    const { data: payslipsAll, error: psErr } = await supabase
        .from("payslips")
        .select(
            "id, employee_id, period_month, gross_basic, gross_allowances, gross_commission, gross_ot, gross_kpi_bonus, gross_total, epf_employee, epf_employer, socso_employee, socso_employer, eis_employee, eis_employer, pcb, net_pay, payroll_runs!inner(period_month)",
        )
        .gte("payroll_runs.period_month", yearStart)
        .lte("payroll_runs.period_month", yearEnd);
    if (psErr) return jsonResponse({ error: "payslip_query_failed", detail: psErr.message }, 500);

    const byEmployee = new Map<string, PayslipRow[]>();
    for (const row of (payslipsAll ?? []) as unknown as (PayslipRow & { payroll_runs: { period_month: string } })[]) {
        // Use the run's period_month as the payslip period for aggregation.
        const period = row.payroll_runs.period_month;
        const slim: PayslipRow = { ...row, period_month: period };
        const arr = byEmployee.get(row.employee_id) ?? [];
        arr.push(slim);
        byEmployee.set(row.employee_id, arr);
    }

    if (byEmployee.size === 0) {
        return jsonResponse({ generated: 0, year, message: "no payslips in year" });
    }

    const { data: employees, error: empErr } = await supabase
        .from("employees")
        .select(
            "id, employee_no, epf_no, socso_no, tax_no, profile:profiles!inner(full_name, ic_number, hired_on, terminated_on)",
        )
        .in("id", Array.from(byEmployee.keys()));
    if (empErr) return jsonResponse({ error: "employee_query_failed", detail: empErr.message }, 500);

    const empById = new Map(
        ((employees ?? []) as unknown as EmployeeRow[]).map((e) => [e.id, e]),
    );

    const generated: string[] = [];
    const failed: { employeeId: string; reason: string }[] = [];

    for (const [employeeId, slips] of byEmployee) {
        const emp = empById.get(employeeId);
        if (!emp) {
            failed.push({ employeeId, reason: "employee_not_found" });
            continue;
        }

        const payslips = slips.map((ps) => ({
            employeeId: ps.employee_id,
            payrollRunId: "",
            periodMonth: ps.period_month,
            grossBasic: rmToSen(ps.gross_basic),
            grossAllowances: rmToSen(ps.gross_allowances),
            grossCommission: rmToSen(ps.gross_commission),
            grossOt: rmToSen(ps.gross_ot),
            grossKpiBonus: rmToSen(ps.gross_kpi_bonus),
            grossTotal: rmToSen(ps.gross_total),
            epfEmployee: rmToSen(ps.epf_employee),
            epfEmployer: rmToSen(ps.epf_employer),
            socsoEmployee: rmToSen(ps.socso_employee),
            socsoEmployer: rmToSen(ps.socso_employer),
            eisEmployee: rmToSen(ps.eis_employee),
            eisEmployer: rmToSen(ps.eis_employer),
            pcb: rmToSen(ps.pcb),
            otherDeductions: [],
            netPay: rmToSen(ps.net_pay),
        }));

        const payload = aggregateEaForm({
            year,
            employee: {
                employeeNo: emp.employee_no,
                fullName: emp.profile?.full_name ?? "",
                icNo: emp.profile?.ic_number ?? null,
                taxNo: emp.tax_no,
                epfNo: emp.epf_no,
                socsoNo: emp.socso_no,
                position: null,
                hiredOn: emp.profile?.hired_on ?? null,
                terminatedOn: emp.profile?.terminated_on ?? null,
            },
            employer,
            payslips,
        });

        try {
            const bytes = await renderEaFormPdf(payload);
            const path = `${year}/${emp.employee_no}.pdf`;
            const uploaded = await supabase.storage
                .from(BUCKET)
                .upload(path, bytes, {
                    contentType: "application/pdf",
                    upsert: true,
                });
            if (uploaded.error) throw new Error(uploaded.error.message);

            const { data: signed } = await supabase.storage
                .from(BUCKET)
                .createSignedUrl(path, 60 * 60 * 24 * 365);

            const up = await supabase
                .from("ea_forms")
                .upsert(
                    {
                        employee_id: employeeId,
                        year,
                        pdf_url: signed?.signedUrl ?? null,
                        generated_at: new Date().toISOString(),
                    },
                    { onConflict: "employee_id,year" },
                );
            if (up.error) throw new Error(up.error.message);

            generated.push(emp.employee_no);
        } catch (err) {
            failed.push({
                employeeId,
                reason: err instanceof Error ? err.message : String(err),
            });
        }
    }

    return jsonResponse({
        year,
        generated: generated.length,
        failed: failed.length,
        details: { generated, failed },
    });
});
