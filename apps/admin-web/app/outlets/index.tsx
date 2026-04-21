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

interface OutletRow {
    id: string;
    code: string;
    name: string;
    geo_lat: number | null;
    geo_lng: number | null;
    allowed_radius_m: number;
    state: { code: string; name: string } | null;
    counters: { id: string; code: string; name: string; closed_on: string | null }[];
}

export default function OutletsList() {
    const [rows, setRows] = useState<OutletRow[]>([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        const { data } = await supabase
            .from("outlets")
            .select(`
                id, code, name, geo_lat, geo_lng, allowed_radius_m,
                state:states(code, name),
                counters(id, code, name, closed_on)
            `)
            .is("closed_on", null)
            .order("code");
        setRows((data ?? []) as unknown as OutletRow[]);
        setLoading(false);
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

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
    const geoSet = rows.filter((r) => r.geo_lat != null && r.geo_lng != null).length;

    return (
        <View style={{ flex: 1, padding: 24, gap: 12 }}>
            <Text style={{ fontSize: 28, fontWeight: "600" }}>Outlets & counters</Text>
            <Text style={{ color: "#666" }}>
                {rows.length} outlets · {totalCounters} active counters · {geoSet}/
                {rows.length} geofenced
            </Text>
            <FlatList
                data={rows}
                keyExtractor={(r) => r.id}
                ItemSeparatorComponent={() => (
                    <View style={{ height: 1, backgroundColor: "#eee" }} />
                )}
                renderItem={({ item }) => <OutletCard row={item} onSaved={load} />}
            />
        </View>
    );
}

const OutletCard = ({ row, onSaved }: { row: OutletRow; onSaved: () => void }) => {
    const [editing, setEditing] = useState(false);
    const [lat, setLat] = useState(row.geo_lat?.toString() ?? "");
    const [lng, setLng] = useState(row.geo_lng?.toString() ?? "");
    const [radius, setRadius] = useState(String(row.allowed_radius_m));
    const [saving, setSaving] = useState(false);
    const active = row.counters.filter((c) => !c.closed_on);

    const save = async () => {
        const lat_n = Number(lat);
        const lng_n = Number(lng);
        const rad_n = Number(radius);
        if (Number.isNaN(lat_n) || Number.isNaN(lng_n) || Number.isNaN(rad_n)) {
            Alert.alert("Invalid", "Latitude, longitude, and radius must be numbers.");
            return;
        }
        setSaving(true);
        const { error } = await supabase
            .from("outlets")
            .update({
                geo_lat: lat ? lat_n : null,
                geo_lng: lng ? lng_n : null,
                allowed_radius_m: rad_n,
            })
            .eq("id", row.id);
        setSaving(false);
        if (error) {
            Alert.alert("Could not save", error.message);
            return;
        }
        setEditing(false);
        onSaved();
    };

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
                <Text
                    style={{
                        marginLeft: "auto",
                        color: "#2563eb",
                        fontSize: 12,
                    }}
                    onPress={() => setEditing((v) => !v)}
                >
                    {editing ? "Cancel" : "Edit geofence"}
                </Text>
            </View>
            {row.geo_lat != null && row.geo_lng != null ? (
                <Text style={{ fontSize: 12, color: "#444" }}>
                    Geofence: {row.geo_lat}, {row.geo_lng} · ±{row.allowed_radius_m}m
                </Text>
            ) : (
                <Text style={{ fontSize: 12, color: "#b45309" }}>
                    No geofence set — promoters here cannot use geofenced clock-in.
                </Text>
            )}
            {editing ? (
                <View style={{ flexDirection: "row", gap: 6, marginTop: 4 }}>
                    <TextInput
                        value={lat}
                        onChangeText={setLat}
                        placeholder="lat"
                        keyboardType="decimal-pad"
                        style={input}
                    />
                    <TextInput
                        value={lng}
                        onChangeText={setLng}
                        placeholder="lng"
                        keyboardType="decimal-pad"
                        style={input}
                    />
                    <TextInput
                        value={radius}
                        onChangeText={setRadius}
                        placeholder="radius m"
                        keyboardType="decimal-pad"
                        style={{ ...input, maxWidth: 110 }}
                    />
                    <Button title={saving ? "…" : "Save"} onPress={save} disabled={saving} />
                </View>
            ) : null}
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

const input = {
    borderWidth: 1,
    borderColor: "#d4d4d8",
    padding: 6,
    borderRadius: 6,
    flex: 1,
    fontSize: 13,
} as const;
