import { useRouter } from "expo-router";
import * as Location from "expo-location";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Button, Text, View } from "react-native";
import { supabase } from "../src/supabase";

interface OpenShift {
    id: string;
    clock_in: string;
}

export default function ClockIn() {
    const router = useRouter();
    const [busy, setBusy] = useState(false);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState<OpenShift | null>(null);
    const [lastCoords, setLastCoords] = useState<{ lat: number; lng: number } | null>(null);

    useEffect(() => {
        let active = true;
        (async () => {
            const { data: userRes } = await supabase.auth.getUser();
            const uid = userRes.user?.id;
            if (!uid) {
                setLoading(false);
                return;
            }
            const { data: me } = await supabase
                .from("employees")
                .select("id")
                .eq("profile_id", uid)
                .single();
            if (!me || !active) {
                setLoading(false);
                return;
            }
            const today = new Date().toISOString().slice(0, 10);
            const { data } = await supabase
                .from("attendance_logs")
                .select("id, clock_in")
                .eq("employee_id", me.id)
                .is("clock_out", null)
                .gte("clock_in", `${today}T00:00:00`)
                .order("clock_in", { ascending: false })
                .limit(1)
                .maybeSingle();
            if (!active) return;
            setOpen((data ?? null) as OpenShift | null);
            setLoading(false);
        })();
        return () => {
            active = false;
        };
    }, []);

    const getCoords = async (): Promise<{ lat: number; lng: number } | null> => {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
            Alert.alert("Location required", "Geofenced clock-in needs your location.");
            return null;
        }
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLastCoords(coords);
        return coords;
    };

    const clockIn = async () => {
        setBusy(true);
        const coords = await getCoords();
        if (!coords) {
            setBusy(false);
            return;
        }
        const { data, error } = await supabase.rpc("clock_in_geofenced", {
            p_lat: coords.lat,
            p_lng: coords.lng,
        });
        setBusy(false);
        if (error) {
            Alert.alert("Could not clock in", error.message);
            return;
        }
        setOpen(data as OpenShift);
        Alert.alert("Clocked in", new Date().toLocaleTimeString());
    };

    const clockOut = async () => {
        setBusy(true);
        const coords = await getCoords();
        if (!coords) {
            setBusy(false);
            return;
        }
        const { error } = await supabase.rpc("clock_out_geofenced", {
            p_lat: coords.lat,
            p_lng: coords.lng,
        });
        setBusy(false);
        if (error) {
            Alert.alert("Could not clock out", error.message);
            return;
        }
        setOpen(null);
        Alert.alert("Clocked out", new Date().toLocaleTimeString());
        router.back();
    };

    if (loading) {
        return (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                <ActivityIndicator />
            </View>
        );
    }

    return (
        <View style={{ flex: 1, padding: 24, gap: 16 }}>
            <Text style={{ fontSize: 24, fontWeight: "600" }}>Clock in / out</Text>
            {open ? (
                <View
                    style={{
                        padding: 16,
                        borderRadius: 12,
                        backgroundColor: "#dcfce7",
                        gap: 4,
                    }}
                >
                    <Text style={{ fontWeight: "600" }}>You're clocked in</Text>
                    <Text style={{ color: "#166534", fontSize: 12 }}>
                        since {new Date(open.clock_in).toLocaleTimeString()}
                    </Text>
                </View>
            ) : (
                <Text style={{ color: "#666" }}>No open shift. Tap below to clock in.</Text>
            )}

            {open ? (
                <Button title={busy ? "…" : "Clock out"} onPress={clockOut} disabled={busy} />
            ) : (
                <Button title={busy ? "…" : "Clock in"} onPress={clockIn} disabled={busy} />
            )}

            {lastCoords ? (
                <Text style={{ color: "#666", fontSize: 12 }}>
                    Last reading: {lastCoords.lat.toFixed(5)}, {lastCoords.lng.toFixed(5)}
                </Text>
            ) : null}
            <Text style={{ color: "#666", fontSize: 12 }}>
                You must be within the outlet's allowed radius to clock in or out.
            </Text>
        </View>
    );
}
