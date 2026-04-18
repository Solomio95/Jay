import { useEffect, useState } from "react";
import { supabase } from "../../supabase";

interface TodayStats {
    salesToday: number;
    salesMonth: number;
    commissionMtd: number;
    attendance: number;
}

export const useTodayStats = () => {
    const [data, setData] = useState<TodayStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            const { data: row } = await supabase.rpc("my_today_stats");
            if (row) setData(row as TodayStats);
            setLoading(false);
        })();
    }, []);

    return { data, loading };
};
