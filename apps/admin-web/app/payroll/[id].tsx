import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Button,
    FlatList,
    Text,
    View,
} from "react-native";
import { buildMaybankBulkFile } from "@bentop/payroll-my";
import { supabase } from "../../src/supabase";
import { toBankCode } from "../../src/bankCodes";

interface PayrollRun {
    id: string;
    period_month: string;
    status: string;
    pay_date: string;
    cutoff_date: string;
    approved_at: string | null;
}

interface PayslipRow {
    id: string;
    employee_id: string;
    gross_total: number;
    epf_employee: number;
    socso_employee: number;
    eis_employee: number;
    pcb: number;
    net_pay: number;
    pdf_url: string | null;
    employee: {
        employee_no: string;
        bank_name: string | null;
        bank_account: string | null;
        profile: {
            full_name: string;
            ic_number: string | null;
            email: string | null;
        } | null;
    } | null;
}

interface Totals {
    gross: number;
    epf: number;
    socso: number;
    eis: number;
    pcb: number;
    net: number;
}

const zero: Totals = { gross: 0, epf: 0, socso: 0, eis: 0, pcb: 0, net: 0 };

export default function PayrollRunDetail() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const [run, setRun] = useState<PayrollRun | null>(null);
    const [payslips, setPayslips] = useState<PayslipRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [approving, setApproving] = useState(false);

    const load = useCallback(async () => {
        if (!id) return;
        const [runRes, psRes] = await Promise.all([
            supabase
                .from("payroll_runs")
                .select("id, period_month, status, pay_date, cutoff_date, approved_at")
                .eq("id", id)
                .single(),
            supabase
                .from("payslips")
                .select(`
                    id, employee_id, gross_total,
                    epf_employee, socso_employee, eis_employee, pcb,
                    net_pay, pdf_url,
                    employee:employees!inner(
                        employee_no, bank_name, bank_account,
                        profile:profiles(full_name, ic_number, email)
                    )
                `)
                .eq("payroll_run_id", id)
                .order("employee_id"),
        ]);
        if (runRes.error) {
            Alert.alert("Could not load run", runRes.error.message);
            return;
        }
        setRun(runRes.data as PayrollRun);
        setPayslips((psRes.data ?? []) as unknown as PayslipRow[]);
        setLoading(false);
    }, [id]);

    useEffect(() => {
        void load();
    }, [load]);

    const approve = async () => {
        if (!id) return;
        setApproving(true);
        const { error } = await supabase.rpc("approve_payroll_run", {
            p_run_id: id,
        });
        setApproving(false);
        if (error) {
            Alert.alert("Approval failed", error.message);
            return;
        }
        await load();
    };

    const downloadBankFile = async () => {
        if (!run) return;
        const { data: setting } = await supabase
            .from("app_settings")
            .select("value")
            .eq("key", "payroll.org_bank_account")
            .maybeSingle();
        const orgAccount =
            (setting?.value as { account?: string } | null)?.account ?? "";
        if (!orgAccount) {
            Alert.alert(
                "Bank account not configured",
                "Set app_settings.payroll.org_bank_account = { \"account\": \"…\" } before exporting.",
            );
            return;
        }
        const { text, skipped, totalAmountSen, totalCount } = buildMaybankBulkFile({
            orgAccount,
            payDate: run.pay_date,
            reference: `PAYROLL ${run.period_month.slice(0, 7)}`,
            payees: payslips.map((ps) => ({
                employeeNo: ps.employee?.employee_no ?? "",
                fullName: ps.employee?.profile?.full_name ?? "",
                icNo: ps.employee?.profile?.ic_number ?? null,
                bankName: ps.employee?.bank_name ?? null,
                bankAccount: ps.employee?.bank_account ?? null,
                bankCode: toBankCode(ps.employee?.bank_name ?? null),
                netPay: Number(ps.net_pay),
                email: ps.employee?.profile?.email ?? null,
            })),
        });
        const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `bentop-payroll-${run.period_month.slice(0, 7)}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        if (skipped.length > 0) {
            Alert.alert(
                "Bank file downloaded with skipped rows",
                `${totalCount} paid (RM ${(totalAmountSen / 100).toFixed(2)}). Skipped ${skipped.length}: ${skipped
                    .map((s) => `${s.employeeNo}(${s.reason})`)
                    .join(", ")}`,
            );
        } else {
            Alert.alert(
                "Bank file downloaded",
                `${totalCount} payees · RM ${(totalAmountSen / 100).toFixed(2)}`,
            );
        }
    };

    if (loading || !run) {
        return (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                <ActivityIndicator />
            </View>
        );
    }

    const totals = payslips.reduce<Totals>(
        (acc, ps) => ({
            gross: acc.gross + Number(ps.gross_total),
            epf: acc.epf + Number(ps.epf_employee),
            socso: acc.socso + Number(ps.socso_employee),
            eis: acc.eis + Number(ps.eis_employee),
            pcb: acc.pcb + Number(ps.pcb),
            net: acc.net + Number(ps.net_pay),
        }),
        zero,
    );

    return (
        <View style={{ flex: 1, padding: 24, gap: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <Button title="← Back" onPress={() => router.back()} />
                <Text style={{ fontSize: 24, fontWeight: "600" }}>
                    {formatPeriod(run.period_month)}
                </Text>
                <StatusPill status={run.status} />
            </View>
            <Text style={{ color: "#666" }}>
                Pay date {run.pay_date} · cutoff {run.cutoff_date}
                {run.approved_at ? ` · approved ${run.approved_at.slice(0, 10)}` : ""}
            </Text>

            <View
                style={{
                    flexDirection: "row",
                    gap: 16,
                    padding: 16,
                    backgroundColor: "#f4f4f5",
                    borderRadius: 8,
                }}
            >
                <Totals label="Gross" value={totals.gross} />
                <Totals label="EPF" value={totals.epf} />
                <Totals label="SOCSO" value={totals.socso} />
                <Totals label="EIS" value={totals.eis} />
                <Totals label="PCB" value={totals.pcb} />
                <Totals label="Net" value={totals.net} highlight />
            </View>

            {run.status === "previewed" ? (
                <Button
                    title={approving ? "Approving…" : "Approve payroll run"}
                    onPress={approve}
                    disabled={approving}
                />
            ) : null}

            {run.status === "approved" || run.status === "paid" || run.status === "closed" ? (
                <Button title="Download Maybank bulk file" onPress={downloadBankFile} />
            ) : null}

            <Text style={{ fontSize: 16, fontWeight: "600", marginTop: 8 }}>
                Payslips ({payslips.length})
            </Text>
            <FlatList
                data={payslips}
                keyExtractor={(ps) => ps.id}
                ItemSeparatorComponent={() => (
                    <View style={{ height: 1, backgroundColor: "#eee" }} />
                )}
                renderItem={({ item }) => <PayslipLine row={item} />}
                ListHeaderComponent={
                    <View
                        style={{
                            flexDirection: "row",
                            paddingVertical: 8,
                            borderBottomWidth: 2,
                            borderColor: "#ddd",
                        }}
                    >
                        <Text style={{ flex: 2, fontWeight: "600" }}>Employee</Text>
                        <Text style={{ flex: 1, textAlign: "right", fontWeight: "600" }}>
                            Gross
                        </Text>
                        <Text style={{ flex: 1, textAlign: "right", fontWeight: "600" }}>
                            EPF
                        </Text>
                        <Text style={{ flex: 1, textAlign: "right", fontWeight: "600" }}>
                            PCB
                        </Text>
                        <Text style={{ flex: 1, textAlign: "right", fontWeight: "600" }}>
                            Net
                        </Text>
                    </View>
                }
            />
        </View>
    );
}

const PayslipLine = ({ row }: { row: PayslipRow }) => {
    const name = row.employee?.profile?.full_name ?? "Unknown";
    const empNo = row.employee?.employee_no ?? "";
    return (
        <View style={{ flexDirection: "row", paddingVertical: 10 }}>
            <View style={{ flex: 2 }}>
                <Text>{name}</Text>
                <Text style={{ color: "#888", fontSize: 12 }}>{empNo}</Text>
            </View>
            <Text style={{ flex: 1, textAlign: "right" }}>
                {rm(Number(row.gross_total))}
            </Text>
            <Text style={{ flex: 1, textAlign: "right" }}>
                {rm(Number(row.epf_employee))}
            </Text>
            <Text style={{ flex: 1, textAlign: "right" }}>{rm(Number(row.pcb))}</Text>
            <Text style={{ flex: 1, textAlign: "right", fontWeight: "600" }}>
                {rm(Number(row.net_pay))}
            </Text>
        </View>
    );
};

const Totals = ({
    label,
    value,
    highlight,
}: {
    label: string;
    value: number;
    highlight?: boolean;
}) => (
    <View style={{ flex: 1 }}>
        <Text style={{ color: "#666", fontSize: 12 }}>{label}</Text>
        <Text
            style={{
                fontSize: highlight ? 20 : 16,
                fontWeight: highlight ? "700" : "500",
                color: highlight ? "#059669" : "#111",
            }}
        >
            {rm(value)}
        </Text>
    </View>
);

const StatusPill = ({ status }: { status: string }) => {
    const color =
        status === "approved" || status === "paid" || status === "closed"
            ? "#059669"
            : status === "previewed"
              ? "#2563eb"
              : "#6b7280";
    return (
        <Text
            style={{
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 999,
                backgroundColor: color,
                color: "#fff",
                fontSize: 12,
                overflow: "hidden",
            }}
        >
            {status}
        </Text>
    );
};

const rm = (v: number) =>
    `RM ${v.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatPeriod = (isoDate: string) => {
    const [y, m] = isoDate.split("-").map(Number);
    const names = [
        "January","February","March","April","May","June",
        "July","August","September","October","November","December",
    ];
    if (!y || !m) return isoDate;
    return `${names[m - 1]} ${y}`;
};
