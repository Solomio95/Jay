import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Button,
    ScrollView,
    Text,
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

export default function CommissionSchemeDetail() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const [scheme, setScheme] = useState<Scheme | null>(null);
    const [rules, setRules] = useState<CommissionRule[]>([]);
    const [kpis, setKpis] = useState<KpiRule[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!id) return;
        let active = true;
        (async () => {
            const [s, r, k] = await Promise.all([
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
            ]);
            if (!active) return;
            setScheme(s.data as Scheme | null);
            setRules((r.data ?? []) as CommissionRule[]);
            setKpis((k.data ?? []) as KpiRule[]);
            setLoading(false);
        })();
        return () => {
            active = false;
        };
    }, [id]);

    if (loading || !scheme) {
        return (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                <ActivityIndicator />
            </View>
        );
    }

    return (
        <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <Button title="← Back" onPress={() => router.back()} />
                <Text style={{ fontSize: 24, fontWeight: "600" }}>{scheme.name}</Text>
            </View>
            <Text style={{ color: "#666" }}>
                {scheme.status} · effective {scheme.effective_from}
                {scheme.effective_to ? ` → ${scheme.effective_to}` : " (no end)"}
            </Text>

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
