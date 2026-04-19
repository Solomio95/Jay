import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Button, Text, TextInput, View } from "react-native";
import { supabase } from "../../src/supabase";

interface LeaveRequestRow {
    id: string;
    status: string;
    start_date: string;
    end_date: string;
    days: number;
    half_day: boolean;
    reason: string | null;
    current_approver_id: string | null;
    leave_type: { code: string } | null;
    employee: {
        id: string;
        profile: { full_name: string } | null;
    } | null;
}

type Action = "approve" | "reject" | "escalate";

export default function LeaveRequestDetail() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const [row, setRow] = useState<LeaveRequestRow | null>(null);
    const [loading, setLoading] = useState(true);
    const [note, setNote] = useState("");
    const [busy, setBusy] = useState<Action | null>(null);

    useEffect(() => {
        if (!id) return;
        let active = true;
        (async () => {
            const { data, error } = await supabase
                .from("leave_requests")
                .select(`
                    id, status, start_date, end_date, days, half_day, reason,
                    current_approver_id,
                    leave_type:leave_types(code),
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
            setRow(data as unknown as LeaveRequestRow);
            setLoading(false);
        })();
        return () => {
            active = false;
        };
    }, [id]);

    const act = async (action: Action) => {
        if (!id) return;
        setBusy(action);
        const { error } = await supabase.rpc("act_on_leave_request", {
            p_request_id: id,
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
                <Text>Request not found.</Text>
            </View>
        );
    }

    const name = row.employee?.profile?.full_name ?? "Unknown";
    const code = row.leave_type?.code ?? "Leave";
    const actionable = row.status === "pending" || row.status === "escalated";

    return (
        <View style={{ flex: 1, padding: 16, gap: 12 }}>
            <Text style={{ fontSize: 24, fontWeight: "600" }}>{name}</Text>
            <Text style={{ fontSize: 16 }}>
                {code} · {row.days} day(s){row.half_day ? " (half day)" : ""}
            </Text>
            <Text style={{ color: "#666" }}>
                {row.start_date} → {row.end_date}
            </Text>
            <Text style={{ color: "#666" }}>Status: {row.status}</Text>

            {row.reason ? (
                <View style={{ backgroundColor: "#f4f4f5", padding: 12, borderRadius: 8 }}>
                    <Text style={{ color: "#444" }}>{row.reason}</Text>
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
                            title={busy === "escalate" ? "Escalating…" : "Escalate"}
                            onPress={() => act("escalate")}
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
                    This request is no longer actionable.
                </Text>
            )}
        </View>
    );
}
