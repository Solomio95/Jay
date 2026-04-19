import { useRouter } from "expo-router";
import { useState } from "react";
import {
    Alert,
    Button,
    Switch,
    Text,
    TextInput,
    View,
} from "react-native";
import { supabase } from "../../src/supabase";

const LEAVE_CODES = ["AL", "MC", "UPL", "MAT", "PAT"] as const;

export default function NewLeaveRequest() {
    const router = useRouter();
    const [code, setCode] = useState<(typeof LEAVE_CODES)[number]>("AL");
    const [start, setStart] = useState("");
    const [end, setEnd] = useState("");
    const [halfDay, setHalfDay] = useState(false);
    const [reason, setReason] = useState("");
    const [busy, setBusy] = useState(false);

    const submit = async () => {
        if (!start || !end) {
            Alert.alert("Pick start and end dates (YYYY-MM-DD).");
            return;
        }
        setBusy(true);
        const { error } = await supabase.rpc("submit_leave_request", {
            p_leave_type_code: code,
            p_start_date: start,
            p_end_date: end,
            p_half_day: halfDay,
            p_reason: reason || null,
            p_attachment_url: null,
        });
        setBusy(false);
        if (error) {
            Alert.alert("Could not submit", error.message);
            return;
        }
        router.back();
    };

    return (
        <View style={{ flex: 1, padding: 16, gap: 12 }}>
            <Text style={{ fontSize: 24, fontWeight: "600" }}>New leave request</Text>

            <Text style={{ color: "#666" }}>Type</Text>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                {LEAVE_CODES.map((c) => (
                    <Text
                        key={c}
                        onPress={() => setCode(c)}
                        style={{
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            borderRadius: 8,
                            backgroundColor: c === code ? "#2563eb" : "#f4f4f5",
                            color: c === code ? "#fff" : "#111",
                            overflow: "hidden",
                        }}
                    >
                        {c}
                    </Text>
                ))}
            </View>

            <Text style={{ color: "#666" }}>Start date (YYYY-MM-DD)</Text>
            <TextInput
                value={start}
                onChangeText={setStart}
                placeholder="2026-05-01"
                autoCapitalize="none"
                style={{ borderWidth: 1, padding: 12, borderRadius: 8 }}
            />

            <Text style={{ color: "#666" }}>End date (YYYY-MM-DD)</Text>
            <TextInput
                value={end}
                onChangeText={setEnd}
                placeholder="2026-05-03"
                autoCapitalize="none"
                style={{ borderWidth: 1, padding: 12, borderRadius: 8 }}
            />

            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Switch value={halfDay} onValueChange={setHalfDay} />
                <Text>Half day</Text>
            </View>

            <Text style={{ color: "#666" }}>Reason (optional)</Text>
            <TextInput
                value={reason}
                onChangeText={setReason}
                placeholder="Family matters"
                multiline
                style={{
                    borderWidth: 1,
                    padding: 12,
                    borderRadius: 8,
                    minHeight: 80,
                }}
            />

            <Button title={busy ? "Submitting…" : "Submit"} onPress={submit} disabled={busy} />
        </View>
    );
}
