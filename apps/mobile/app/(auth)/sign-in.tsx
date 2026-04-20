import { Redirect } from "expo-router";
import { useState } from "react";
import {
    ActivityIndicator,
    Button,
    Text,
    TextInput,
    View,
} from "react-native";
import { useAuth } from "../../src/auth/AuthContext";
import { supabase } from "../../src/supabase";

export default function SignIn() {
    const { session, loading: authLoading } = useAuth();
    const [phone, setPhone] = useState("");
    const [otp, setOtp] = useState("");
    const [stage, setStage] = useState<"phone" | "otp">("phone");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (authLoading) {
        return (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                <ActivityIndicator />
            </View>
        );
    }
    if (session) return <Redirect href="/(tabs)/today" />;

    const requestOtp = async () => {
        setBusy(true);
        setError(null);
        const { error } = await supabase.auth.signInWithOtp({ phone });
        setBusy(false);
        if (error) {
            setError(error.message);
            return;
        }
        setStage("otp");
    };

    const verifyOtp = async () => {
        setBusy(true);
        setError(null);
        const { error } = await supabase.auth.verifyOtp({
            phone,
            token: otp,
            type: "sms",
        });
        setBusy(false);
        if (error) {
            setError(error.message);
            return;
        }
        // Auth state change fires → the Redirect above will take over.
    };

    return (
        <View style={{ flex: 1, padding: 24, justifyContent: "center", gap: 16 }}>
            <Text style={{ fontSize: 28, fontWeight: "600" }}>Bentop HR</Text>
            <Text style={{ color: "#666" }}>
                {stage === "phone"
                    ? "Enter your phone number to receive a sign-in code."
                    : `We sent a code to ${phone}. Enter it below.`}
            </Text>

            {stage === "phone" ? (
                <>
                    <TextInput
                        placeholder="+60123456789"
                        value={phone}
                        onChangeText={setPhone}
                        keyboardType="phone-pad"
                        autoCapitalize="none"
                        editable={!busy}
                        style={{ borderWidth: 1, padding: 12, borderRadius: 8 }}
                    />
                    <Button
                        title={busy ? "Sending…" : "Send code"}
                        onPress={requestOtp}
                        disabled={busy || phone.length < 8}
                    />
                </>
            ) : (
                <>
                    <TextInput
                        placeholder="6-digit code"
                        value={otp}
                        onChangeText={setOtp}
                        keyboardType="number-pad"
                        editable={!busy}
                        maxLength={6}
                        style={{ borderWidth: 1, padding: 12, borderRadius: 8 }}
                    />
                    <Button
                        title={busy ? "Verifying…" : "Verify"}
                        onPress={verifyOtp}
                        disabled={busy || otp.length < 6}
                    />
                    <Button
                        title="Use a different number"
                        onPress={() => {
                            setStage("phone");
                            setOtp("");
                            setError(null);
                        }}
                        disabled={busy}
                    />
                </>
            )}

            {error ? (
                <Text style={{ color: "#b91c1c" }}>{error}</Text>
            ) : null}
        </View>
    );
}
