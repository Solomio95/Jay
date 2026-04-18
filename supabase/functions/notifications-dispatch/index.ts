// Fan notifications from `notifications` rows with delivered_at IS NULL to
// Expo Push. Triggered by a Postgres webhook on INSERT.
import { corsHeaders } from "../_shared/cors.ts";
import { serviceClient } from "../_shared/supabase.ts";

interface PushPayload {
    to: string;              // Expo push token
    title: string;
    body: string;
    data?: Record<string, unknown>;
}

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }
    const supabase = serviceClient();
    const pending = await supabase
        .from("notifications")
        .select("id, recipient_id, type, payload")
        .is("delivered_at", null)
        .limit(100);

    if (!pending.data?.length) {
        return new Response(JSON.stringify({ sent: 0 }), {
            headers: { ...corsHeaders, "content-type": "application/json" },
        });
    }

    // Load push tokens keyed by profile_id.
    const tokens = await supabase
        .from("profiles")
        .select("id, phone")  // TODO: add push_token column; phone here as placeholder
        .in(
            "id",
            pending.data.map((n) => n.recipient_id),
        );
    const tokenMap = new Map(tokens.data?.map((t) => [t.id, t.phone]) ?? []);

    const messages: PushPayload[] = pending.data
        .map((n) => {
            const tok = tokenMap.get(n.recipient_id);
            if (!tok) return null;
            return {
                to: tok,
                title: (n.payload as { title?: string }).title ?? "Bentop HR",
                body: (n.payload as { body?: string }).body ?? "",
                data: { type: n.type, notificationId: n.id },
            };
        })
        .filter((m): m is PushPayload => m !== null);

    const res = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(messages),
    });
    const sent = res.ok ? messages.length : 0;

    if (sent > 0) {
        await supabase
            .from("notifications")
            .update({ delivered_at: new Date().toISOString() })
            .in(
                "id",
                pending.data.map((n) => n.id),
            );
    }

    return new Response(JSON.stringify({ sent }), {
        headers: { ...corsHeaders, "content-type": "application/json" },
    });
});
