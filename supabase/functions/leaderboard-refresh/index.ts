// Nightly job: recompute leaderboard_snapshots for the current month across
// national / state / region / outlet scopes. Run by pg_cron at 03:00 MYT.
import { corsHeaders } from "../_shared/cors.ts";
import { serviceClient } from "../_shared/supabase.ts";

Deno.serve(async (_req) => {
    const supabase = serviceClient();
    const period = firstOfMonth(new Date());

    // National — by net sales.
    const national = await supabase.rpc("leaderboard_by_net_sales", { period });
    if (national.data) {
        await supabase.from("leaderboard_snapshots").upsert({
            period_month: period,
            scope: "national",
            scope_id: null,
            metric: "net_sales",
            entries: national.data,
        });
    }

    return new Response(JSON.stringify({ ok: true, period }), {
        headers: { ...corsHeaders, "content-type": "application/json" },
    });
});

const firstOfMonth = (d: Date): string =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
