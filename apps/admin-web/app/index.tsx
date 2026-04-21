import { Link } from "expo-router";
import { Text, View } from "react-native";

export default function AdminHome() {
    return (
        <View style={{ flex: 1, padding: 24, gap: 16 }}>
            <Text style={{ fontSize: 28, fontWeight: "600" }}>Bentop HR Admin</Text>
            <NavLink href="/employees" label="Employees" />
            <NavLink href="/outlets" label="Outlets & counters" />
            <NavLink href="/commission-schemes" label="Commission schemes" />
            <NavLink href="/payroll" label="Payroll" />
            <NavLink href="/ea-forms" label="Form EA (annual)" />
            <NavLink href="/reports" label="Reports" />
            <NavLink href="/leaderboards" label="Leaderboards" />
            <NavLink href="/contests" label="Contests" />
            <NavLink href="/kpi-metrics" label="KPI metrics" />
            <NavLink href="/statutory-rates" label="Statutory rate tables" />
            <NavLink href="/audit-log" label="Audit log" />
        </View>
    );
}

function NavLink({ href, label }: { href: string; label: string }) {
    return (
        <Link href={href} style={{ paddingVertical: 8, color: "#2563eb", fontSize: 16 }}>
            {label}
        </Link>
    );
}
