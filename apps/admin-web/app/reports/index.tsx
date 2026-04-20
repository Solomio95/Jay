import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Text,
    View,
} from "react-native";
import { supabase } from "../../src/supabase";

interface MonthlyRow {
    period: string;
    net_sales: number;
    tx_count: number;
}

// Lightweight reports landing page. Runs a couple of aggregate queries for
// quick insight; deeper drill-downs live in per-entity admin screens. All
// aggregations respect RLS so managers only see what their policies allow.
export default function Reports() {
    const [sales, setSales] = useState<MonthlyRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [headcount, setHeadcount] = useState<number | null>(null);
    const [pendingLeave, setPendingLeave] = useState<number | null>(null);

    useEffect(() => {
        let active = true;
        (async () => {
            const [headcountRes, pendingRes, salesRes] = await Promise.all([
                supabase
                    .from("profiles")
                    .select("id", { count: "exact", head: true })
                    .eq("status", "active"),
                supabase
                    .from("leave_requests")
                    .select("id", { count: "exact", head: true })
                    .eq("status", "pending"),
                supabase
                    .from("sales_records")
                    .select("sale_date, net_amount")
                    .is("superseded_by", null)
                    .gte(
                        "sale_date",
                        monthsBack(6),
                    )
                    .order("sale_date"),
            ]);
            if (!active) return;
            setHeadcount(headcountRes.count ?? 0);
            setPendingLeave(pendingRes.count ?? 0);
            setSales(rollupByMonth(salesRes.data ?? []));
            setLoading(false);
        })();
        return () => {
            active = false;
        };
    }, []);

    if (loading) {
        return (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                <ActivityIndicator />
            </View>
        );
    }

    return (
        <View style={{ flex: 1, padding: 24, gap: 16 }}>
            <Text style={{ fontSize: 28, fontWeight: "600" }}>Reports</Text>

            <View style={{ flexDirection: "row", gap: 12 }}>
                <Tile label="Active headcount" value={String(headcount ?? 0)} />
                <Tile label="Leave requests pending" value={String(pendingLeave ?? 0)} />
            </View>

            <Text style={{ fontSize: 18, fontWeight: "600", marginTop: 8 }}>
                Net sales, last 6 months
            </Text>
            {sales.length === 0 ? (
                <Text style={{ color: "#666" }}>
                    No sales in the window yet — trigger an ERP sync.
                </Text>
            ) : (
                <FlatList
                    data={sales}
                    keyExtractor={(r) => r.period}
                    ItemSeparatorComponent={() => (
                        <View style={{ height: 1, backgroundColor: "#eee" }} />
                    )}
                    renderItem={({ item }) => <SalesRow row={item} />}
                />
            )}
        </View>
    );
}

const Tile = ({ label, value }: { label: string; value: string }) => (
    <View
        style={{
            flex: 1,
            padding: 16,
            borderRadius: 8,
            backgroundColor: "#f4f4f5",
        }}
    >
        <Text style={{ color: "#666", fontSize: 12 }}>{label}</Text>
        <Text style={{ fontSize: 24, fontWeight: "600" }}>{value}</Text>
    </View>
);

const SalesRow = ({ row }: { row: MonthlyRow }) => (
    <View
        style={{
            flexDirection: "row",
            justifyContent: "space-between",
            paddingVertical: 10,
        }}
    >
        <Text>{formatPeriod(row.period)}</Text>
        <Text>
            RM{" "}
            {row.net_sales.toLocaleString("en-MY", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            })}{" "}
            · {row.tx_count} tx
        </Text>
    </View>
);

const monthsBack = (n: number): string => {
    const d = new Date();
    d.setMonth(d.getMonth() - n);
    d.setDate(1);
    return d.toISOString().slice(0, 10);
};

const rollupByMonth = (
    rows: Array<{ sale_date: string; net_amount: number | string }>,
): MonthlyRow[] => {
    const by = new Map<string, { net: number; count: number }>();
    for (const r of rows) {
        const key = r.sale_date.slice(0, 7) + "-01";
        const bucket = by.get(key) ?? { net: 0, count: 0 };
        bucket.net += Number(r.net_amount ?? 0);
        bucket.count += 1;
        by.set(key, bucket);
    }
    return Array.from(by.entries())
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([period, b]) => ({
            period,
            net_sales: b.net,
            tx_count: b.count,
        }));
};

const formatPeriod = (isoDate: string) => {
    const [y, m] = isoDate.split("-").map(Number);
    const names = [
        "January","February","March","April","May","June",
        "July","August","September","October","November","December",
    ];
    if (!y || !m) return isoDate;
    return `${names[m - 1]} ${y}`;
};
