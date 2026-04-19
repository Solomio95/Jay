import { useEffect, useState } from "react";
import { supabase } from "../../supabase";
import { useAuth } from "../../auth/AuthContext";

export interface TeamMember {
    id: string;
    fullName: string;
    role: string;
    outletName: string | null;
}

// Resolves the manager's current direct reports via employee_assignments:
// rows where `manager_id` points at the manager's employee row and the
// assignment window covers today.
export const useTeam = () => {
    const { profile } = useAuth();
    const [members, setMembers] = useState<TeamMember[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!profile) return;
        let active = true;
        (async () => {
            // Find the manager's employee row (keyed by profile_id).
            const { data: me } = await supabase
                .from("employees")
                .select("id")
                .eq("profile_id", profile.id)
                .single();
            if (!me || !active) return;

            const today = new Date().toISOString().slice(0, 10);
            const { data } = await supabase
                .from("employee_assignments")
                .select(`
                    employee:employees!inner(
                        id,
                        profile:profiles(full_name, role)
                    ),
                    counter:counters(outlet:outlets(name)),
                    effective_from, effective_to
                `)
                .eq("manager_id", me.id)
                .lte("effective_from", today)
                .or(`effective_to.is.null,effective_to.gte.${today}`);
            if (!active) return;
            const rows = (data ?? []) as Array<Record<string, unknown>>;
            const mapped: TeamMember[] = rows.map((row) => {
                const emp = row.employee as {
                    id: string;
                    profile: { full_name: string; role: string } | null;
                };
                const counter = row.counter as {
                    outlet: { name: string } | null;
                } | null;
                return {
                    id: emp.id,
                    fullName: emp.profile?.full_name ?? "Unknown",
                    role: emp.profile?.role ?? "",
                    outletName: counter?.outlet?.name ?? null,
                };
            });
            setMembers(mapped);
            setLoading(false);
        })();
        return () => {
            active = false;
        };
    }, [profile]);

    return { members, loading };
};
