import { FlatList, Text, View } from "react-native";
import { RoleGuard } from "../../src/auth/RoleGuard";
import { useTeam } from "../../src/features/team/useTeam";

export default function Team() {
    return (
        <RoleGuard
            allow={["area_manager", "state_manager"]}
            fallbackMessage="Only managers can see their team."
        >
            <TeamList />
        </RoleGuard>
    );
}

const TeamList = () => {
    const { members, loading } = useTeam();
    if (loading) {
        return (
            <View style={{ flex: 1, padding: 24 }}>
                <Text>Loading…</Text>
            </View>
        );
    }
    return (
        <View style={{ flex: 1, padding: 16 }}>
            <Text style={{ fontSize: 24, fontWeight: "600", marginBottom: 12 }}>
                Team
            </Text>
            <FlatList
                data={members}
                keyExtractor={(m) => m.id}
                renderItem={({ item }) => (
                    <View
                        style={{
                            paddingVertical: 12,
                            borderBottomWidth: 1,
                            borderColor: "#eee",
                        }}
                    >
                        <Text style={{ fontWeight: "500" }}>{item.fullName}</Text>
                        <Text style={{ color: "#666" }}>
                            {item.role} · {item.outletName ?? "—"}
                        </Text>
                    </View>
                )}
            />
        </View>
    );
};
