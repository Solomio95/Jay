import { Text, View } from "react-native";

// Scheme designer: list active + draft schemes, edit rules, run "shadow
// simulation against last 3 months" to preview delta vs current scheme, and
// route activation through the second-approver flow.
export default function CommissionSchemes() {
    return (
        <View style={{ padding: 24 }}>
            <Text style={{ fontSize: 24, fontWeight: "600" }}>Commission schemes</Text>
            <Text style={{ color: "#666", marginTop: 8 }}>Scheme designer coming next.</Text>
        </View>
    );
}
