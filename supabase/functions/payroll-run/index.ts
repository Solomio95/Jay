// Monthly payroll orchestrator.
//
// Responsibilities:
//   1. Ensure the commission_run for the period is `approved`.
//   2. Ensure statutory_rate_tables rows cover the pay_date for EPF/SOCSO/EIS/PCB.
//   3. For each active employee, build an EmployeePayrollInput from:
//        - the employee + profile rows
//        - YTD totals from prior payslips
//        - this month's commission total (from commission_line_items)
//        - KPI bonus total + OT total
//   4. Call orchestratePayrollRun from @bentop/payroll-my, which:
//        - computes EPF/SOCSO/EIS/PCB via the calculators
//        - renders a payslip PDF via @bentop/pdf
//        - persists payslip rows and uploads PDFs through the provider below
//   5. Transition payroll_runs.status from draft -> previewed.
//
// HR then reviews and calls a separate /approve endpoint to lock the run.

import { corsHeaders } from "../_shared/cors.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { buildProvider } from "./provider.ts";
import type { PayrollRunMeta } from "@bentop/payroll-my";
import { orchestratePayrollRun } from "@bentop/payroll-my";

interface RunRequest {
    period_month: string;  // "2026-04-01"
    pay_date: string;      // "2026-05-07"
    cutoff_date: string;   // "2026-04-30"
}

const jsonResponse = (body: unknown, status = 200): Response =>
    new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, "content-type": "application/json" },
    });

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }
    if (req.method !== "POST") {
        return jsonResponse({ error: "method_not_allowed" }, 405);
    }

    let body: RunRequest;
    try {
        body = (await req.json()) as RunRequest;
    } catch {
        return jsonResponse({ error: "invalid_json_body" }, 400);
    }
    if (!body.period_month || !body.pay_date || !body.cutoff_date) {
        return jsonResponse(
            { error: "period_month, pay_date, and cutoff_date are required" },
            400,
        );
    }

    const supabase = serviceClient();

    // Upsert-by-period: draft created if absent, reused if present.
    const existing = await supabase
        .from("payroll_runs")
        .select("*")
        .eq("period_month", body.period_month)
        .maybeSingle();

    let run = existing.data;
    if (!run) {
        const inserted = await supabase
            .from("payroll_runs")
            .insert({
                period_month: body.period_month,
                pay_date: body.pay_date,
                cutoff_date: body.cutoff_date,
                status: "draft",
            })
            .select()
            .single();
        if (inserted.error || !inserted.data) {
            return jsonResponse(
                { error: "could_not_init_run", detail: inserted.error?.message },
                500,
            );
        }
        run = inserted.data;
    }

    if (run.status === "approved" || run.status === "paid" || run.status === "closed") {
        return jsonResponse(
            { error: "run_locked", status: run.status, payroll_run_id: run.id },
            409,
        );
    }

    const meta: PayrollRunMeta = {
        id: run.id,
        periodMonth: body.period_month,
        payDate: body.pay_date,
        cutoffDate: body.cutoff_date,
        monthIndex: Number(body.period_month.slice(5, 7)),
    };

    try {
        const provider = buildProvider(supabase);
        const result = await orchestratePayrollRun(meta, provider);
        return jsonResponse(result);
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return jsonResponse(
            { error: "orchestration_failed", detail: message, payroll_run_id: run.id },
            500,
        );
    }
});
