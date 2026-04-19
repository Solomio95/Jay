import { useEffect, useState } from "react";
import { supabase } from "../../supabase";
import { useAuth } from "../../auth/AuthContext";

export interface ApprovalItem {
    id: string;
    kind: "leave_request" | "ot_record";
    requesterName: string;
    summary: string;
}

// Pulls leave_requests + ot_records where the signed-in manager is the current
// approver. RLS is what really protects this; the filters below keep payload
// size small and let the list render without an extra hop.
export const usePendingApprovals = () => {
    const { profile } = useAuth();
    const [items, setItems] = useState<ApprovalItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!profile) return;
        let active = true;
        (async () => {
            const [leave, ot] = await Promise.all([
                supabase
                    .from("leave_requests")
                    .select(`
                        id, start_date, end_date, days,
                        leave_type:leave_types(code),
                        employee:employees!inner(
                            id,
                            profile:profiles(full_name)
                        )
                    `)
                    .eq("status", "pending")
                    .eq("current_approver_id", profile.id),
                supabase
                    .from("ot_records")
                    .select(`
                        id, work_date, hours, rate_multiplier,
                        employee:employees!inner(
                            id,
                            profile:profiles(full_name)
                        )
                    `)
                    .eq("status", "pending")
                    .eq("approved_by", profile.id),
            ]);
            if (!active) return;
            const combined: ApprovalItem[] = [];
            for (const row of (leave.data ?? []) as Array<Record<string, unknown>>) {
                const emp = row.employee as {
                    profile: { full_name: string } | null;
                } | null;
                const lt = row.leave_type as { code: string } | null;
                combined.push({
                    id: row.id as string,
                    kind: "leave_request",
                    requesterName: emp?.profile?.full_name ?? "Unknown",
                    summary: `${lt?.code ?? "Leave"} · ${row.days} day(s) from ${row.start_date}`,
                });
            }
            for (const row of (ot.data ?? []) as Array<Record<string, unknown>>) {
                const emp = row.employee as {
                    profile: { full_name: string } | null;
                } | null;
                combined.push({
                    id: row.id as string,
                    kind: "ot_record",
                    requesterName: emp?.profile?.full_name ?? "Unknown",
                    summary: `OT ${row.hours}h × ${row.rate_multiplier} on ${row.work_date}`,
                });
            }
            setItems(combined);
            setLoading(false);
        })();
        return () => {
            active = false;
        };
    }, [profile]);

    return { items, loading };
};
