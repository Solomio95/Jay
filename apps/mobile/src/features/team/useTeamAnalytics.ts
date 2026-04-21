import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../supabase";

export interface TeamRow {
    employee_id: string;
    employee_no: string;
    full_name: string;
    role: string;
    net_sales: number;
    txn_count: number;
    commission: number;
    attendance_rate: number | null;
}

export interface TeamTotals {
    period_month: string;
    employees: number;
    net_sales: number;
    commission: number;
    avg_attendance: number | null;
}

const firstOfMonth = (d: Date): string =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;

export const useTeamAnalytics = (period?: string) => {
    const p = period ?? firstOfMonth(new Date());
    const [rows, setRows] = useState<TeamRow[]>([]);
    const [totals, setTotals] = useState<TeamTotals | null>(null);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        const [sumRes, totRes] = await Promise.all([
            supabase.rpc("manager_team_summary", { p_period_month: p }),
            supabase.rpc("manager_team_totals", { p_period_month: p }),
        ]);
        const sum = sumRes.data as { rows: TeamRow[] } | null;
        setRows(sum?.rows ?? []);
        setTotals((totRes.data ?? null) as TeamTotals | null);
        setLoading(false);
    }, [p]);

    useEffect(() => {
        void load();
    }, [load]);

    return { rows, totals, loading, reload: load };
};
