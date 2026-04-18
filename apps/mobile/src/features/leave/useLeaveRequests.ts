import { useEffect, useState } from "react";
import type { LeaveCode, LeaveRequest } from "@bentop/domain";
import { supabase } from "../../supabase";

interface BalanceRow {
    code: LeaveCode;
    available: number;
}

export const useLeaveRequests = () => {
    const [requests, setRequests] = useState<LeaveRequest[]>([]);
    const [balances, setBalances] = useState<BalanceRow[]>([]);

    useEffect(() => {
        (async () => {
            const { data: r } = await supabase
                .from("leave_requests")
                .select("*")
                .order("created_at", { ascending: false });
            if (r) setRequests(r as unknown as LeaveRequest[]);

            const { data: b } = await supabase.rpc("my_leave_balances");
            if (b) setBalances(b as BalanceRow[]);
        })();
    }, []);

    return { requests, balances };
};
