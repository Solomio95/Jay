import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Button,
    FlatList,
    Text,
    View,
} from "react-native";
import { supabase } from "../../src/supabase";

interface SnapshotRow {
    id: string;
    scope: string;
    scope_id: string | null;
    metric: string;
    period_month: string;
    generated_at: string;
    entries: { employeeId: string; name: string; value: number }[];
    scope_label?: string;
}

export default function Leaderboards() {
    const [rows, setRows] = useState<SnapshotRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        const [{ data: snaps }, { data: states }, { data: outlets }] = await Promise.all([
            supabase
                .from("leaderboard_snapshots")
                .select("id, scope, scope_id, metric, period_month, generated_at, entries")
                .order("generated_at", { ascending: false })
                .limit(200),
            supabase.from("states").select("id, name"),
            supabase.from("outlets").select("id, name"),
        ]);
        const stateNames = new Map((states ?? []).map((s) => [s.id as string, s.name as string]));
        const outletNames = new Map((outlets ?? []).map((o) => [o.id as string, o.name as string]));
        const labelled = ((snaps ?? []) as SnapshotRow[]).map((r) => ({
            ...r,
            scope_label:
                r.scope === "national"
                    ? "National"
                    : r.scope === "outlet"
                      ? `Outlet · ${outletNames.get(r.scope_id ?? "") ?? "?"}`
                      : `${r.scope[0]?.toUpperCase() ?? ""}${r.scope.slice(1)} · ${stateNames.get(r.scope_id ?? "") ?? "?"}`,
        }));
        setRows(labelled);
        setLoading(false);
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const refresh = async () => {
        setRefreshing(true);
        const { data, error } = await supabase.functions.invoke("leaderboard-refresh", {
            body: {},
        });
        setRefreshing(false);
        if (error) {
            Alert.alert("Refresh failed", error.message);
            return;
        }
        const summary = data as { scopes?: number };
        Alert.alert("Leaderboards refreshed", `${summary.scopes ?? 0} snapshot(s) rebuilt`);
        await load();
    };

    return (
        <View style={{ flex: 1, padding: 24, gap: 16 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 24, fontWeight: "600" }}>Leaderboards</Text>
                <Button
                    title={refreshing ? "Refreshing…" : "Refresh all"}
                    onPress={refresh}
                    disabled={refreshing}
                />
            </View>
            <Text style={{ color: "#666" }}>
                Snapshots update hourly via cron. Refresh manually after a large ERP sync.
            </Text>

            {loading ? (
                <ActivityIndicator />
            ) : (
                <FlatList
                    data={rows}
                    keyExtractor={(r) => r.id}
                    ItemSeparatorComponent={() => (
                        <View style={{ height: 1, backgroundColor: "#eee" }} />
                    )}
                    renderItem={({ item }) => (
                        <View style={{ paddingVertical: 10 }}>
                            <View
                                style={{
                                    flexDirection: "row",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                }}
                            >
                                <Text style={{ fontWeight: "600" }}>{item.scope_label}</Text>
                                <Text style={{ color: "#888", fontSize: 12 }}>
                                    {item.period_month.slice(0, 7)} · {item.entries.length} entries
                                </Text>
                            </View>
                            {item.entries.slice(0, 5).map((e, i) => (
                                <View
                                    key={e.employeeId}
                                    style={{
                                        flexDirection: "row",
                                        paddingVertical: 2,
                                        gap: 8,
                                    }}
                                >
                                    <Text style={{ width: 24, color: "#555" }}>{i + 1}</Text>
                                    <Text style={{ flex: 1 }}>{e.name}</Text>
                                    <Text>RM {Number(e.value).toFixed(0)}</Text>
                                </View>
                            ))}
                        </View>
                    )}
                />
            )}
        </View>
    );
}
