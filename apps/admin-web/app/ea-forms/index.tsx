import { useCallback, useEffect, useState } from "react";
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

interface EaFormRow {
    id: string;
    employee_id: string;
    year: number;
    pdf_url: string | null;
    generated_at: string;
    employee: {
        employee_no: string;
        profile: { full_name: string } | null;
    } | null;
}

const currentYear = new Date().getFullYear();

export default function EaForms() {
    const [year, setYear] = useState(String(currentYear - 1));
    const [rows, setRows] = useState<EaFormRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [running, setRunning] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        const y = Number(year);
        if (!Number.isInteger(y)) {
            setRows([]);
            setLoading(false);
            return;
        }
        const { data, error } = await supabase
            .from("ea_forms")
            .select(`
                id, employee_id, year, pdf_url, generated_at,
                employee:employees!inner(
                    employee_no,
                    profile:profiles(full_name)
                )
            `)
            .eq("year", y)
            .order("generated_at", { ascending: false });
        setLoading(false);
        if (error) {
            Alert.alert("Could not load EA forms", error.message);
            return;
        }
        setRows((data ?? []) as unknown as EaFormRow[]);
    }, [year]);

    useEffect(() => {
        void load();
    }, [load]);

    const run = async () => {
        const y = Number(year);
        if (!Number.isInteger(y)) {
            Alert.alert("Enter a valid year (e.g. 2025).");
            return;
        }
        setRunning(true);
        const { data, error } = await supabase.functions.invoke("ea-form-run", {
            body: { year: y },
        });
        setRunning(false);
        if (error) {
            Alert.alert("Generation failed", error.message);
            return;
        }
        const summary = data as { generated?: number; failed?: number; message?: string };
        Alert.alert(
            "EA forms generated",
            `Generated ${summary.generated ?? 0} · failed ${summary.failed ?? 0}` +
                (summary.message ? ` · ${summary.message}` : ""),
        );
        await load();
    };

    return (
        <View style={{ flex: 1, padding: 24, gap: 16 }}>
            <Text style={{ fontSize: 24, fontWeight: "600" }}>Form EA</Text>
            <Text style={{ color: "#666" }}>
                Generate annual Form EA PDFs for every employee with payslips in the chosen year.
                Distribute to employees by end of February.
            </Text>

            <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                <Text>Year</Text>
                <TextInput
                    value={year}
                    onChangeText={setYear}
                    keyboardType="numeric"
                    style={{
                        borderWidth: 1,
                        padding: 8,
                        borderRadius: 6,
                        width: 100,
                    }}
                />
                <Button
                    title={running ? "Generating…" : "Generate / regenerate"}
                    onPress={run}
                    disabled={running}
                />
            </View>

            {loading ? (
                <ActivityIndicator />
            ) : rows.length === 0 ? (
                <Text style={{ color: "#666" }}>No EA forms generated for {year} yet.</Text>
            ) : (
                <FlatList
                    data={rows}
                    keyExtractor={(r) => r.id}
                    ItemSeparatorComponent={() => (
                        <View style={{ height: 1, backgroundColor: "#eee" }} />
                    )}
                    renderItem={({ item }) => (
                        <View style={{ flexDirection: "row", paddingVertical: 10 }}>
                            <View style={{ flex: 2 }}>
                                <Text>{item.employee?.profile?.full_name ?? "Unknown"}</Text>
                                <Text style={{ color: "#888", fontSize: 12 }}>
                                    {item.employee?.employee_no}
                                </Text>
                            </View>
                            <Text style={{ flex: 1, color: "#666" }}>
                                {item.generated_at.slice(0, 10)}
                            </Text>
                            <View style={{ flex: 1 }}>
                                {item.pdf_url ? (
                                    <Text
                                        onPress={() => {
                                            if (typeof window !== "undefined" && item.pdf_url) {
                                                window.open(item.pdf_url, "_blank");
                                            }
                                        }}
                                        style={{ color: "#2563eb" }}
                                    >
                                        Open PDF
                                    </Text>
                                ) : (
                                    <Text style={{ color: "#888" }}>—</Text>
                                )}
                            </View>
                        </View>
                    )}
                />
            )}
        </View>
    );
}
