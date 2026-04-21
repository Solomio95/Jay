import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Button,
    Text,
    View,
} from "react-native";
import { supabase } from "../../src/supabase";

interface Contest {
    id: string;
    name: string;
    description: string | null;
    metric: string;
    scope: string;
    scope_id: string | null;
    period_start: string;
    period_end: string;
    status: string;
    prize: { amount_rm?: number } | null;
}

interface Standings {
    contest: Contest;
    entries: { employeeId: string; name: string; value: number; rank: number }[];
    total: number;
    me: { rank: number | null; value: number };
}

export default function ContestDetail() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const [s, setS] = useState<Standings | null>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        if (!id) return;
        const { data, error } = await supabase.rpc("contest_standings", {
            p_contest_id: id,
            p_top: 20,
        });
        if (error) {
            Alert.alert("Could not load", error.message);
            return;
        }
        setS(data as Standings);
        setLoading(false);
    }, [id]);

    useEffect(() => {
        void load();
    }, [load]);

    const setStatus = async (status: "active" | "finished" | "cancelled") => {
        if (!id) return;
        setBusy(true);
        const { error } = await supabase.from("contests").update({ status }).eq("id", id);
        setBusy(false);
        if (error) {
            Alert.alert("Could not update", error.message);
            return;
        }
        await load();
    };

    if (loading || !s) {
        return (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                <ActivityIndicator />
            </View>
        );
    }

    const c = s.contest;

    return (
        <View style={{ flex: 1, padding: 24, gap: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <Button title="← Back" onPress={() => router.back()} />
                <Text style={{ fontSize: 24, fontWeight: "600" }}>{c.name}</Text>
            </View>
            <Text style={{ color: "#666" }}>
                {c.period_start} → {c.period_end} · {c.metric} · {c.scope}
                {c.prize?.amount_rm ? ` · prize RM ${c.prize.amount_rm}` : ""}
            </Text>
            {c.description ? <Text>{c.description}</Text> : null}

            <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                {c.status === "scheduled" ? (
                    <Button title="Activate" onPress={() => setStatus("active")} disabled={busy} />
                ) : null}
                {c.status === "active" ? (
                    <Button title="Mark finished" onPress={() => setStatus("finished")} disabled={busy} />
                ) : null}
                {c.status !== "cancelled" && c.status !== "finished" ? (
                    <Button
                        title="Cancel"
                        onPress={() => setStatus("cancelled")}
                        disabled={busy}
                        color="#b91c1c"
                    />
                ) : null}
            </View>

            <Text style={{ fontWeight: "600", marginTop: 16 }}>
                Standings ({s.total} participants)
            </Text>
            {s.entries.length === 0 ? (
                <Text style={{ color: "#666" }}>No sales recorded in the window yet.</Text>
            ) : (
                s.entries.map((e) => (
                    <View
                        key={e.employeeId}
                        style={{
                            flexDirection: "row",
                            paddingVertical: 6,
                            gap: 12,
                        }}
                    >
                        <Text style={{ width: 36, fontWeight: "600" }}>#{e.rank}</Text>
                        <Text style={{ flex: 1 }}>{e.name}</Text>
                        <Text>RM {Number(e.value).toFixed(0)}</Text>
                    </View>
                ))
            )}
        </View>
    );
}
