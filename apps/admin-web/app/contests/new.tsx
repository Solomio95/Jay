import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Button, Text, TextInput, View } from "react-native";
import { supabase } from "../../src/supabase";

const SCOPES = ["national", "state", "region", "outlet"] as const;

export default function NewContest() {
    const router = useRouter();
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [periodStart, setPeriodStart] = useState("");
    const [periodEnd, setPeriodEnd] = useState("");
    const [scope, setScope] = useState<(typeof SCOPES)[number]>("national");
    const [scopeId, setScopeId] = useState("");
    const [prizeRm, setPrizeRm] = useState("");
    const [busy, setBusy] = useState(false);

    const submit = async () => {
        if (!name || !periodStart || !periodEnd) {
            Alert.alert("Missing fields", "Name, start, and end are required.");
            return;
        }
        setBusy(true);
        const { error } = await supabase.from("contests").insert({
            name,
            description: description || null,
            metric: "net_sales",
            scope,
            scope_id: scope === "national" ? null : scopeId || null,
            period_start: periodStart,
            period_end: periodEnd,
            prize: prizeRm ? { amount_rm: Number(prizeRm) } : null,
            status: "scheduled",
        });
        setBusy(false);
        if (error) {
            Alert.alert("Could not create", error.message);
            return;
        }
        router.back();
    };

    return (
        <View style={{ flex: 1, padding: 24, gap: 10, maxWidth: 600 }}>
            <Text style={{ fontSize: 24, fontWeight: "600" }}>New contest</Text>

            <Label>Name</Label>
            <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Raya Champion 2026"
                style={input}
            />

            <Label>Description</Label>
            <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Top seller for the Ramadan month wins…"
                multiline
                style={{ ...input, minHeight: 60 }}
            />

            <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1 }}>
                    <Label>Start (YYYY-MM-DD)</Label>
                    <TextInput
                        value={periodStart}
                        onChangeText={setPeriodStart}
                        placeholder="2026-03-01"
                        style={input}
                    />
                </View>
                <View style={{ flex: 1 }}>
                    <Label>End (YYYY-MM-DD)</Label>
                    <TextInput
                        value={periodEnd}
                        onChangeText={setPeriodEnd}
                        placeholder="2026-03-31"
                        style={input}
                    />
                </View>
            </View>

            <Label>Scope</Label>
            <View style={{ flexDirection: "row", gap: 8 }}>
                {SCOPES.map((s) => (
                    <Text
                        key={s}
                        onPress={() => setScope(s)}
                        style={{
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            borderRadius: 999,
                            backgroundColor: s === scope ? "#2563eb" : "#f4f4f5",
                            color: s === scope ? "#fff" : "#111",
                            overflow: "hidden",
                            fontSize: 13,
                        }}
                    >
                        {s}
                    </Text>
                ))}
            </View>

            {scope !== "national" ? (
                <>
                    <Label>{`Scope ID (${scope === "outlet" ? "outlet" : "state"} UUID)`}</Label>
                    <TextInput
                        value={scopeId}
                        onChangeText={setScopeId}
                        placeholder="00000000-…"
                        autoCapitalize="none"
                        style={input}
                    />
                </>
            ) : null}

            <Label>Prize (RM, optional)</Label>
            <TextInput
                value={prizeRm}
                onChangeText={setPrizeRm}
                keyboardType="decimal-pad"
                placeholder="500"
                style={input}
            />

            <Button title={busy ? "Saving…" : "Save as scheduled"} onPress={submit} disabled={busy} />
        </View>
    );
}

const Label = ({ children }: { children: string }) => (
    <Text style={{ color: "#666", marginTop: 6 }}>{children}</Text>
);

const input = {
    borderWidth: 1,
    borderColor: "#d4d4d8",
    padding: 10,
    borderRadius: 6,
} as const;
