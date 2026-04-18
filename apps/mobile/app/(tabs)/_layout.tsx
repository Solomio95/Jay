import { Tabs } from "expo-router";

export default function TabsLayout() {
    return (
        <Tabs>
            <Tabs.Screen name="today" options={{ title: "Today" }} />
            <Tabs.Screen name="leaderboard" options={{ title: "Leaderboard" }} />
            <Tabs.Screen name="leave" options={{ title: "Leave" }} />
            <Tabs.Screen name="payslips" options={{ title: "Payslips" }} />
            <Tabs.Screen name="profile" options={{ title: "Profile" }} />
        </Tabs>
    );
}
