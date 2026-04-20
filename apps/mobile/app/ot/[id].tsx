import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Button,
    Text,
    TextInput,
    View,
} from "react-native";
import { supabase } from "../../src/supabase";

interface OtRow {
    id: string;
    status: string;
    work_date: string;
    hours: number;
    rate_multiplier: number;
    disposition: string;
    approved_by: string | null;
    notes: string | null;
    employee: {
        id: string;
        profile: { full_name: string } | null;
    } | null;
}

type Action = "approve" | "reject";

export default function OtDetail() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const [row, setRow] = useState<OtRow | null>(null);
    const [loading, setLoading] = useState(true);
    const [note, setNote] = useState("");
    const [busy, setBusy] = useState<Action | null>(null);

    useEffect(() => {
        if (!id) return;
        let active = true;
        (async () => {
            const { data, error } = await supabase
                .from("ot_records")
                .select(`
                    id, status, work_date, hours, rate_multiplier,
                    disposition, approved_by, notes,
                    employee:employees!inner(
                        id,
                        profile:profiles(full_name)
                    )
                `)
                .eq("id", id)
                .single();
            if (!active) return;
            if (error) {
                Alert.alert("Could not load", error.message);
                setLoading(false);
                return;
            }
            setRow(data as unknown as OtRow);
            setLoading(false);
        })();
        return () => {
            active = false;
        };
    }, [id]);

    const act = async (action: Action) => {
        if (!id) return;
        setBusy(action);
        const { error } = await supabase.rpc("act_on_ot_record", {
            p_record_id: id,
            p_action: action,
            p_note: note || null,
        });
        setBusy(null);
        if (error) {
            Alert.alert("Action failed", error.message);
            return;
        }
        router.back();
    };

    if (loading) {
        return (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                <ActivityIndicator />
            </View>
        );
    }
    if (!row) {
        return (
            <View style={{ flex: 1, padding: 24 }}>
                <Text>Record not found.</Text>
            </View>
        );
    }

    const name = row.employee?.profile?.full_name ?? "Unknown";
    const actionable = row.status === "pending";

    return (
        <View style={{ flex: 1, padding: 16, gap: 12 }}>
            <Text style={{ fontSize: 24, fontWeight: "600" }}>{name}</Text>
            <Text style={{ fontSize: 16 }}>
                {row.hours}h × {row.rate_multiplier}× on {row.work_date}
            </Text>
            <Text style={{ color: "#666" }}>
                {row.disposition === "pay" ? "Paid out" : "Time off in lieu"} · Status: {row.status}
            </Text>
            {row.notes ? (
                <View style={{ backgroundColor: "#f4f4f5", padding: 12, borderRadius: 8 }}>
                    <Text style={{ color: "#444" }}>{row.notes}</Text>
                </View>
            ) : null}

            {actionable ? (
                <>
                    <Text style={{ color: "#666", marginTop: 8 }}>Note (optional)</Text>
                    <TextInput
                        value={note}
                        onChangeText={setNote}
                        placeholder="Visible in the audit trail"
                        multiline
                        style={{
                            borderWidth: 1,
                            padding: 12,
                            borderRadius: 8,
                            minHeight: 60,
                        }}
                    />
                    <View style={{ gap: 8, marginTop: 8 }}>
                        <Button
                            title={busy === "approve" ? "Approving…" : "Approve"}
                            onPress={() => act("approve")}
                            disabled={busy !== null}
                        />
                        <Button
                            title={busy === "reject" ? "Rejecting…" : "Reject"}
                            onPress={() => act("reject")}
                            disabled={busy !== null}
                            color="#b91c1c"
                        />
                    </View>
                </>
            ) : (
                <Text style={{ color: "#666" }}>
                    This record is no longer actionable.
                </Text>
            )}
        </View>
    );
}
