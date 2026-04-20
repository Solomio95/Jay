import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Button,
    ScrollView,
    Text,
    TextInput,
    View,
} from "react-native";
import { supabase } from "../../src/supabase";

interface EmployeeDetail {
    id: string;
    profile_id: string;
    employee_no: string;
    wage_type: "monthly" | "hourly" | "daily";
    base_salary: number;
    hourly_rate: number | null;
    daily_rate: number | null;
    epf_no: string | null;
    socso_no: string | null;
    tax_no: string | null;
    pcb_category: string | null;
    dependents: number;
    bank_name: string | null;
    bank_account: string | null;
    profile: {
        full_name: string;
        role: string;
        status: string;
        phone: string | null;
        email: string | null;
    } | null;
}

const WAGE_TYPES = ["monthly", "hourly", "daily"] as const;

export default function EmployeeDetailPage() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const [row, setRow] = useState<EmployeeDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [baseSalary, setBaseSalary] = useState("");
    const [hourlyRate, setHourlyRate] = useState("");
    const [dailyRate, setDailyRate] = useState("");
    const [wageType, setWageType] = useState<typeof WAGE_TYPES[number]>("monthly");
    const [dependents, setDependents] = useState("0");
    const [pcbCategory, setPcbCategory] = useState("");
    const [epfNo, setEpfNo] = useState("");
    const [socsoNo, setSocsoNo] = useState("");
    const [taxNo, setTaxNo] = useState("");
    const [bankName, setBankName] = useState("");
    const [bankAccount, setBankAccount] = useState("");

    useEffect(() => {
        if (!id) return;
        let active = true;
        (async () => {
            const { data, error } = await supabase
                .from("employees")
                .select(`
                    id, profile_id, employee_no, wage_type, base_salary,
                    hourly_rate, daily_rate, epf_no, socso_no, tax_no,
                    pcb_category, dependents, bank_name, bank_account,
                    profile:profiles!inner(full_name, role, status, phone, email)
                `)
                .eq("id", id)
                .single();
            if (!active) return;
            if (error || !data) {
                Alert.alert("Could not load", error?.message ?? "not found");
                setLoading(false);
                return;
            }
            const d = data as unknown as EmployeeDetail;
            setRow(d);
            setBaseSalary(String(d.base_salary ?? 0));
            setHourlyRate(d.hourly_rate != null ? String(d.hourly_rate) : "");
            setDailyRate(d.daily_rate != null ? String(d.daily_rate) : "");
            setWageType(d.wage_type);
            setDependents(String(d.dependents ?? 0));
            setPcbCategory(d.pcb_category ?? "");
            setEpfNo(d.epf_no ?? "");
            setSocsoNo(d.socso_no ?? "");
            setTaxNo(d.tax_no ?? "");
            setBankName(d.bank_name ?? "");
            setBankAccount(d.bank_account ?? "");
            setLoading(false);
        })();
        return () => {
            active = false;
        };
    }, [id]);

    const save = async () => {
        if (!id) return;
        setSaving(true);
        const { error } = await supabase
            .from("employees")
            .update({
                wage_type: wageType,
                base_salary: Number(baseSalary) || 0,
                hourly_rate: hourlyRate ? Number(hourlyRate) : null,
                daily_rate: dailyRate ? Number(dailyRate) : null,
                dependents: Number(dependents) || 0,
                pcb_category: pcbCategory || null,
                epf_no: epfNo || null,
                socso_no: socsoNo || null,
                tax_no: taxNo || null,
                bank_name: bankName || null,
                bank_account: bankAccount || null,
            })
            .eq("id", id);
        setSaving(false);
        if (error) {
            Alert.alert("Save failed", error.message);
            return;
        }
        Alert.alert("Saved");
    };

    if (loading || !row) {
        return (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                <ActivityIndicator />
            </View>
        );
    }

    const name = row.profile?.full_name ?? "Unknown";

    return (
        <ScrollView contentContainerStyle={{ padding: 24, gap: 16, maxWidth: 720 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <Button title="← Back" onPress={() => router.back()} />
                <Text style={{ fontSize: 24, fontWeight: "600" }}>{name}</Text>
            </View>
            <Text style={{ color: "#666" }}>
                {row.employee_no} · {row.profile?.role} · {row.profile?.status}
            </Text>
            <Text style={{ color: "#666" }}>
                {row.profile?.phone ?? "—"} · {row.profile?.email ?? "—"}
            </Text>

            <Section title="Wage">
                <Label text="Wage type" />
                <View style={{ flexDirection: "row", gap: 8 }}>
                    {WAGE_TYPES.map((w) => (
                        <Text
                            key={w}
                            onPress={() => setWageType(w)}
                            style={{
                                paddingHorizontal: 12,
                                paddingVertical: 8,
                                borderRadius: 8,
                                backgroundColor: w === wageType ? "#2563eb" : "#f4f4f5",
                                color: w === wageType ? "#fff" : "#111",
                                overflow: "hidden",
                            }}
                        >
                            {w}
                        </Text>
                    ))}
                </View>
                <Field label="Base salary (RM)" value={baseSalary} onChange={setBaseSalary} keyboardType="decimal-pad" />
                <Field label="Hourly rate (RM)" value={hourlyRate} onChange={setHourlyRate} keyboardType="decimal-pad" />
                <Field label="Daily rate (RM)" value={dailyRate} onChange={setDailyRate} keyboardType="decimal-pad" />
            </Section>

            <Section title="Statutory">
                <Field label="EPF no." value={epfNo} onChange={setEpfNo} />
                <Field label="SOCSO no." value={socsoNo} onChange={setSocsoNo} />
                <Field label="Tax no." value={taxNo} onChange={setTaxNo} />
                <Field label="PCB category" value={pcbCategory} onChange={setPcbCategory} />
                <Field label="Dependents" value={dependents} onChange={setDependents} keyboardType="number-pad" />
            </Section>

            <Section title="Bank">
                <Field label="Bank name" value={bankName} onChange={setBankName} />
                <Field label="Account number" value={bankAccount} onChange={setBankAccount} />
            </Section>

            <Button
                title={saving ? "Saving…" : "Save changes"}
                onPress={save}
                disabled={saving}
            />
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
    <View style={{ gap: 8 }}>
        <Text style={{ fontSize: 18, fontWeight: "600" }}>{title}</Text>
        {children}
    </View>
);

const Label = ({ text }: { text: string }) => (
    <Text style={{ color: "#666", fontSize: 12 }}>{text}</Text>
);

const Field = ({
    label,
    value,
    onChange,
    keyboardType,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    keyboardType?: "default" | "number-pad" | "decimal-pad";
}) => (
    <View style={{ gap: 4 }}>
        <Label text={label} />
        <TextInput
            value={value}
            onChangeText={onChange}
            keyboardType={keyboardType ?? "default"}
            style={{ borderWidth: 1, padding: 10, borderRadius: 8 }}
        />
    </View>
);
