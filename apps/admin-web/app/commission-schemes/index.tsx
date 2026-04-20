import { Link } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Text, View } from "react-native";
import { supabase } from "../../src/supabase";

interface SchemeRow {
    id: string;
    name: string;
    status: string;
    effective_from: string;
    effective_to: string | null;
}

export default function CommissionSchemes() {
    const [rows, setRows] = useState<SchemeRow[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;
        (async () => {
            const { data } = await supabase
                .from("commission_schemes")
                .select("id, name, status, effective_from, effective_to")
                .order("effective_from", { ascending: false });
            if (!active) return;
            setRows((data ?? []) as SchemeRow[]);
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
            <Text style={{ fontSize: 28, fontWeight: "600" }}>Commission schemes</Text>
            {rows.length === 0 ? (
                <Text style={{ color: "#666" }}>No schemes yet.</Text>
            ) : (
                <FlatList
                    data={rows}
                    keyExtractor={(r) => r.id}
                    ItemSeparatorComponent={() => (
                        <View style={{ height: 1, backgroundColor: "#eee" }} />
                    )}
                    renderItem={({ item }) => (
                        <Link
                            href={`/commission-schemes/${item.id}`}
                            style={{ paddingVertical: 14, textDecorationLine: "none" }}
                        >
                            <View>
                                <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                                    <Text style={{ fontSize: 16, fontWeight: "500" }}>
                                        {item.name}
                                    </Text>
                                    <StatusPill status={item.status} />
                                </View>
                                <Text style={{ color: "#666", marginTop: 2 }}>
                                    Effective {item.effective_from}
                                    {item.effective_to ? ` → ${item.effective_to}` : " (no end)"}
                                </Text>
                            </View>
                        </Link>
                    )}
                />
            )}
        </View>
    );
}

const StatusPill = ({ status }: { status: string }) => {
    const color =
        status === "active"
            ? "#059669"
            : status === "draft"
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
