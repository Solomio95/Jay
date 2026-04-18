import { useEffect, useState } from "react";
import { supabase } from "../../supabase";

export interface LeaderboardEntry {
    employeeId: string;
    name: string;
    value: number;
}

export const useLeaderboard = (scope: "national" | "state" | "region" | "outlet") => {
    const [entries, setEntries] = useState<LeaderboardEntry[]>([]);

    useEffect(() => {
        (async () => {
            const { data } = await supabase
                .from("leaderboard_snapshots")
                .select("entries, period_month")
                .eq("scope", scope)
                .order("period_month", { ascending: false })
                .limit(1)
                .maybeSingle();
            if (data?.entries) setEntries(data.entries as LeaderboardEntry[]);
        })();
    }, [scope]);

    return { entries };
};
