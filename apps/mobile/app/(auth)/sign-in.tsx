import { useState } from "react";
import { Button, Text, TextInput, View } from "react-native";
import { supabase } from "../../src/supabase";

export default function SignIn() {
    const [phone, setPhone] = useState("");
    const [otp, setOtp] = useState("");
    const [stage, setStage] = useState<"phone" | "otp">("phone");

    const requestOtp = async () => {
        const { error } = await supabase.auth.signInWithOtp({ phone });
        if (!error) setStage("otp");
    };

    const verifyOtp = async () => {
        await supabase.auth.verifyOtp({ phone, token: otp, type: "sms" });
    };

    return (
        <View style={{ flex: 1, padding: 24, justifyContent: "center", gap: 16 }}>
            <Text style={{ fontSize: 28, fontWeight: "600" }}>Bentop HR</Text>
            {stage === "phone" ? (
                <>
                    <TextInput
                        placeholder="Phone number (e.g. +60123456789)"
                        value={phone}
                        onChangeText={setPhone}
                        keyboardType="phone-pad"
                        style={{ borderWidth: 1, padding: 12, borderRadius: 8 }}
                    />
                    <Button title="Send OTP" onPress={requestOtp} />
                </>
            ) : (
                <>
                    <TextInput
                        placeholder="6-digit code"
                        value={otp}
                        onChangeText={setOtp}
                        keyboardType="number-pad"
                        style={{ borderWidth: 1, padding: 12, borderRadius: 8 }}
                    />
                    <Button title="Verify" onPress={verifyOtp} />
                </>
            )}
        </View>
    );
}
