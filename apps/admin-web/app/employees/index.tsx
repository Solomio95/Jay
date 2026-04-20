import { Link } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Text,
    TextInput,
    View,
} from "react-native";
import { supabase } from "../../src/supabase";

interface EmployeeRow {
    id: string;
    employee_no: string;
    wage_type: string;
    base_salary: number;
    profile: {
        full_name: string;
        role: string;
        status: string;
        phone: string | null;
    } | null;
}

export default function EmployeesList() {
    const [rows, setRows] = useState<EmployeeRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState("");
    const [showInactive, setShowInactive] = useState(false);

    useEffect(() => {
        let active = true;
        (async () => {
            const { data } = await supabase
                .from("employees")
                .select(`
                    id, employee_no, wage_type, base_salary,
                    profile:profiles!inner(full_name, role, status, phone)
                `)
                .order("employee_no");
            if (!active) return;
            setRows((data ?? []) as unknown as EmployeeRow[]);
            setLoading(false);
        })();
        return () => {
            active = false;
        };
    }, []);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return rows.filter((r) => {
            if (!showInactive && r.profile?.status !== "active") return false;
            if (!q) return true;
            return (
                r.employee_no.toLowerCase().includes(q) ||
                (r.profile?.full_name ?? "").toLowerCase().includes(q)
            );
        });
    }, [rows, query, showInactive]);

    if (loading) {
        return (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                <ActivityIndicator />
            </View>
        );
    }

    return (
        <View style={{ flex: 1, padding: 24, gap: 12 }}>
            <Text style={{ fontSize: 28, fontWeight: "600" }}>Employees</Text>
            <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search by name or employee no."
                style={{ borderWidth: 1, padding: 10, borderRadius: 8 }}
            />
            <Text
                onPress={() => setShowInactive((v) => !v)}
                style={{ color: "#2563eb" }}
            >
                {showInactive ? "Hide inactive" : "Show inactive"}
            </Text>
            <Text style={{ color: "#666" }}>
                {filtered.length} of {rows.length}
            </Text>
            <FlatList
                data={filtered}
                keyExtractor={(r) => r.id}
                ItemSeparatorComponent={() => (
                    <View style={{ height: 1, backgroundColor: "#eee" }} />
                )}
                renderItem={({ item }) => <EmployeeRowView row={item} />}
            />
        </View>
    );
}

const EmployeeRowView = ({ row }: { row: EmployeeRow }) => {
    const name = row.profile?.full_name ?? "Unknown";
    const role = row.profile?.role ?? "";
    const inactive = row.profile?.status !== "active";
    return (
        <Link
            href={`/employees/${row.id}`}
            style={{ paddingVertical: 12, textDecorationLine: "none" }}
        >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{ flex: 2 }}>
                    <Text style={{ fontSize: 16, opacity: inactive ? 0.5 : 1 }}>{name}</Text>
                    <Text style={{ color: "#666", fontSize: 12 }}>
                        {row.employee_no} · {role}
                    </Text>
                </View>
                <Text style={{ flex: 1, textAlign: "right", color: "#666" }}>
                    {row.wage_type} · RM {Number(row.base_salary).toFixed(2)}
                </Text>
            </View>
        </Link>
    );
};
