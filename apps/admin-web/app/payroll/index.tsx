import { Text, View } from "react-native";

// Payroll run dashboard: open/previewed/approved runs, with links to:
//   - /payroll/[period]/preview       (commission + statutory breakdown per employee)
//   - /payroll/[period]/approve       (final sign-off; writes locked_at)
//   - /payroll/[period]/bank-file     (CSV/TXT export for Maybank2u etc.)
//   - /payroll/[period]/statutory     (KWSP / PERKESO / LHDN submission files)
export default function PayrollHome() {
    return (
        <View style={{ padding: 24 }}>
            <Text style={{ fontSize: 24, fontWeight: "600" }}>Payroll</Text>
            <Text style={{ color: "#666", marginTop: 8 }}>
                Wiring pending — see docs/roadmap.md
            </Text>
        </View>
    );
}
