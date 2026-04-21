// Refresh leaderboard_snapshots for a given period across every scope:
// one national row, one per state, one per state (aliased as region), and
// one per active outlet. Mobile reads the latest snapshot — we never
// recompute on the device.
//
// Intended to be triggered hourly by pg_cron, and manually from admin-web
// after a large ERP sync.

import { corsHeaders } from "../_shared/cors.ts";
import { serviceClient } from "../_shared/supabase.ts";

const jsonResponse = (body: unknown, status = 200): Response =>
    new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, "content-type": "application/json" },
    });

interface Req {
    period?: string;  // ISO first-of-month; defaults to current month.
}

const firstOfMonth = (d: Date): string =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    let body: Req = {};
    if (req.method === "POST") {
        try { body = (await req.json()) as Req; } catch { /* empty body ok */ }
    }
    const period = body.period ?? firstOfMonth(new Date());

    const supabase = serviceClient();
    const summaries: Array<{ scope: string; scope_id: string | null; count: number }> = [];

    const upsertSnapshot = async (
        scope: "national" | "state" | "region" | "outlet",
        scopeId: string | null,
    ) => {
        const { data, error } = await supabase.rpc("leaderboard_by_net_sales_scoped", {
            p_period: period,
            p_scope: scope,
            p_scope_id: scopeId,
        });
        if (error) throw new Error(`rpc ${scope} ${scopeId ?? "-"}: ${error.message}`);
        const entries = Array.isArray(data) ? data : [];
        summaries.push({ scope, scope_id: scopeId, count: entries.length });

        // Delete-then-insert rather than upsert: scope_id is nullable so a
        // plain unique constraint with onConflict doesn't apply cleanly.
        let del = supabase
            .from("leaderboard_snapshots")
            .delete()
            .eq("period_month", period)
            .eq("scope", scope)
            .eq("metric", "net_sales");
        del = scopeId === null ? del.is("scope_id", null) : del.eq("scope_id", scopeId);
        const delRes = await del;
        if (delRes.error) throw new Error(`delete ${scope}: ${delRes.error.message}`);

        const ins = await supabase.from("leaderboard_snapshots").insert({
            period_month: period,
            scope,
            scope_id: scopeId,
            metric: "net_sales",
            entries,
            generated_at: new Date().toISOString(),
        });
        if (ins.error) throw new Error(`insert ${scope}: ${ins.error.message}`);
    };

    try {
        await upsertSnapshot("national", null);

        const [{ data: states }, { data: outlets }] = await Promise.all([
            supabase.from("states").select("id"),
            supabase.from("outlets").select("id").eq("active", true),
        ]);

        await Promise.all([
            ...((states ?? []) as { id: string }[]).flatMap((s) => [
                upsertSnapshot("state", s.id),
                upsertSnapshot("region", s.id),
            ]),
            ...((outlets ?? []) as { id: string }[]).map((o) =>
                upsertSnapshot("outlet", o.id),
            ),
        ]);
    } catch (err) {
        return jsonResponse(
            { error: "refresh_failed", detail: err instanceof Error ? err.message : String(err) },
            500,
        );
    }

    return jsonResponse({ period, scopes: summaries.length, summaries });
});
