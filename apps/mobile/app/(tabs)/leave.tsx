import { Link } from "expo-router";
import { FlatList, Text, View } from "react-native";
import { useLeaveRequests } from "../../src/features/leave/useLeaveRequests";

export default function LeaveScreen() {
    const { requests, balances } = useLeaveRequests();
    return (
        <View style={{ flex: 1, padding: 16, gap: 12 }}>
            <Text style={{ fontSize: 24, fontWeight: "600" }}>Leave</Text>
            <View style={{ flexDirection: "row", gap: 12 }}>
                {balances.map((b) => (
                    <View key={b.code} style={{ padding: 12, borderRadius: 8, backgroundColor: "#f4f4f5" }}>
                        <Text style={{ fontSize: 12 }}>{b.code}</Text>
                        <Text style={{ fontSize: 18, fontWeight: "600" }}>{b.available} days</Text>
                    </View>
                ))}
            </View>
            <Link href="/leave/new" style={{ color: "#2563eb", paddingVertical: 8 }}>
                + New request
            </Link>
            <FlatList
                data={requests}
                keyExtractor={(r) => r.id}
                renderItem={({ item }) => (
                    <View style={{ paddingVertical: 8, borderBottomWidth: 1, borderColor: "#eee" }}>
                        <Text>{item.leaveTypeCode} · {item.startDate} → {item.endDate}</Text>
                        <Text style={{ color: "#666" }}>{item.status}</Text>
                    </View>
                )}
            />
        </View>
    );
}
