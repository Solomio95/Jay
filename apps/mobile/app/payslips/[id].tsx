import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Button,
    Linking,
    ScrollView,
    Text,
    View,
} from "react-native";
import { supabase } from "../../src/supabase";

interface PayslipDetail {
    id: string;
    gross_basic: number;
    gross_allowances: number;
    gross_commission: number;
    gross_ot: number;
    gross_kpi_bonus: number;
    gross_total: number;
    epf_employee: number;
    socso_employee: number;
    eis_employee: number;
    pcb: number;
    net_pay: number;
    pdf_url: string | null;
    payroll_run: { period_month: string; pay_date: string } | null;
}

export default function PayslipDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const [row, setRow] = useState<PayslipDetail | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!id) return;
        let active = true;
        (async () => {
            const { data, error } = await supabase
                .from("payslips")
                .select(`
                    id,
                    gross_basic, gross_allowances, gross_commission, gross_ot,
                    gross_kpi_bonus, gross_total,
                    epf_employee, socso_employee, eis_employee, pcb,
                    net_pay, pdf_url,
                    payroll_run:payroll_runs(period_month, pay_date)
                `)
                .eq("id", id)
                .single();
            if (!active) return;
            if (error) {
                Alert.alert("Could not load payslip", error.message);
                setLoading(false);
                return;
            }
            setRow(data as unknown as PayslipDetail);
            setLoading(false);
        })();
        return () => {
            active = false;
        };
    }, [id]);

    if (loading || !row) {
        return (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                <ActivityIndicator />
            </View>
        );
    }

    const period = row.payroll_run?.period_month ?? "";
    const payDate = row.payroll_run?.pay_date ?? "";

    return (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
            <Text style={{ fontSize: 24, fontWeight: "600" }}>
                {formatPeriod(period)}
            </Text>
            <Text style={{ color: "#666" }}>Pay date {payDate}</Text>

            <Section title="Earnings">
                <Row label="Basic" value={row.gross_basic} />
                <Row label="Allowances" value={row.gross_allowances} />
                <Row label="Commission" value={row.gross_commission} />
                <Row label="OT" value={row.gross_ot} />
                <Row label="KPI bonus" value={row.gross_kpi_bonus} />
                <Row label="Gross total" value={row.gross_total} bold />
            </Section>

            <Section title="Deductions">
                <Row label="EPF" value={row.epf_employee} />
                <Row label="SOCSO" value={row.socso_employee} />
                <Row label="EIS" value={row.eis_employee} />
                <Row label="PCB" value={row.pcb} />
            </Section>

            <View
                style={{
                    padding: 16,
                    backgroundColor: "#ecfdf5",
                    borderRadius: 8,
                    flexDirection: "row",
                    justifyContent: "space-between",
                }}
            >
                <Text style={{ fontSize: 16, fontWeight: "600" }}>Net pay</Text>
                <Text style={{ fontSize: 20, fontWeight: "700", color: "#059669" }}>
                    {rm(row.net_pay)}
                </Text>
            </View>

            {row.pdf_url ? (
                <Button
                    title="Open payslip PDF"
                    onPress={() => Linking.openURL(row.pdf_url!)}
                />
            ) : (
                <Text style={{ color: "#666" }}>
                    PDF will be available once this run is approved.
                </Text>
            )}
        </ScrollView>
    );
}

const Section = ({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}) => (
    <View
        style={{
            backgroundColor: "#f4f4f5",
            borderRadius: 8,
            padding: 12,
            gap: 6,
        }}
    >
        <Text style={{ fontSize: 12, color: "#666" }}>{title}</Text>
        {children}
    </View>
);

const Row = ({
    label,
    value,
    bold,
}: {
    label: string;
    value: number;
    bold?: boolean;
}) => (
    <View
        style={{
            flexDirection: "row",
            justifyContent: "space-between",
            paddingVertical: 2,
        }}
    >
        <Text style={{ fontWeight: bold ? "600" : "400" }}>{label}</Text>
        <Text style={{ fontWeight: bold ? "600" : "400" }}>{rm(Number(value))}</Text>
    </View>
);

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
