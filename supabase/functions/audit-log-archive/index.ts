// Archives audit_log rows older than 18 months as JSONL to the
// `audit-exports` Supabase Storage bucket, then prunes the in-table rows.
//
// Runs monthly via pg_cron. Idempotent: the upload path
// `audit-exports/yearly/{year}/month-{MM}.jsonl` is deterministic; re-runs
// overwrite with the current row set, then prune is a no-op the second time
// because the rows are already gone.

import { corsHeaders } from "../_shared/cors.ts";
import { serviceClient } from "../_shared/supabase.ts";

const jsonResponse = (body: unknown, status = 200): Response =>
    new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, "content-type": "application/json" },
    });

const firstOfMonth = (d: Date): Date =>
    new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    const supabase = serviceClient();

    // Cutoff: everything older than 18 months ago, rolled to first-of-month
    // so we archive whole calendar months.
    const now = new Date();
    const cutoffDate = firstOfMonth(
        new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 18, 1)),
    );

    // Find the oldest audit row; archive month-by-month up to cutoffDate.
    const { data: oldest, error: oldestErr } = await supabase
        .from("audit_log")
        .select("at")
        .order("at", { ascending: true })
        .limit(1)
        .maybeSingle();

    if (oldestErr) {
        return jsonResponse({ error: "oldest_lookup_failed", detail: oldestErr.message }, 500);
    }

    if (!oldest) {
        return jsonResponse({ archived_months: 0, archived_rows: 0 });
    }

    let cursor = firstOfMonth(new Date(oldest.at as string));
    const archived: { period: string; rows: number; path: string }[] = [];

    while (cursor < cutoffDate) {
        const next = firstOfMonth(
            new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1)),
        );
        const { data, error } = await supabase
            .from("audit_log")
            .select("*")
            .gte("at", cursor.toISOString())
            .lt("at", next.toISOString())
            .order("at", { ascending: true });

        if (error) {
            return jsonResponse({ error: "range_fetch_failed", detail: error.message }, 500);
        }

        const rows = data ?? [];
        if (rows.length > 0) {
            const jsonl = rows.map((r: unknown) => JSON.stringify(r)).join("\n") + "\n";
            const year = cursor.getUTCFullYear();
            const month = String(cursor.getUTCMonth() + 1).padStart(2, "0");
            const path = `yearly/${year}/month-${month}.jsonl`;

            const { error: upErr } = await supabase.storage
                .from("audit-exports")
                .upload(path, new Blob([jsonl], { type: "application/jsonl" }), {
                    upsert: true,
                });
            if (upErr) {
                return jsonResponse(
                    { error: "upload_failed", path, detail: upErr.message },
                    500,
                );
            }
            archived.push({ period: `${year}-${month}`, rows: rows.length, path });
        }
        cursor = next;
    }

    const { data: pruned, error: pruneErr } = await supabase.rpc(
        "audit_log_prune_before",
        { p_cutoff: cutoffDate.toISOString() },
    );
    if (pruneErr) {
        return jsonResponse(
            { error: "prune_failed", detail: pruneErr.message, archived },
            500,
        );
    }

    return jsonResponse({
        cutoff: cutoffDate.toISOString(),
        archived_months: archived.length,
        archived_rows: archived.reduce((n, a) => n + a.rows, 0),
        pruned_rows: pruned,
        archived,
    });
});
