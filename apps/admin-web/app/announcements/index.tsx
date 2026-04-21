import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Button,
    FlatList,
    Text,
    TextInput,
    View,
} from "react-native";
import { supabase } from "../../src/supabase";

interface Announcement {
    id: string;
    title: string;
    body: string;
    scope: string;
    scope_value: string | null;
    starts_on: string;
    ends_on: string | null;
    created_at: string;
}

const SCOPES = ["all", "role", "state"] as const;
const ROLES = ["promoter", "area_manager", "state_manager"] as const;

export default function AnnouncementsAdmin() {
    const [rows, setRows] = useState<Announcement[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);

    const [title, setTitle] = useState("");
    const [body, setBody] = useState("");
    const [scope, setScope] = useState<(typeof SCOPES)[number]>("all");
    const [scopeValue, setScopeValue] = useState("");
    const [startsOn, setStartsOn] = useState(new Date().toISOString().slice(0, 10));
    const [endsOn, setEndsOn] = useState("");

    const load = useCallback(async () => {
        setLoading(true);
        const { data } = await supabase
            .from("announcements")
            .select("id, title, body, scope, scope_value, starts_on, ends_on, created_at")
            .order("starts_on", { ascending: false })
            .limit(50);
        setRows((data ?? []) as Announcement[]);
        setLoading(false);
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const submit = async () => {
        if (!title || !body) {
            Alert.alert("Missing fields", "Title and body are required.");
            return;
        }
        setBusy(true);
        const {
            data: { user },
        } = await supabase.auth.getUser();
        const { error } = await supabase.from("announcements").insert({
            title,
            body,
            scope,
            scope_value: scope === "all" ? null : scopeValue || null,
            starts_on: startsOn || new Date().toISOString().slice(0, 10),
            ends_on: endsOn || null,
            created_by: user?.id,
        });
        setBusy(false);
        if (error) {
            Alert.alert("Could not post", error.message);
            return;
        }
        setTitle("");
        setBody("");
        setEndsOn("");
        await load();
    };

    const retire = async (id: string) => {
        const { error } = await supabase
            .from("announcements")
            .update({ ends_on: new Date().toISOString().slice(0, 10) })
            .eq("id", id);
        if (error) {
            Alert.alert("Could not retire", error.message);
            return;
        }
        await load();
    };

    return (
        <View style={{ flex: 1, padding: 24, gap: 12 }}>
            <Text style={{ fontSize: 24, fontWeight: "600" }}>Announcements</Text>

            <View
                style={{
                    borderWidth: 1,
                    borderColor: "#e4e4e7",
                    borderRadius: 8,
                    padding: 12,
                    gap: 8,
                }}
            >
                <TextInput
                    value={title}
                    onChangeText={setTitle}
                    placeholder="Title"
                    style={input}
                />
                <TextInput
                    value={body}
                    onChangeText={setBody}
                    placeholder="Message body"
                    multiline
                    style={{ ...input, minHeight: 80 }}
                />
                <View style={{ flexDirection: "row", gap: 8 }}>
                    {SCOPES.map((s) => (
                        <Text
                            key={s}
                            onPress={() => {
                                setScope(s);
                                setScopeValue("");
                            }}
                            style={{
                                paddingHorizontal: 10,
                                paddingVertical: 4,
                                borderRadius: 999,
                                backgroundColor: s === scope ? "#2563eb" : "#f4f4f5",
                                color: s === scope ? "#fff" : "#111",
                                fontSize: 12,
                                overflow: "hidden",
                            }}
                        >
                            {s}
                        </Text>
                    ))}
                </View>
                {scope === "role" ? (
                    <View style={{ flexDirection: "row", gap: 8 }}>
                        {ROLES.map((r) => (
                            <Text
                                key={r}
                                onPress={() => setScopeValue(r)}
                                style={{
                                    paddingHorizontal: 10,
                                    paddingVertical: 4,
                                    borderRadius: 999,
                                    backgroundColor: r === scopeValue ? "#2563eb" : "#f4f4f5",
                                    color: r === scopeValue ? "#fff" : "#111",
                                    fontSize: 12,
                                    overflow: "hidden",
                                }}
                            >
                                {r}
                            </Text>
                        ))}
                    </View>
                ) : null}
                {scope === "state" ? (
                    <TextInput
                        value={scopeValue}
                        onChangeText={setScopeValue}
                        placeholder="State UUID"
                        autoCapitalize="none"
                        style={input}
                    />
                ) : null}
                <View style={{ flexDirection: "row", gap: 8 }}>
                    <View style={{ flex: 1 }}>
                        <Text style={{ color: "#666", fontSize: 12 }}>Starts on</Text>
                        <TextInput
                            value={startsOn}
                            onChangeText={setStartsOn}
                            placeholder="YYYY-MM-DD"
                            style={input}
                        />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={{ color: "#666", fontSize: 12 }}>Ends on (optional)</Text>
                        <TextInput
                            value={endsOn}
                            onChangeText={setEndsOn}
                            placeholder="YYYY-MM-DD"
                            style={input}
                        />
                    </View>
                </View>
                <Button title={busy ? "Posting…" : "Post announcement"} onPress={submit} disabled={busy} />
            </View>

            <Text style={{ fontWeight: "600", marginTop: 8 }}>Recent</Text>
            {loading ? (
                <ActivityIndicator />
            ) : (
                <FlatList
                    data={rows}
                    keyExtractor={(r) => r.id}
                    ItemSeparatorComponent={() => (
                        <View style={{ height: 1, backgroundColor: "#eee" }} />
                    )}
                    renderItem={({ item }) => {
                        const active =
                            item.starts_on <= new Date().toISOString().slice(0, 10) &&
                            (!item.ends_on || item.ends_on >= new Date().toISOString().slice(0, 10));
                        return (
                            <View
                                style={{
                                    flexDirection: "row",
                                    paddingVertical: 10,
                                    alignItems: "center",
                                    gap: 8,
                                }}
                            >
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontWeight: "500" }}>{item.title}</Text>
                                    <Text style={{ color: "#666", fontSize: 12 }}>
                                        {item.starts_on}
                                        {item.ends_on ? ` - ${item.ends_on}` : ""} · {item.scope}
                                        {item.scope_value ? ` (${item.scope_value})` : ""}
                                    </Text>
                                </View>
                                {active ? (
                                    <Button title="Retire" onPress={() => retire(item.id)} color="#b91c1c" />
                                ) : null}
                            </View>
                        );
                    }}
                    ListEmptyComponent={
                        <Text style={{ color: "#666" }}>None posted yet.</Text>
                    }
                />
            )}
        </View>
    );
}

const input = {
    borderWidth: 1,
    borderColor: "#d4d4d8",
    padding: 10,
    borderRadius: 6,
} as const;
