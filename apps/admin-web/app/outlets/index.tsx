import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Text,
    View,
} from "react-native";
import { supabase } from "../../src/supabase";

interface OutletRow {
    id: string;
    code: string;
    name: string;
    state: { code: string; name: string } | null;
    counters: { id: string; code: string; name: string; closed_on: string | null }[];
}

export default function OutletsList() {
    const [rows, setRows] = useState<OutletRow[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;
        (async () => {
            const { data } = await supabase
                .from("outlets")
                .select(`
                    id, code, name,
                    state:states(code, name),
                    counters(id, code, name, closed_on)
                `)
                .is("closed_on", null)
                .order("code");
            if (!active) return;
            setRows((data ?? []) as unknown as OutletRow[]);
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

    const totalCounters = rows.reduce(
        (acc, r) => acc + r.counters.filter((c) => !c.closed_on).length,
        0,
    );

    return (
        <View style={{ flex: 1, padding: 24, gap: 12 }}>
            <Text style={{ fontSize: 28, fontWeight: "600" }}>
                Outlets & counters
            </Text>
            <Text style={{ color: "#666" }}>
                {rows.length} outlets · {totalCounters} active counters
            </Text>
            <FlatList
                data={rows}
                keyExtractor={(r) => r.id}
                ItemSeparatorComponent={() => (
                    <View style={{ height: 1, backgroundColor: "#eee" }} />
                )}
                renderItem={({ item }) => <OutletCard row={item} />}
            />
        </View>
    );
}

const OutletCard = ({ row }: { row: OutletRow }) => {
    const active = row.counters.filter((c) => !c.closed_on);
    return (
        <View style={{ paddingVertical: 12, gap: 6 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ fontSize: 16, fontWeight: "500" }}>{row.name}</Text>
                <Text style={{ color: "#666", fontSize: 12 }}>{row.code}</Text>
                {row.state ? (
                    <Text
                        style={{
                            paddingHorizontal: 8,
                            paddingVertical: 2,
                            borderRadius: 999,
                            backgroundColor: "#f4f4f5",
                            fontSize: 12,
                            color: "#444",
                            overflow: "hidden",
                        }}
                    >
                        {row.state.code}
                    </Text>
                ) : null}
            </View>
            {active.length === 0 ? (
                <Text style={{ color: "#666", fontSize: 12 }}>No active counters.</Text>
            ) : (
                <View style={{ gap: 2 }}>
                    {active.map((c) => (
                        <Text key={c.id} style={{ fontSize: 12, color: "#444" }}>
                            · {c.code} — {c.name}
                        </Text>
                    ))}
                </View>
            )}
        </View>
    );
};
