import { useEffect, useMemo, useState } from "react";
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

interface AuditRow {
    id: number;
    entity_type: string;
    entity_id: string | null;
    action: string;
    at: string;
    before: Record<string, unknown> | null;
    after: Record<string, unknown> | null;
    actor: { full_name: string } | null;
}

const firstOfMonth = (d: Date): string =>
    new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);

export default function AuditLog() {
    const [rows, setRows] = useState<AuditRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState("");
    const now = new Date();
    const [fromDate, setFromDate] = useState(firstOfMonth(now));
    const [toDate, setToDate] = useState(
        firstOfMonth(new Date(now.getFullYear(), now.getMonth() + 1, 1)),
    );
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        let active = true;
        (async () => {
            const { data } = await supabase
                .from("audit_log")
                .select(`
                    id, entity_type, entity_id, action, at, before, after,
                    actor:profiles(full_name)
                `)
                .order("at", { ascending: false })
                .limit(200);
            if (!active) return;
            setRows((data ?? []) as unknown as AuditRow[]);
            setLoading(false);
        })();
        return () => {
            active = false;
        };
    }, []);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return rows;
        return rows.filter((r) => {
            return (
                r.entity_type.toLowerCase().includes(q) ||
                r.action.toLowerCase().includes(q) ||
                (r.actor?.full_name ?? "").toLowerCase().includes(q)
            );
        });
    }, [rows, query]);

    const exportJsonl = async () => {
        setBusy(true);
        const { data, error } = await supabase.rpc("audit_log_range", {
            p_from: `${fromDate}T00:00:00Z`,
            p_to: `${toDate}T00:00:00Z`,
        });
        setBusy(false);
        if (error) {
            Alert.alert("Export failed", error.message);
            return;
        }
        const jsonl = ((data as unknown[]) ?? [])
            .map((r) => JSON.stringify(r))
            .join("\n") + "\n";
        const blob = new Blob([jsonl], { type: "application/jsonl;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `audit-${fromDate}_to_${toDate}.jsonl`;
        a.click();
        URL.revokeObjectURL(url);
        Alert.alert("Exported", `${(data as unknown[]).length} rows downloaded.`);
    };

    if (loading) {
        return (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                <ActivityIndicator />
            </View>
        );
    }

    return (
        <View style={{ flex: 1, padding: 24, gap: 12 }}>
            <Text style={{ fontSize: 28, fontWeight: "600" }}>Audit log</Text>
            <Text style={{ color: "#666" }}>
                Append-only trail. Showing the latest {rows.length} entries.
            </Text>

            <View
                style={{
                    flexDirection: "row",
                    gap: 8,
                    alignItems: "flex-end",
                    padding: 12,
                    borderRadius: 8,
                    backgroundColor: "#f4f4f5",
                }}
            >
                <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, color: "#666" }}>Export from</Text>
                    <TextInput
                        value={fromDate}
                        onChangeText={setFromDate}
                        style={input}
                        placeholder="YYYY-MM-DD"
                    />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, color: "#666" }}>to (exclusive)</Text>
                    <TextInput
                        value={toDate}
                        onChangeText={setToDate}
                        style={input}
                        placeholder="YYYY-MM-DD"
                    />
                </View>
                <Button title={busy ? "…" : "Download JSONL"} onPress={exportJsonl} disabled={busy} />
            </View>

            <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Filter by entity type, action, or actor"
                style={{ borderWidth: 1, padding: 10, borderRadius: 8 }}
            />
            <FlatList
                data={filtered}
                keyExtractor={(r) => String(r.id)}
                ItemSeparatorComponent={() => (
                    <View style={{ height: 1, backgroundColor: "#eee" }} />
                )}
                renderItem={({ item }) => <EntryRow row={item} />}
            />
        </View>
    );
}

const EntryRow = ({ row }: { row: AuditRow }) => (
    <View style={{ paddingVertical: 10, gap: 2 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ fontWeight: "500" }}>
                {row.entity_type} · {row.action}
            </Text>
            <Text style={{ color: "#666", fontSize: 12 }}>
                {row.at.slice(0, 19).replace("T", " ")}
            </Text>
        </View>
        <Text style={{ color: "#666", fontSize: 12 }}>
            {row.actor?.full_name ?? "system"}
            {row.entity_id ? ` · ${row.entity_id.slice(0, 8)}` : ""}
        </Text>
    </View>
);

const input = {
    borderWidth: 1,
    borderColor: "#d4d4d8",
    padding: 8,
    borderRadius: 6,
} as const;
