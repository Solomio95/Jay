import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Linking,
    Text,
    View,
} from "react-native";
import { supabase } from "../../src/supabase";

interface RateRow {
    id: string;
    kind: string;
    effective_from: string;
    effective_to: string | null;
    source_url: string | null;
    loaded_at: string;
    data: Record<string, unknown>;
}

export default function StatutoryRates() {
    const [rows, setRows] = useState<RateRow[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;
        (async () => {
            const { data } = await supabase
                .from("statutory_rate_tables")
                .select("id, kind, effective_from, effective_to, source_url, loaded_at, data")
                .order("kind")
                .order("effective_from", { ascending: false });
            if (!active) return;
            setRows((data ?? []) as RateRow[]);
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
            <Text style={{ fontSize: 28, fontWeight: "600" }}>Statutory rates</Text>
            <Text style={{ color: "#666" }}>
                Payroll runs fail unless a row covers every pay date for each of
                EPF, SOCSO, EIS, and PCB. Load a new row in November for the
                coming year.
            </Text>
            <KindMatrix rows={rows} />
            <Text style={{ fontSize: 18, fontWeight: "600", marginTop: 12 }}>
                All rows ({rows.length})
            </Text>
            <FlatList
                data={rows}
                keyExtractor={(r) => r.id}
                ItemSeparatorComponent={() => (
                    <View style={{ height: 1, backgroundColor: "#eee" }} />
                )}
                renderItem={({ item }) => <RateRowView row={item} />}
            />
        </View>
    );
}

const KINDS = ["epf", "socso", "eis", "pcb"] as const;

const KindMatrix = ({ rows }: { rows: RateRow[] }) => {
    const today = new Date().toISOString().slice(0, 10);
    return (
        <View style={{ flexDirection: "row", gap: 12 }}>
            {KINDS.map((k) => {
                const covering = rows.find(
                    (r) =>
                        r.kind === k &&
                        r.effective_from <= today &&
                        (r.effective_to == null || r.effective_to >= today),
                );
                const ok = covering !== undefined;
                return (
                    <View
                        key={k}
                        style={{
                            flex: 1,
                            padding: 12,
                            borderRadius: 8,
                            backgroundColor: ok ? "#ecfdf5" : "#fef2f2",
                        }}
                    >
                        <Text style={{ fontSize: 12, color: "#666" }}>
                            {k.toUpperCase()}
                        </Text>
                        <Text
                            style={{
                                fontSize: 14,
                                fontWeight: "600",
                                color: ok ? "#059669" : "#b91c1c",
                            }}
                        >
                            {ok ? `covered from ${covering.effective_from}` : "missing"}
                        </Text>
                    </View>
                );
            })}
        </View>
    );
};

const RateRowView = ({ row }: { row: RateRow }) => (
    <View style={{ paddingVertical: 12, gap: 4 }}>
        <Text style={{ fontWeight: "500" }}>
            {row.kind.toUpperCase()} · from {row.effective_from}
            {row.effective_to ? ` → ${row.effective_to}` : ""}
        </Text>
        <Text style={{ color: "#666", fontSize: 12 }}>
            Loaded {row.loaded_at.slice(0, 10)}
            {row.source_url ? (
                <>
                    {" · "}
                    <Text
                        onPress={() => Linking.openURL(row.source_url!)}
                        style={{ color: "#2563eb" }}
                    >
                        source
                    </Text>
                </>
            ) : null}
        </Text>
    </View>
);
