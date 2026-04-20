// Drain the `notifications` queue to Expo Push.
//
// Contract
// --------
// Rows in `notifications` with `delivered_at IS NULL` are pending. We look up
// every `push_tokens` row for the recipient, build one message per token,
// batch-POST them to Expo in chunks of 100, then mark delivered_at once we
// see a 200. If Expo returns `DeviceNotRegistered` / `InvalidCredentials` we
// drop the offending token so it stops costing us calls.

import { corsHeaders } from "../_shared/cors.ts";
import { serviceClient } from "../_shared/supabase.ts";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const BATCH_SIZE = 100;

interface NotificationRow {
    id: string;
    recipient_id: string;
    type: string;
    payload: {
        title?: string;
        body?: string;
        data?: Record<string, unknown>;
    };
}

interface TokenRow {
    token: string;
    profile_id: string;
}

interface ExpoTicket {
    status: "ok" | "error";
    id?: string;
    message?: string;
    details?: { error?: string };
}

const chunk = <T>(xs: T[], n: number): T[][] => {
    const out: T[][] = [];
    for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
    return out;
};

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }
    const supabase = serviceClient();

    const { data: pending } = await supabase
        .from("notifications")
        .select("id, recipient_id, type, payload")
        .is("delivered_at", null)
        .order("created_at", { ascending: true })
        .limit(500);

    const rows = (pending ?? []) as NotificationRow[];
    if (rows.length === 0) {
        return new Response(JSON.stringify({ sent: 0, dropped: 0 }), {
            headers: { ...corsHeaders, "content-type": "application/json" },
        });
    }

    const recipients = Array.from(new Set(rows.map((r) => r.recipient_id)));
    const { data: tokens } = await supabase
        .from("push_tokens")
        .select("token, profile_id")
        .in("profile_id", recipients);
    const tokensByProfile = new Map<string, string[]>();
    for (const t of (tokens ?? []) as TokenRow[]) {
        const arr = tokensByProfile.get(t.profile_id) ?? [];
        arr.push(t.token);
        tokensByProfile.set(t.profile_id, arr);
    }

    interface OutMessage {
        to: string;
        title: string;
        body: string;
        data: Record<string, unknown>;
        sound: "default";
        // bookkeeping (stripped before send)
        _notificationId: string;
    }
    const messages: OutMessage[] = [];
    const deliveredIds = new Set<string>();

    for (const n of rows) {
        const toks = tokensByProfile.get(n.recipient_id) ?? [];
        if (toks.length === 0) {
            // Nobody to deliver to — mark delivered so we don't spin forever.
            deliveredIds.add(n.id);
            continue;
        }
        const title = n.payload.title ?? "Bentop HR";
        const body = n.payload.body ?? "";
        const data = { ...(n.payload.data ?? {}), type: n.type, notificationId: n.id };
        for (const to of toks) {
            messages.push({
                to, title, body, data, sound: "default",
                _notificationId: n.id,
            });
        }
    }

    const droppedTokens: string[] = [];
    for (const batch of chunk(messages, BATCH_SIZE)) {
        const body = batch.map(({ _notificationId: _, ...m }) => m);
        const res = await fetch(EXPO_PUSH_URL, {
            method: "POST",
            headers: { "content-type": "application/json", accept: "application/json" },
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            console.error("expo push non-200", res.status, await res.text());
            continue;
        }
        const { data: tickets } = (await res.json()) as { data: ExpoTicket[] };
        tickets.forEach((t, i) => {
            const msg = batch[i]!;
            if (t.status === "ok") {
                deliveredIds.add(msg._notificationId);
                return;
            }
            const err = t.details?.error;
            if (err === "DeviceNotRegistered" || err === "InvalidCredentials") {
                droppedTokens.push(msg.to);
            }
        });
    }

    if (deliveredIds.size > 0) {
        await supabase
            .from("notifications")
            .update({ delivered_at: new Date().toISOString() })
            .in("id", Array.from(deliveredIds));
    }
    if (droppedTokens.length > 0) {
        await supabase.from("push_tokens").delete().in("token", droppedTokens);
    }

    return new Response(
        JSON.stringify({
            sent: deliveredIds.size,
            dropped: droppedTokens.length,
            pending: rows.length,
        }),
        { headers: { ...corsHeaders, "content-type": "application/json" } },
    );
});
