import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
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

interface Scheme {
    id: string;
    name: string;
    status: string;
    effective_from: string;
    effective_to: string | null;
    created_at: string;
}

interface CommissionRule {
    id: string;
    applies_to_role: string;
    rule_type: string;
    priority: number;
    config: Record<string, unknown>;
}

interface KpiRule {
    id: string;
    name: string;
    metric: string;
    applies_to_role: string;
    config: Record<string, unknown>;
}

interface ActivationRequest {
    id: string;
    status: string;
    requested_by: string;
    requested_at: string;
    approved_by: string | null;
    approved_at: string | null;
    simulation: SimulationPayload;
}

interface SimulationPayload {
    scheme_id: string;
    simulated_at: string;
    months: {
        period: string;
        employees: {
            employee_id: string;
            basis: number;
            old_commission: number;
            new_commission: number;
            delta: number;
        }[];
        totals: { old: number; new: number; employees: number };
    }[];
    summary: {
        old_total: number;
        new_total: number;
        delta: number;
        delta_pct: number | null;
        employee_months: number;
    };
    scope_note: string;
}

export default function CommissionSchemeDetail() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const [scheme, setScheme] = useState<Scheme | null>(null);
    const [rules, setRules] = useState<CommissionRule[]>([]);
    const [kpis, setKpis] = useState<KpiRule[]>([]);
    const [request, setRequest] = useState<ActivationRequest | null>(null);
    const [preview, setPreview] = useState<SimulationPayload | null>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [rejectReason, setRejectReason] = useState("");

    const load = useCallback(async () => {
        if (!id) return;
        setLoading(true);
        const [s, r, k, req, u] = await Promise.all([
            supabase
                .from("commission_schemes")
                .select("id, name, status, effective_from, effective_to, created_at")
                .eq("id", id)
                .single(),
            supabase
                .from("commission_rules")
                .select("id, applies_to_role, rule_type, priority, config")
                .eq("scheme_id", id)
                .order("priority"),
            supabase
                .from("kpi_rules")
                .select("id, name, metric, applies_to_role, config")
                .eq("scheme_id", id)
                .order("name"),
            supabase
                .from("scheme_activation_requests")
                .select("id, status, requested_by, requested_at, approved_by, approved_at, simulation")
                .eq("scheme_id", id)
                .order("requested_at", { ascending: false })
                .limit(1)
                .maybeSingle(),
            supabase.auth.getUser(),
        ]);
        setScheme(s.data as Scheme | null);
        setRules((r.data ?? []) as CommissionRule[]);
        setKpis((k.data ?? []) as KpiRule[]);
        setRequest((req.data ?? null) as ActivationRequest | null);
        setCurrentUserId(u.data.user?.id ?? null);
        setLoading(false);
    }, [id]);

    useEffect(() => {
        void load();
    }, [load]);

    const runPreview = async () => {
        if (!id) return;
        setBusy(true);
        const { data, error } = await supabase.rpc("simulate_scheme_activation", {
            p_scheme_id: id,
        });
        setBusy(false);
        if (error) {
            Alert.alert("Simulation failed", error.message);
            return;
        }
        setPreview(data as SimulationPayload);
    };

    const requestActivation = async () => {
        if (!id) return;
        setBusy(true);
        const { error } = await supabase.rpc("request_scheme_activation", {
            p_scheme_id: id,
        });
        setBusy(false);
        if (error) {
            Alert.alert("Request failed", error.message);
            return;
        }
        await load();
    };

    const approve = async () => {
        if (!request) return;
        setBusy(true);
        const { error } = await supabase.rpc("activate_scheme", {
            p_request_id: request.id,
        });
        setBusy(false);
        if (error) {
            Alert.alert("Activation failed", error.message);
            return;
        }
        await load();
    };

    const reject = async () => {
        if (!request || !rejectReason) {
            Alert.alert("Reason required", "Add a rejection reason first.");
            return;
        }
        setBusy(true);
        const { error } = await supabase.rpc("reject_scheme_activation", {
            p_request_id: request.id,
            p_reason: rejectReason,
        });
        setBusy(false);
        if (error) {
            Alert.alert("Rejection failed", error.message);
            return;
        }
        setRejectReason("");
        await load();
    };

    if (loading || !scheme) {
        return (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                <ActivityIndicator />
            </View>
        );
    }

    const pending =
        request && request.status === "pending" ? request : null;
    const canApprove =
        pending !== null && currentUserId !== null && pending.requested_by !== currentUserId;

    return (
        <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <Button title="← Back" onPress={() => router.back()} />
                <Text style={{ fontSize: 24, fontWeight: "600" }}>{scheme.name}</Text>
            </View>
            <Text style={{ color: "#666" }}>
                {scheme.status} · effective {scheme.effective_from}
                {scheme.effective_to ? ` - ${scheme.effective_to}` : " (no end)"}
            </Text>

            {scheme.status === "draft" ? (
                <View
                    style={{
                        padding: 16,
                        backgroundColor: "#fef9c3",
                        borderRadius: 8,
                        gap: 10,
                    }}
                >
                    <Text style={{ fontWeight: "600" }}>Activation workflow</Text>
                    {!pending ? (
                        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                            <Button title="Preview simulation" onPress={runPreview} disabled={busy} />
                            <Button
                                title="Request activation"
                                onPress={requestActivation}
                                disabled={busy}
                            />
                        </View>
                    ) : (
                        <>
                            <Text>
                                Pending request by {pending.requested_by.slice(0, 8)}… on{" "}
                                {pending.requested_at.slice(0, 10)}.
                            </Text>
                            {canApprove ? (
                                <View style={{ flexDirection: "row", gap: 8 }}>
                                    <Button title="Approve & activate" onPress={approve} disabled={busy} />
                                </View>
                            ) : (
                                <Text style={{ color: "#92400e" }}>
                                    A second HR/admin (not the requester) must approve to activate.
                                </Text>
                            )}
                            <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                                <TextInput
                                    value={rejectReason}
                                    onChangeText={setRejectReason}
                                    placeholder="Reason to reject…"
                                    style={{
                                        borderWidth: 1,
                                        borderColor: "#d4d4d8",
                                        padding: 8,
                                        borderRadius: 6,
                                        flex: 1,
                                    }}
                                />
                                <Button
                                    title="Reject"
                                    onPress={reject}
                                    disabled={busy}
                                    color="#b91c1c"
                                />
                            </View>
                        </>
                    )}
                </View>
            ) : null}

            {(preview ?? pending?.simulation) ? (
                <SimulationView sim={preview ?? pending!.simulation} />
            ) : null}

            <Text style={{ fontSize: 18, fontWeight: "600", marginTop: 8 }}>
                Commission rules ({rules.length})
            </Text>
            {rules.length === 0 ? (
                <Text style={{ color: "#666" }}>No rules.</Text>
            ) : (
                rules.map((r) => <RuleCard key={r.id} rule={r} />)
            )}

            <Text style={{ fontSize: 18, fontWeight: "600", marginTop: 16 }}>
                KPI rules ({kpis.length})
            </Text>
            {kpis.length === 0 ? (
                <Text style={{ color: "#666" }}>No KPI rules.</Text>
            ) : (
                kpis.map((k) => <KpiCard key={k.id} kpi={k} />)
            )}
        </ScrollView>
    );
}

const SimulationView = ({ sim }: { sim: SimulationPayload }) => {
    const s = sim.summary;
    const delta = Number(s.delta);
    const color = delta > 0 ? "#b45309" : delta < 0 ? "#059669" : "#374151";
    return (
        <View
            style={{
                padding: 16,
                borderWidth: 1,
                borderColor: "#e4e4e7",
                borderRadius: 8,
                gap: 8,
            }}
        >
            <Text style={{ fontWeight: "600" }}>
                Simulation vs last {sim.months.length} run(s)
            </Text>
            <Text style={{ color: "#666", fontSize: 12 }}>{sim.scope_note}</Text>
            <View style={{ flexDirection: "row", gap: 16, marginTop: 4 }}>
                <Stat label="Actual paid" value={`RM ${Number(s.old_total).toFixed(2)}`} />
                <Stat label="Would have paid" value={`RM ${Number(s.new_total).toFixed(2)}`} />
                <Stat
                    label="Delta"
                    value={`${delta >= 0 ? "+" : ""}RM ${delta.toFixed(2)}${
                        s.delta_pct !== null ? ` (${s.delta_pct >= 0 ? "+" : ""}${s.delta_pct}%)` : ""
                    }`}
                    color={color}
                />
            </View>
            {sim.months.map((m) => (
                <View
                    key={m.period}
                    style={{ paddingVertical: 6, borderTopWidth: 1, borderColor: "#eee" }}
                >
                    <Text style={{ fontWeight: "500" }}>
                        {m.period} · {m.totals.employees} employees
                    </Text>
                    <Text style={{ color: "#666", fontSize: 12 }}>
                        Old RM {Number(m.totals.old).toFixed(2)} · New RM{" "}
                        {Number(m.totals.new).toFixed(2)}
                    </Text>
                </View>
            ))}
        </View>
    );
};

const Stat = ({
    label,
    value,
    color,
}: {
    label: string;
    value: string;
    color?: string;
}) => (
    <View style={{ flex: 1 }}>
        <Text style={{ color: "#666", fontSize: 12 }}>{label}</Text>
        <Text style={{ fontSize: 18, fontWeight: "600", color: color ?? "#111" }}>
            {value}
        </Text>
    </View>
);

const RuleCard = ({ rule }: { rule: CommissionRule }) => (
    <View
        style={{
            padding: 12,
            backgroundColor: "#f4f4f5",
            borderRadius: 8,
            gap: 6,
        }}
    >
        <Text style={{ fontWeight: "500" }}>
            {rule.rule_type} · {rule.applies_to_role}
        </Text>
        <Text style={{ color: "#666", fontSize: 12 }}>priority {rule.priority}</Text>
        <ConfigJson config={rule.config} />
    </View>
);

const KpiCard = ({ kpi }: { kpi: KpiRule }) => (
    <View
        style={{
            padding: 12,
            backgroundColor: "#f4f4f5",
            borderRadius: 8,
            gap: 6,
        }}
    >
        <Text style={{ fontWeight: "500" }}>{kpi.name}</Text>
        <Text style={{ color: "#666", fontSize: 12 }}>
            {kpi.metric} · {kpi.applies_to_role}
        </Text>
        <ConfigJson config={kpi.config} />
    </View>
);

const ConfigJson = ({ config }: { config: Record<string, unknown> }) => (
    <Text
        style={{
            fontFamily: "monospace" as const,
            fontSize: 12,
            color: "#444",
            backgroundColor: "#fff",
            padding: 8,
            borderRadius: 4,
        }}
    >
        {JSON.stringify(config, null, 2)}
    </Text>
);
