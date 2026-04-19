import { Redirect, Tabs } from "expo-router";
import { isHrAdmin, isManager, useAuth } from "../../src/auth/AuthContext";

// Role-based tab visibility:
//   Promoter         → Today, Leaderboard, Leave, Payslips, Profile
//   Area/State Mgr   → Today, Approvals, Team, Leaderboard, Profile
//   HR Admin         → bounced to admin-web (phone is not their primary surface)
//
// `href: null` hides a tab entirely for that role — the screen file still
// exists so deep-links via push notifications resolve, but it doesn't clutter
// the tab bar.

export default function TabsLayout() {
    const { session, profile, loading } = useAuth();

    if (loading) return null;
    if (!session) return <Redirect href="/(auth)/sign-in" />;

    const role = profile?.role;
    const manager = isManager(role);
    const hr = isHrAdmin(role);

    return (
        <Tabs>
            <Tabs.Screen name="today" options={{ title: "Today" }} />
            <Tabs.Screen
                name="approvals"
                options={{ title: "Approvals", href: manager ? "/approvals" : null }}
            />
            <Tabs.Screen
                name="team"
                options={{ title: "Team", href: manager ? "/team" : null }}
            />
            <Tabs.Screen
                name="leave"
                options={{ title: "Leave", href: manager ? null : "/leave" }}
            />
            <Tabs.Screen
                name="payslips"
                options={{ title: "Payslips", href: manager || hr ? null : "/payslips" }}
            />
            <Tabs.Screen name="leaderboard" options={{ title: "Leaderboard" }} />
            <Tabs.Screen name="profile" options={{ title: "Profile" }} />
        </Tabs>
    );
}
