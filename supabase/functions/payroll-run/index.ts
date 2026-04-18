// Monthly payroll orchestrator.
//   1. Ensure commission_run for the period is approved.
//   2. For each employee, compute gross -> EPF/SOCSO/EIS/PCB -> net via
//      packages/payroll-my.
//   3. Write payslips, generate PDFs, upload to storage, link pdf_url.
//   4. Transition payroll_runs.status from draft -> previewed.
// HR reviews previewed output, then calls a separate /approve endpoint to lock.

import { corsHeaders } from "../_shared/cors.ts";
import { serviceClient } from "../_shared/supabase.ts";

interface RunRequest {
    period_month: string;  // "2026-04-01"
    pay_date: string;      // "2026-05-07"
    cutoff_date: string;   // "2026-04-30"
}

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }
    const supabase = serviceClient();
    const body = (await req.json()) as RunRequest;

    // Load or create the payroll run.
    const existing = await supabase
        .from("payroll_runs")
        .select("*")
        .eq("period_month", body.period_month)
        .maybeSingle();

    const run = existing.data
        ? existing.data
        : (await supabase
              .from("payroll_runs")
              .insert({
                  period_month: body.period_month,
                  pay_date: body.pay_date,
                  cutoff_date: body.cutoff_date,
                  status: "draft",
              })
              .select()
              .single()).data;
    if (!run) {
        return new Response(JSON.stringify({ error: "Could not init run" }), {
            status: 500,
            headers: { ...corsHeaders, "content-type": "application/json" },
        });
    }

    if (run.status === "approved" || run.status === "paid" || run.status === "closed") {
        return new Response(
            JSON.stringify({ error: "Run is already locked", status: run.status }),
            { status: 409, headers: { ...corsHeaders, "content-type": "application/json" } },
        );
    }

    // TODO: load effective statutory_rate_tables; error hard if no row covers pay_date.
    // TODO: import computePayslip from packages/payroll-my, produce rows.
    // TODO: generate PDFs via packages/pdf, upload to storage/payslips/...

    await supabase
        .from("payroll_runs")
        .update({ status: "previewed" })
        .eq("id", run.id);

    return new Response(JSON.stringify({ payroll_run_id: run.id, status: "previewed" }), {
        headers: { ...corsHeaders, "content-type": "application/json" },
    });
});
