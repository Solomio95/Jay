import { Link } from "expo-router";
import { FlatList, Text, View } from "react-native";
import { usePayslips } from "../../src/features/payslips/usePayslips";

export default function Payslips() {
    const { payslips } = usePayslips();
    return (
        <View style={{ flex: 1, padding: 16 }}>
            <Text style={{ fontSize: 24, fontWeight: "600", marginBottom: 12 }}>
                Payslips
            </Text>
            {payslips.length === 0 ? (
                <Text style={{ color: "#666" }}>No payslips yet.</Text>
            ) : (
                <FlatList
                    data={payslips}
                    keyExtractor={(p) => p.id}
                    renderItem={({ item }) => (
                        <Link
                            href={`/payslips/${item.id}`}
                            style={{
                                paddingVertical: 12,
                                borderBottomWidth: 1,
                                borderColor: "#eee",
                                textDecorationLine: "none",
                            }}
                        >
                            <View>
                                <Text style={{ fontWeight: "500" }}>
                                    {formatPeriod(item.periodMonth)}
                                </Text>
                                <Text style={{ color: "#666" }}>
                                    Net pay RM {item.netPay.toFixed(2)}
                                </Text>
                            </View>
                        </Link>
                    )}
                />
            )}
        </View>
    );
}

const formatPeriod = (isoDate: string) => {
    const [y, m] = isoDate.split("-").map(Number);
    const names = [
        "January","February","March","April","May","June",
        "July","August","September","October","November","December",
    ];
    if (!y || !m) return isoDate;
    return `${names[m - 1]} ${y}`;
};
