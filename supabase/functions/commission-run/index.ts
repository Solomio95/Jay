// Monthly commission run orchestrator.
//
// Responsibilities:
//   1. Resolve the commission scheme (explicit id, or the active one covering
//      the period_month).
//   2. Load facts — rules, KPI rules + metrics, employees, in-period sales,
//      employee_assignments snapshot for hierarchy resolution.
//   3. Call orchestrateCommissionRun from @bentop/commission which runs the
//      pure pipeline and persists commission_runs + commission_line_items.
//
// dry_run=true returns totals in memory without writing anything — that is
// what the mobile "commission-to-date" tile hits. dry_run=false persists and
// flips the run to `approved`, which unblocks payroll-run for the period.

import { corsHeaders } from "../_shared/cors.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { orchestrateCommissionRun } from "@bentop/commission";
import { buildProvider } from "./provider.ts";

interface RunRequest {
    period_month: string;   // "2026-04-01"
    scheme_id?: string;
    dry_run?: boolean;
    run_by?: string;
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
    if (!body.period_month) {
        return jsonResponse({ error: "period_month is required" }, 400);
    }

    try {
        const supabase = serviceClient();
        const provider = buildProvider(supabase);
        const result = await orchestrateCommissionRun(
            {
                periodMonth: body.period_month,
                schemeId: body.scheme_id,
                dryRun: body.dry_run === true,
                runBy: body.run_by ?? null,
            },
            provider,
        );
        return jsonResponse(result);
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return jsonResponse({ error: "orchestration_failed", detail: message }, 500);
    }
});
