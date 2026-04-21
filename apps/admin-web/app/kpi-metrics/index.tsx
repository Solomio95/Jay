import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Button,
    FlatList,
    Text,
    TextInput,
    View,
} from "react-native";
import { supabase } from "../../src/supabase";

interface MetricRow {
    employee_id: string;
    employee_no: string;
    full_name: string;
    metric: string;
    value: number;
    source: string;
    recorded_at: string;
}

interface EmployeeOption {
    id: string;
    employee_no: string;
    full_name: string;
}

const METRICS = [
    "attendance_rate",
    "return_rate",
    "review_score",
    "new_members",
    "custom",
] as const;

const periodFromInput = (ym: string): string => {
    // "YYYY-MM" → "YYYY-MM-01"
    return /^\d{4}-\d{2}$/.test(ym) ? `${ym}-01` : ym;
};

export default function KpiMetrics() {
    const now = new Date();
    const defaultPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const [period, setPeriod] = useState(defaultPeriod);
    const [rows, setRows] = useState<MetricRow[]>([]);
    const [employees, setEmployees] = useState<EmployeeOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);

    const [empId, setEmpId] = useState("");
    const [metric, setMetric] = useState<(typeof METRICS)[number]>("attendance_rate");
    const [value, setValue] = useState("");

    const load = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase.rpc("list_kpi_metrics", {
            p_period_month: periodFromInput(period),
        });
        if (error) {
            Alert.alert("Could not load", error.message);
            setLoading(false);
            return;
        }
        setRows((data ?? []) as MetricRow[]);
        setLoading(false);
    }, [period]);

    useEffect(() => {
        void load();
    }, [load]);

    useEffect(() => {
        let active = true;
        (async () => {
            const { data } = await supabase
                .from("employees")
                .select("id, employee_no, profile:profiles!inner(full_name, status)")
                .order("employee_no");
            if (!active) return;
            const opts: EmployeeOption[] = (data ?? [])
                .filter((r: any) => r.profile?.status === "active")
                .map((r: any) => ({
                    id: r.id,
                    employee_no: r.employee_no,
                    full_name: r.profile.full_name,
                }));
            setEmployees(opts);
        })();
        return () => {
            active = false;
        };
    }, []);

    const submit = async () => {
        const v = Number(value);
        if (!empId || !value || Number.isNaN(v)) {
            Alert.alert("Missing fields", "Employee and numeric value required.");
            return;
        }
        setBusy(true);
        const { error } = await supabase.rpc("upsert_kpi_metric", {
            p_employee_id: empId,
            p_period_month: periodFromInput(period),
            p_metric: metric,
            p_value: v,
            p_source: "manual",
        });
        setBusy(false);
        if (error) {
            Alert.alert("Could not save", error.message);
            return;
        }
        setValue("");
        await load();
    };

    const runAutoAttendance = async () => {
        setBusy(true);
        const { data, error } = await supabase.rpc("auto_kpi_attendance", {
            p_period_month: periodFromInput(period),
        });
        setBusy(false);
        if (error) {
            Alert.alert("Auto-run failed", error.message);
            return;
        }
        Alert.alert("Done", `Updated ${data ?? 0} attendance_rate rows.`);
        await load();
    };

    const empLabel = useMemo(() => {
        const e = employees.find((x) => x.id === empId);
        return e ? `${e.employee_no} · ${e.full_name}` : "pick employee";
    }, [empId, employees]);

    return (
        <View style={{ flex: 1, padding: 24, gap: 12 }}>
            <Text style={{ fontSize: 24, fontWeight: "600" }}>KPI metrics</Text>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <Text>Period (YYYY-MM)</Text>
                <TextInput
                    value={period}
                    onChangeText={setPeriod}
                    style={{
                        borderWidth: 1,
                        borderColor: "#d4d4d8",
                        padding: 8,
                        borderRadius: 6,
                        width: 120,
                    }}
                />
                <Button
                    title="Auto-run attendance"
                    onPress={runAutoAttendance}
                    disabled={busy}
                />
            </View>

            <View
                style={{
                    borderWidth: 1,
                    borderColor: "#e4e4e7",
                    borderRadius: 8,
                    padding: 12,
                    gap: 8,
                }}
            >
                <Text style={{ fontWeight: "600" }}>Upsert one metric</Text>
                <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                    {employees.slice(0, 40).map((e) => (
                        <Text
                            key={e.id}
                            onPress={() => setEmpId(e.id)}
                            style={{
                                paddingHorizontal: 10,
                                paddingVertical: 4,
                                borderRadius: 999,
                                backgroundColor: e.id === empId ? "#2563eb" : "#f4f4f5",
                                color: e.id === empId ? "#fff" : "#111",
                                fontSize: 12,
                                overflow: "hidden",
                            }}
                        >
                            {e.employee_no}
                        </Text>
                    ))}
                </View>
                <Text style={{ fontSize: 12, color: "#666" }}>{empLabel}</Text>
                <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                    {METRICS.map((m) => (
                        <Text
                            key={m}
                            onPress={() => setMetric(m)}
                            style={{
                                paddingHorizontal: 10,
                                paddingVertical: 4,
                                borderRadius: 999,
                                backgroundColor: m === metric ? "#2563eb" : "#f4f4f5",
                                color: m === metric ? "#fff" : "#111",
                                fontSize: 12,
                                overflow: "hidden",
                            }}
                        >
                            {m}
                        </Text>
                    ))}
                </View>
                <View style={{ flexDirection: "row", gap: 8 }}>
                    <TextInput
                        value={value}
                        onChangeText={setValue}
                        placeholder="0.95"
                        keyboardType="decimal-pad"
                        style={{
                            borderWidth: 1,
                            borderColor: "#d4d4d8",
                            padding: 8,
                            borderRadius: 6,
                            flex: 1,
                        }}
                    />
                    <Button title={busy ? "Saving…" : "Save"} onPress={submit} disabled={busy} />
                </View>
            </View>

            <Text style={{ fontWeight: "600", marginTop: 8 }}>
                Stored metrics for {period}
            </Text>
            {loading ? (
                <ActivityIndicator />
            ) : rows.length === 0 ? (
                <Text style={{ color: "#666" }}>No metrics yet for this period.</Text>
            ) : (
                <FlatList
                    data={rows}
                    keyExtractor={(r) => `${r.employee_id}-${r.metric}`}
                    ItemSeparatorComponent={() => (
                        <View style={{ height: 1, backgroundColor: "#eee" }} />
                    )}
                    renderItem={({ item }) => (
                        <View style={{ paddingVertical: 8, flexDirection: "row", gap: 8 }}>
                            <Text style={{ width: 90 }}>{item.employee_no}</Text>
                            <Text style={{ flex: 1 }}>{item.full_name}</Text>
                            <Text style={{ width: 120 }}>{item.metric}</Text>
                            <Text style={{ width: 80, textAlign: "right" }}>
                                {Number(item.value).toFixed(4)}
                            </Text>
                            <Text style={{ width: 70, color: "#666", fontSize: 12 }}>
                                {item.source}
                            </Text>
                        </View>
                    )}
                />
            )}
        </View>
    );
}
