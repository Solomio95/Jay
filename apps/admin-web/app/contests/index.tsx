import { Link } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Text,
    View,
} from "react-native";
import { supabase } from "../../src/supabase";

interface Contest {
    id: string;
    name: string;
    metric: string;
    scope: string;
    period_start: string;
    period_end: string;
    status: string;
    prize: unknown;
}

export default function Contests() {
    const [rows, setRows] = useState<Contest[]>([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        const { data } = await supabase
            .from("contests")
            .select("id, name, metric, scope, period_start, period_end, status, prize")
            .order("period_start", { ascending: false });
        setRows((data ?? []) as Contest[]);
        setLoading(false);
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    if (loading) {
        return (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                <ActivityIndicator />
            </View>
        );
    }

    return (
        <View style={{ flex: 1, padding: 24, gap: 16 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 24, fontWeight: "600" }}>Contests</Text>
                <Link
                    href="/contests/new"
                    style={{
                        color: "#2563eb",
                        paddingVertical: 6,
                        paddingHorizontal: 12,
                        backgroundColor: "#eff6ff",
                        borderRadius: 6,
                    }}
                >
                    + New contest
                </Link>
            </View>

            {rows.length === 0 ? (
                <Text style={{ color: "#666" }}>
                    No contests yet. Create one to motivate staff around a short-term goal.
                </Text>
            ) : (
                <FlatList
                    data={rows}
                    keyExtractor={(r) => r.id}
                    ItemSeparatorComponent={() => (
                        <View style={{ height: 1, backgroundColor: "#eee" }} />
                    )}
                    renderItem={({ item }) => (
                        <Link href={`/contests/${item.id}`} asChild>
                            <View style={{ paddingVertical: 12 }}>
                                <Text style={{ fontWeight: "500", fontSize: 16 }}>
                                    {item.name}
                                </Text>
                                <Text style={{ color: "#666", fontSize: 13 }}>
                                    {item.period_start} → {item.period_end} · {item.metric} ·{" "}
                                    {item.scope}
                                </Text>
                                <Text
                                    style={{
                                        fontSize: 12,
                                        color:
                                            item.status === "active"
                                                ? "#059669"
                                                : item.status === "finished"
                                                  ? "#6b7280"
                                                  : "#2563eb",
                                    }}
                                >
                                    {item.status}
                                </Text>
                            </View>
                        </Link>
                    )}
                />
            )}
        </View>
    );
}
