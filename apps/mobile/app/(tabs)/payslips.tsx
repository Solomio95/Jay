import { FlatList, Linking, Text, TouchableOpacity, View } from "react-native";
import { usePayslips } from "../../src/features/payslips/usePayslips";

export default function Payslips() {
    const { payslips } = usePayslips();
    return (
        <View style={{ flex: 1, padding: 16 }}>
            <Text style={{ fontSize: 24, fontWeight: "600", marginBottom: 12 }}>Payslips</Text>
            <FlatList
                data={payslips}
                keyExtractor={(p) => p.id}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        onPress={() => item.pdfUrl && Linking.openURL(item.pdfUrl)}
                        style={{ paddingVertical: 12, borderBottomWidth: 1, borderColor: "#eee" }}
                    >
                        <Text style={{ fontWeight: "500" }}>{item.periodMonth}</Text>
                        <Text style={{ color: "#666" }}>Net pay RM {item.netPay.toFixed(2)}</Text>
                    </TouchableOpacity>
                )}
            />
        </View>
    );
}
