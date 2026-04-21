import { useEffect, useState } from "react";
import { supabase } from "../../supabase";

export interface LeaderboardEntry {
    employeeId: string;
    name: string;
    value: number;
}

export type Scope = "national" | "state" | "region" | "outlet";

// Read the latest snapshot for a given scope. For state/region/outlet the
// caller passes the scope_id (a UUID); for national it's left null.
export const useLeaderboard = (scope: Scope, scopeId: string | null = null) => {
    const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
    const [period, setPeriod] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;
        setLoading(true);
        (async () => {
            let q = supabase
                .from("leaderboard_snapshots")
                .select("entries, period_month, scope_id")
                .eq("scope", scope)
                .eq("metric", "net_sales")
                .order("period_month", { ascending: false })
                .limit(1);
            q = scopeId === null ? q.is("scope_id", null) : q.eq("scope_id", scopeId);
            const { data } = await q.maybeSingle();
            if (!active) return;
            if (data?.entries) {
                setEntries(data.entries as LeaderboardEntry[]);
                setPeriod(data.period_month as string);
            } else {
                setEntries([]);
                setPeriod(null);
            }
            setLoading(false);
        })();
        return () => {
            active = false;
        };
    }, [scope, scopeId]);

    return { entries, period, loading };
};

export interface MyPosition {
    rank: number | null;
    total: number;
    value: number;
    period: string;
}

export const useMyLeaderboardPosition = (): { data: MyPosition | null } => {
    const [data, setData] = useState<MyPosition | null>(null);
    useEffect(() => {
        let active = true;
        (async () => {
            const { data: pos } = await supabase.rpc("my_leaderboard_position");
            if (!active) return;
            if (pos) setData(pos as MyPosition);
        })();
        return () => {
            active = false;
        };
    }, []);
    return { data };
};
