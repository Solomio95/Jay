import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Button,
    ScrollView,
    Text,
    View,
} from "react-native";
import { useAuth } from "../../src/auth/AuthContext";
import { supabase } from "../../src/supabase";

interface EmployeeSelf {
    employee_no: string;
    epf_no: string | null;
    socso_no: string | null;
    tax_no: string | null;
    bank_name: string | null;
    bank_account: string | null;
    wage_type: string;
    profile: { phone: string | null; email: string | null } | null;
}

interface BalanceRow {
    code: string;
    available: number;
}

export default function Profile() {
    const { profile, signOut } = useAuth();
    const [me, setMe] = useState<EmployeeSelf | null>(null);
    const [balances, setBalances] = useState<BalanceRow[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!profile) return;
        let active = true;
        (async () => {
            const [empRes, balRes] = await Promise.all([
                supabase
                    .from("employees")
                    .select(`
                        employee_no, epf_no, socso_no, tax_no,
                        bank_name, bank_account, wage_type,
                        profile:profiles!inner(phone, email)
                    `)
                    .eq("profile_id", profile.id)
                    .maybeSingle(),
                supabase.rpc("my_leave_balances"),
            ]);
            if (!active) return;
            setMe(empRes.data as unknown as EmployeeSelf | null);
            setBalances((balRes.data ?? []) as BalanceRow[]);
            setLoading(false);
        })();
        return () => {
            active = false;
        };
    }, [profile]);

    if (loading) {
        return (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                <ActivityIndicator />
            </View>
        );
    }

    return (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
            <View>
                <Text style={{ fontSize: 24, fontWeight: "600" }}>
                    {profile?.fullName ?? "—"}
                </Text>
                <Text style={{ color: "#666" }}>
                    {profile?.role}
                    {me?.employee_no ? ` · ${me.employee_no}` : ""}
                </Text>
            </View>

            {balances.length > 0 ? (
                <Section title="Leave balances">
                    <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
                        {balances.map((b) => (
                            <View
                                key={b.code}
                                style={{
                                    padding: 12,
                                    borderRadius: 8,
                                    backgroundColor: "#f4f4f5",
                                    minWidth: 80,
                                }}
                            >
                                <Text style={{ fontSize: 12, color: "#666" }}>{b.code}</Text>
                                <Text style={{ fontSize: 18, fontWeight: "600" }}>
                                    {b.available}
                                </Text>
                            </View>
                        ))}
                    </View>
                </Section>
            ) : null}

            <Section title="Contact">
                <Row label="Phone" value={me?.profile?.phone ?? "—"} />
                <Row label="Email" value={me?.profile?.email ?? "—"} />
            </Section>

            <Section title="Statutory">
                <Row label="EPF no." value={me?.epf_no ?? "—"} />
                <Row label="SOCSO no." value={me?.socso_no ?? "—"} />
                <Row label="Tax no." value={me?.tax_no ?? "—"} />
            </Section>

            <Section title="Bank">
                <Row label="Bank" value={me?.bank_name ?? "—"} />
                <Row label="Account" value={me?.bank_account ?? "—"} />
            </Section>

            <Text style={{ color: "#666", fontSize: 12 }}>
                Updates to these details need HR — reach out if anything is wrong.
            </Text>

            <Button title="Sign out" onPress={signOut} />
        </ScrollView>
    );
}

const Section = ({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}) => (
    <View style={{ gap: 6 }}>
        <Text style={{ fontSize: 16, fontWeight: "600" }}>{title}</Text>
        {children}
    </View>
);

const Row = ({ label, value }: { label: string; value: string }) => (
    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ color: "#666" }}>{label}</Text>
        <Text>{value}</Text>
    </View>
);
