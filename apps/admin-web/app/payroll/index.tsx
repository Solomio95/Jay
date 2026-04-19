import { Link } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Text, View } from "react-native";
import { supabase } from "../../src/supabase";

interface PayrollRunRow {
    id: string;
    period_month: string;
    status: string;
    pay_date: string;
    cutoff_date: string;
}

export default function PayrollHome() {
    const [runs, setRuns] = useState<PayrollRunRow[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;
        (async () => {
            const { data } = await supabase
                .from("payroll_runs")
                .select("id, period_month, status, pay_date, cutoff_date")
                .order("period_month", { ascending: false })
                .limit(24);
            if (!active) return;
            setRuns((data ?? []) as PayrollRunRow[]);
            setLoading(false);
        })();
        return () => {
            active = false;
        };
    }, []);

    if (loading) {
        return (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                <ActivityIndicator />
            </View>
        );
    }

    return (
        <View style={{ flex: 1, padding: 24, gap: 12 }}>
            <Text style={{ fontSize: 28, fontWeight: "600" }}>Payroll runs</Text>
            {runs.length === 0 ? (
                <Text style={{ color: "#666" }}>
                    No runs yet. Trigger one from the payroll-run Edge Function.
                </Text>
            ) : (
                <FlatList
                    data={runs}
                    keyExtractor={(r) => r.id}
                    renderItem={({ item }) => <RunRow run={item} />}
                    ItemSeparatorComponent={() => (
                        <View style={{ height: 1, backgroundColor: "#eee" }} />
                    )}
                />
            )}
        </View>
    );
}

const RunRow = ({ run }: { run: PayrollRunRow }) => (
    <Link
        href={`/payroll/${run.id}`}
        style={{ paddingVertical: 14, textDecorationLine: "none" }}
    >
        <View>
            <Text style={{ fontSize: 16, fontWeight: "500" }}>
                {formatPeriod(run.period_month)}
            </Text>
            <Text style={{ color: "#666", marginTop: 2 }}>
                {run.status} · pay date {run.pay_date} · cutoff {run.cutoff_date}
            </Text>
        </View>
    </Link>
);

const formatPeriod = (isoDate: string) => {
    const [y, m] = isoDate.split("-").map(Number);
    const names = [
        "January","February","March","April","May","June",
        "July","August","September","October","November","December",
    ];
    if (!y || !m) return isoDate;
    return `${names[m - 1]} ${y}`;
};
