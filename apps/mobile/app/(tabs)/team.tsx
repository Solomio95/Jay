import { useState } from "react";
import { ActivityIndicator, FlatList, Text, View } from "react-native";
import { RoleGuard } from "../../src/auth/RoleGuard";
import {
    useTeamAnalytics,
    type TeamRow,
} from "../../src/features/team/useTeamAnalytics";

const monthOptions = (count: number): string[] => {
    const now = new Date();
    const out: string[] = [];
    for (let i = 0; i < count; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`);
    }
    return out;
};

export default function Team() {
    return (
        <RoleGuard
            allow={["area_manager", "state_manager"]}
            fallbackMessage="Only managers can see their team."
        >
            <TeamAnalytics />
        </RoleGuard>
    );
}

const TeamAnalytics = () => {
    const periods = monthOptions(3);
    const [period, setPeriod] = useState<string>(periods[0]!);
    const { rows, totals, loading } = useTeamAnalytics(period);

    if (loading || !totals) {
        return (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                <ActivityIndicator />
            </View>
        );
    }

    return (
        <View style={{ flex: 1, padding: 16 }}>
            <Text style={{ fontSize: 24, fontWeight: "600", marginBottom: 8 }}>Team</Text>

            <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
                {periods.map((p) => (
                    <Text
                        key={p}
                        onPress={() => setPeriod(p)}
                        style={{
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            borderRadius: 999,
                            backgroundColor: p === period ? "#2563eb" : "#f4f4f5",
                            color: p === period ? "#fff" : "#111",
                            fontSize: 12,
                            overflow: "hidden",
                        }}
                    >
                        {p.slice(0, 7)}
                    </Text>
                ))}
            </View>

            <View
                style={{
                    flexDirection: "row",
                    gap: 12,
                    padding: 12,
                    borderRadius: 12,
                    backgroundColor: "#eff6ff",
                    marginBottom: 12,
                }}
            >
                <Stat label="People" value={String(totals.employees)} />
                <Stat label="Net sales" value={`RM ${Number(totals.net_sales).toFixed(0)}`} />
                <Stat
                    label="Commission"
                    value={`RM ${Number(totals.commission).toFixed(0)}`}
                />
                <Stat
                    label="Avg attend."
                    value={
                        totals.avg_attendance == null
                            ? "—"
                            : `${(Number(totals.avg_attendance) * 100).toFixed(0)}%`
                    }
                />
            </View>

            <FlatList
                data={rows}
                keyExtractor={(r) => r.employee_id}
                ListHeaderComponent={
                    <View
                        style={{
                            flexDirection: "row",
                            paddingBottom: 6,
                            borderBottomWidth: 2,
                            borderColor: "#ddd",
                        }}
                    >
                        <Text style={{ flex: 2, fontWeight: "600" }}>Name</Text>
                        <Text style={{ flex: 1, textAlign: "right", fontWeight: "600" }}>
                            Sales
                        </Text>
                        <Text style={{ flex: 1, textAlign: "right", fontWeight: "600" }}>
                            Comm
                        </Text>
                        <Text style={{ width: 50, textAlign: "right", fontWeight: "600" }}>
                            Att.
                        </Text>
                    </View>
                }
                ItemSeparatorComponent={() => (
                    <View style={{ height: 1, backgroundColor: "#eee" }} />
                )}
                renderItem={({ item }) => <MemberRow row={item} />}
                ListEmptyComponent={
                    <Text style={{ color: "#666", paddingVertical: 12 }}>
                        No activity for this period.
                    </Text>
                }
            />
        </View>
    );
};

const MemberRow = ({ row }: { row: TeamRow }) => (
    <View style={{ flexDirection: "row", paddingVertical: 10 }}>
        <View style={{ flex: 2 }}>
            <Text style={{ fontWeight: "500" }}>{row.full_name}</Text>
            <Text style={{ color: "#888", fontSize: 12 }}>
                {row.employee_no} · {row.role}
            </Text>
        </View>
        <Text style={{ flex: 1, textAlign: "right" }}>
            {Number(row.net_sales).toFixed(0)}
        </Text>
        <Text style={{ flex: 1, textAlign: "right" }}>
            {Number(row.commission).toFixed(0)}
        </Text>
        <Text style={{ width: 50, textAlign: "right" }}>
            {row.attendance_rate == null
                ? "—"
                : `${(Number(row.attendance_rate) * 100).toFixed(0)}%`}
        </Text>
    </View>
);

const Stat = ({ label, value }: { label: string; value: string }) => (
    <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 11, color: "#666" }}>{label}</Text>
        <Text style={{ fontSize: 16, fontWeight: "600" }}>{value}</Text>
    </View>
);
