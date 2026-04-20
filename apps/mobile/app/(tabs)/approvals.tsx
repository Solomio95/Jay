import { Link } from "expo-router";
import { FlatList, Text, View } from "react-native";
import { RoleGuard } from "../../src/auth/RoleGuard";
import { usePendingApprovals } from "../../src/features/approvals/usePendingApprovals";

export default function Approvals() {
    return (
        <RoleGuard
            allow={["area_manager", "state_manager"]}
            fallbackMessage="Only managers can see approvals."
        >
            <ApprovalsList />
        </RoleGuard>
    );
}

const ApprovalsList = () => {
    const { items, loading } = usePendingApprovals();

    if (loading) {
        return (
            <View style={{ flex: 1, padding: 24 }}>
                <Text>Loading…</Text>
            </View>
        );
    }
    if (items.length === 0) {
        return (
            <View style={{ flex: 1, padding: 24 }}>
                <Text style={{ fontSize: 24, fontWeight: "600", marginBottom: 12 }}>
                    Approvals
                </Text>
                <Text style={{ color: "#666" }}>Nothing waiting. Nice.</Text>
            </View>
        );
    }
    return (
        <View style={{ flex: 1, padding: 16 }}>
            <Text style={{ fontSize: 24, fontWeight: "600", marginBottom: 12 }}>
                Approvals
            </Text>
            <FlatList
                data={items}
                keyExtractor={(i) => i.id}
                renderItem={({ item }) => {
                    const body = (
                        <View
                            style={{
                                paddingVertical: 12,
                                borderBottomWidth: 1,
                                borderColor: "#eee",
                            }}
                        >
                            <Text style={{ fontWeight: "500" }}>{item.requesterName}</Text>
                            <Text style={{ color: "#666" }}>
                                {item.kind} · {item.summary}
                            </Text>
                        </View>
                    );
                    if (item.kind === "leave_request") {
                        return (
                            <Link href={`/leave/${item.id}`} asChild>
                                {body}
                            </Link>
                        );
                    }
                    if (item.kind === "ot_record") {
                        return (
                            <Link href={`/ot/${item.id}`} asChild>
                                {body}
                            </Link>
                        );
                    }
                    return body;
                }}
            />
        </View>
    );
};
