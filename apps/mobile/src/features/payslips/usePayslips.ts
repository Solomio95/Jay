import { useEffect, useState } from "react";
import { supabase } from "../../supabase";

export interface PayslipRow {
    id: string;
    periodMonth: string;
    netPay: number;
    pdfUrl?: string;
}

export const usePayslips = () => {
    const [payslips, setPayslips] = useState<PayslipRow[]>([]);

    useEffect(() => {
        (async () => {
            const { data } = await supabase
                .from("payslips")
                .select("id, payroll_run:payroll_runs(period_month), net_pay, pdf_url")
                .order("generated_at", { ascending: false });
            if (data) {
                setPayslips(
                    data.map((row: Record<string, unknown>) => {
                        const pdfUrl = row.pdf_url as string | undefined;
                        const base = {
                            id: row.id as string,
                            periodMonth: (row.payroll_run as { period_month: string })
                                .period_month,
                            netPay: Number(row.net_pay ?? 0),
                        };
                        return pdfUrl ? { ...base, pdfUrl } : base;
                    }),
                );
            }
        })();
    }, []);

    return { payslips };
};
