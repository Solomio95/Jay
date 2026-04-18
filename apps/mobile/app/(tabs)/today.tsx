import { ScrollView, Text, View } from "react-native";
import { useTodayStats } from "../../src/features/today/useTodayStats";

export default function Today() {
    const { loading, data } = useTodayStats();

    return (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
            <Text style={{ fontSize: 24, fontWeight: "600" }}>Today</Text>
            {loading ? <Text>Loading…</Text> : (
                <>
                    <Card label="Today's sales" value={`RM ${data?.salesToday.toFixed(2) ?? "—"}`} />
                    <Card label="This month" value={`RM ${data?.salesMonth.toFixed(2) ?? "—"}`} />
                    <Card label="Commission-to-date" value={`RM ${data?.commissionMtd.toFixed(2) ?? "—"}`} />
                    <Card label="Attendance rate" value={`${((data?.attendance ?? 0) * 100).toFixed(1)}%`} />
                </>
            )}
        </ScrollView>
    );
}

function Card({ label, value }: { label: string; value: string }) {
    return (
        <View style={{ padding: 16, borderRadius: 12, backgroundColor: "#f4f4f5" }}>
            <Text style={{ fontSize: 12, color: "#666" }}>{label}</Text>
            <Text style={{ fontSize: 24, fontWeight: "600" }}>{value}</Text>
        </View>
    );
}
