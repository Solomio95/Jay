import { useEffect, useState } from "react";
import { FlatList, Text, View } from "react-native";
import {
    useLeaderboard,
    useMyLeaderboardPosition,
    type Scope,
} from "../../src/features/leaderboard/useLeaderboard";
import { supabase } from "../../src/supabase";
import { useAuth } from "../../src/auth/AuthContext";

const SCOPES: { key: Scope; label: string }[] = [
    { key: "national", label: "National" },
    { key: "state", label: "State" },
    { key: "outlet", label: "My outlet" },
];

export default function Leaderboard() {
    const [scope, setScope] = useState<Scope>("national");
    const { entries, period, loading } = useLeaderboard(scope, null);
    const { data: me } = useMyLeaderboardPosition();
    const { profile } = useAuth();
    const [myEmployeeId, setMyEmployeeId] = useState<string | null>(null);

    useEffect(() => {
        if (!profile) return;
        let active = true;
        supabase
            .from("employees")
            .select("id")
            .eq("profile_id", profile.id)
            .maybeSingle()
            .then(({ data }) => {
                if (active && data) setMyEmployeeId(data.id as string);
            });
        return () => {
            active = false;
        };
    }, [profile]);

    return (
        <View style={{ flex: 1, padding: 16, gap: 12 }}>
            <Text style={{ fontSize: 24, fontWeight: "600" }}>Leaderboard</Text>

            {me ? (
                <View
                    style={{
                        padding: 12,
                        borderRadius: 10,
                        backgroundColor: "#eff6ff",
                        borderWidth: 1,
                        borderColor: "#bfdbfe",
                    }}
                >
                    <Text style={{ fontSize: 12, color: "#1d4ed8" }}>
                        Your national rank
                    </Text>
                    <Text style={{ fontSize: 20, fontWeight: "700", color: "#1e3a8a" }}>
                        {me.rank ? `#${me.rank} of ${me.total}` : "Unranked"}
                        {"  "}
                        <Text style={{ fontSize: 14, fontWeight: "400", color: "#1e40af" }}>
                            RM {Number(me.value).toFixed(0)}
                        </Text>
                    </Text>
                </View>
            ) : null}

            <View style={{ flexDirection: "row", gap: 8 }}>
                {SCOPES.map((s) => (
                    <Text
                        key={s.key}
                        onPress={() => setScope(s.key)}
                        style={{
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            borderRadius: 999,
                            backgroundColor: scope === s.key ? "#2563eb" : "#f4f4f5",
                            color: scope === s.key ? "#fff" : "#111",
                            overflow: "hidden",
                            fontSize: 13,
                        }}
                    >
                        {s.label}
                    </Text>
                ))}
            </View>

            {period ? (
                <Text style={{ color: "#888", fontSize: 12 }}>
                    Period {period.slice(0, 7)}
                </Text>
            ) : null}

            {loading ? (
                <Text style={{ color: "#666" }}>Loading…</Text>
            ) : entries.length === 0 ? (
                <Text style={{ color: "#666" }}>
                    No leaderboard snapshot yet for this scope.
                </Text>
            ) : (
                <FlatList
                    data={entries}
                    keyExtractor={(e) => e.employeeId}
                    renderItem={({ item, index }) => {
                        const mine = myEmployeeId && item.employeeId === myEmployeeId;
                        return (
                            <View
                                style={{
                                    flexDirection: "row",
                                    paddingVertical: 10,
                                    paddingHorizontal: 8,
                                    gap: 12,
                                    backgroundColor: mine ? "#fef3c7" : "transparent",
                                    borderRadius: 6,
                                }}
                            >
                                <Text style={{ width: 28, fontWeight: "600" }}>
                                    {index + 1}
                                </Text>
                                <Text style={{ flex: 1 }}>{item.name}</Text>
                                <Text style={{ fontWeight: "500" }}>
                                    RM {Number(item.value).toFixed(0)}
                                </Text>
                            </View>
                        );
                    }}
                    ItemSeparatorComponent={() => (
                        <View style={{ height: 1, backgroundColor: "#eee" }} />
                    )}
                />
            )}
        </View>
    );
}
