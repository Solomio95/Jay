import { FlatList, Text, View } from "react-native";
import { useLeaderboard } from "../../src/features/leaderboard/useLeaderboard";

export default function Leaderboard() {
    const { entries } = useLeaderboard("national");
    return (
        <View style={{ flex: 1, padding: 16 }}>
            <Text style={{ fontSize: 24, fontWeight: "600", marginBottom: 12 }}>
                National leaderboard
            </Text>
            <FlatList
                data={entries}
                keyExtractor={(e) => e.employeeId}
                renderItem={({ item, index }) => (
                    <View style={{ flexDirection: "row", paddingVertical: 8, gap: 12 }}>
                        <Text style={{ width: 24 }}>{index + 1}</Text>
                        <Text style={{ flex: 1 }}>{item.name}</Text>
                        <Text>RM {item.value.toFixed(0)}</Text>
                    </View>
                )}
            />
        </View>
    );
}
