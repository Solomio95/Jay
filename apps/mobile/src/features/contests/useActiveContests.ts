import { useEffect, useState } from "react";
import { supabase } from "../../supabase";

export interface ContestBrief {
    id: string;
    name: string;
    period_start: string;
    period_end: string;
    scope: string;
    prize: { amount_rm?: number } | null;
}

export interface ContestStandings {
    contest: ContestBrief;
    entries: { employeeId: string; name: string; value: number; rank: number }[];
    total: number;
    me: { rank: number | null; value: number };
}

export const useActiveContests = () => {
    const [contests, setContests] = useState<ContestBrief[]>([]);
    useEffect(() => {
        let active = true;
        supabase.rpc("active_contests").then(({ data }) => {
            if (active && data) setContests(data as ContestBrief[]);
        });
        return () => {
            active = false;
        };
    }, []);
    return contests;
};

export const useContestStandings = (contestId: string | null) => {
    const [data, setData] = useState<ContestStandings | null>(null);
    useEffect(() => {
        if (!contestId) return;
        let active = true;
        supabase
            .rpc("contest_standings", { p_contest_id: contestId, p_top: 5 })
            .then(({ data: s }) => {
                if (active && s) setData(s as ContestStandings);
            });
        return () => {
            active = false;
        };
    }, [contestId]);
    return data;
};
