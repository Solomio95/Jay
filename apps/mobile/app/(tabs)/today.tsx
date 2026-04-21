import { Link } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { useAnnouncements } from "../../src/features/announcements/useAnnouncements";
import {
    useActiveContests,
    useContestStandings,
} from "../../src/features/contests/useActiveContests";
import { useTodayStats } from "../../src/features/today/useTodayStats";

export default function Today() {
    const { loading, data } = useTodayStats();
    const contests = useActiveContests();
    const announcements = useAnnouncements();

    return (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
            <Text style={{ fontSize: 24, fontWeight: "600" }}>Today</Text>
            {announcements.length > 0 ? (
                <View style={{ gap: 8 }}>
                    {announcements.map((a) => (
                        <View
                            key={a.id}
                            style={{
                                padding: 12,
                                borderRadius: 12,
                                backgroundColor: "#dbeafe",
                                borderLeftWidth: 4,
                                borderLeftColor: "#2563eb",
                            }}
                        >
                            <Text style={{ fontWeight: "600" }}>{a.title}</Text>
                            <Text style={{ marginTop: 2 }}>{a.body}</Text>
                        </View>
                    ))}
                </View>
            ) : null}
            {loading ? (
                <Text>Loading…</Text>
            ) : (
                <>
                    <Card
                        label="Today's sales"
                        value={`RM ${data?.salesToday.toFixed(2) ?? "—"}`}
                    />
                    <Card
                        label="This month"
                        value={`RM ${data?.salesMonth.toFixed(2) ?? "—"}`}
                    />
                    <Card
                        label="Commission-to-date"
                        value={`RM ${data?.commissionMtd.toFixed(2) ?? "—"}`}
                    />
                    <Card
                        label="Attendance rate"
                        value={`${((data?.attendance ?? 0) * 100).toFixed(1)}%`}
                    />
                </>
            )}

            {contests.length > 0 ? (
                <View style={{ gap: 8, marginTop: 8 }}>
                    <Text style={{ fontWeight: "600" }}>Active contests</Text>
                    {contests.map((c) => (
                        <ContestStrip key={c.id} contestId={c.id} />
                    ))}
                </View>
            ) : null}

            <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
                <Link
                    href="/leave/new"
                    style={{ color: "#2563eb", paddingVertical: 8 }}
                >
                    + Request leave
                </Link>
                <Link
                    href="/ot/new"
                    style={{ color: "#2563eb", paddingVertical: 8 }}
                >
                    + Log OT
                </Link>
            </View>
        </ScrollView>
    );
}

function ContestStrip({ contestId }: { contestId: string }) {
    const standings = useContestStandings(contestId);
    if (!standings) return null;
    const { contest, total, me, entries } = standings;
    const leader = entries[0];
    return (
        <View
            style={{
                padding: 14,
                borderRadius: 12,
                backgroundColor: "#fef3c7",
                gap: 4,
            }}
        >
            <Text style={{ fontWeight: "600" }}>{contest.name}</Text>
            <Text style={{ fontSize: 12, color: "#6b5a17" }}>
                {contest.period_start} - {contest.period_end}
                {contest.prize?.amount_rm
                    ? ` · prize RM ${contest.prize.amount_rm}`
                    : ""}
            </Text>
            <Text style={{ marginTop: 4 }}>
                {me.rank
                    ? `You: #${me.rank} of ${total} · RM ${Number(me.value).toFixed(0)}`
                    : `${total} participants so far`}
            </Text>
            {leader ? (
                <Text style={{ fontSize: 12, color: "#6b5a17" }}>
                    Leader: {leader.name} · RM {Number(leader.value).toFixed(0)}
                </Text>
            ) : null}
        </View>
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
