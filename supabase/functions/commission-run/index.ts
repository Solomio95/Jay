// Monthly commission run. Edge function that:
//   1. Loads the active scheme + rules + KPI metrics + sales for the period.
//   2. Invokes the shared @bentop/commission pipeline.
//   3. Writes commission_runs + commission_line_items.
//
// The pipeline logic lives in packages/commission so it can also be imported
// by the admin "scheme simulator" and the mobile app's commission-to-date tile.
// This function is the Postgres-facing adapter.

import { corsHeaders } from "../_shared/cors.ts";
import { serviceClient } from "../_shared/supabase.ts";

interface RunRequest {
    period_month: string;  // e.g. "2026-04-01"
    scheme_id?: string;
    dry_run?: boolean;
}

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }
    const supabase = serviceClient();
    const { period_month, scheme_id, dry_run } = (await req.json()) as RunRequest;

    const scheme = scheme_id
        ? await supabase.from("commission_schemes").select("*").eq("id", scheme_id).single()
        : await supabase
              .from("commission_schemes")
              .select("*")
              .eq("status", "active")
              .lte("effective_from", period_month)
              .order("effective_from", { ascending: false })
              .limit(1)
              .single();
    if (!scheme.data) {
        return new Response(JSON.stringify({ error: "No active scheme" }), {
            status: 400,
            headers: { ...corsHeaders, "content-type": "application/json" },
        });
    }

    // TODO: call packages/commission runCommissionPipeline with loaded facts.
    // Deno edge functions import pure TS modules via esm.sh or a prebuilt bundle.
    // Placeholder response until the bundler step is wired.
    return new Response(
        JSON.stringify({
            ok: true,
            dry_run: !!dry_run,
            scheme_id: scheme.data.id,
            period_month,
            note: "pipeline wiring pending — see packages/commission",
        }),
        { headers: { ...corsHeaders, "content-type": "application/json" } },
    );
});
