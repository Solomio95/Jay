import { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
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

export default function AuditLog() {
    const [rows, setRows] = useState<AuditRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState("");

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
