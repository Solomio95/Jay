import { Button, Text, View } from "react-native";
import { useAuth } from "../../src/auth/useAuth";
import { supabase } from "../../src/supabase";

export default function Profile() {
    const { profile } = useAuth();
    return (
        <View style={{ flex: 1, padding: 16, gap: 12 }}>
            <Text style={{ fontSize: 24, fontWeight: "600" }}>Profile</Text>
            <Text>{profile?.fullName}</Text>
            <Text style={{ color: "#666" }}>{profile?.role}</Text>
            <Button title="Sign out" onPress={() => supabase.auth.signOut()} />
        </View>
    );
}
