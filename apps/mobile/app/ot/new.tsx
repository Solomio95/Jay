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

const RATES = [1.5, 2.0, 3.0] as const;

export default function NewOtRequest() {
    const router = useRouter();
    const [workDate, setWorkDate] = useState("");
    const [hours, setHours] = useState("");
    const [rate, setRate] = useState<(typeof RATES)[number]>(1.5);
    const [asTimeOff, setAsTimeOff] = useState(false);
    const [notes, setNotes] = useState("");
    const [busy, setBusy] = useState(false);

    const submit = async () => {
        if (!workDate) {
            Alert.alert("Pick the work date (YYYY-MM-DD).");
            return;
        }
        const h = Number(hours);
        if (!h || h <= 0 || h > 16) {
            Alert.alert("Enter valid hours (up to 16).");
            return;
        }
        setBusy(true);
        const { error } = await supabase.rpc("submit_ot_record", {
            p_work_date: workDate,
            p_hours: h,
            p_rate_multiplier: rate,
            p_disposition: asTimeOff ? "time_off_in_lieu" : "pay",
            p_notes: notes || null,
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
            <Text style={{ fontSize: 24, fontWeight: "600" }}>New OT record</Text>

            <Text style={{ color: "#666" }}>Work date (YYYY-MM-DD)</Text>
            <TextInput
                value={workDate}
                onChangeText={setWorkDate}
                placeholder="2026-04-19"
                autoCapitalize="none"
                style={{ borderWidth: 1, padding: 12, borderRadius: 8 }}
            />

            <Text style={{ color: "#666" }}>Hours</Text>
            <TextInput
                value={hours}
                onChangeText={setHours}
                keyboardType="decimal-pad"
                placeholder="3"
                style={{ borderWidth: 1, padding: 12, borderRadius: 8 }}
            />

            <Text style={{ color: "#666" }}>Rate multiplier</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
                {RATES.map((r) => (
                    <Text
                        key={r}
                        onPress={() => setRate(r)}
                        style={{
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            borderRadius: 8,
                            backgroundColor: r === rate ? "#2563eb" : "#f4f4f5",
                            color: r === rate ? "#fff" : "#111",
                            overflow: "hidden",
                        }}
                    >
                        {r.toFixed(1)}×
                    </Text>
                ))}
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Switch value={asTimeOff} onValueChange={setAsTimeOff} />
                <Text>Take as time off in lieu instead of pay</Text>
            </View>

            <Text style={{ color: "#666" }}>Notes (optional)</Text>
            <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Stock-take after closing"
                multiline
                style={{
                    borderWidth: 1,
                    padding: 12,
                    borderRadius: 8,
                    minHeight: 80,
                }}
            />

            <Button
                title={busy ? "Submitting…" : "Submit"}
                onPress={submit}
                disabled={busy}
            />
        </View>
    );
}
