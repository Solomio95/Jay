import type { PropsWithChildren } from "react";
import { Text, View } from "react-native";
import { type AppRole, useAuth } from "./AuthContext";

export interface RoleGuardProps {
    allow: readonly AppRole[];
    fallbackMessage?: string;
}

// Renders `children` only when the signed-in user's role is in `allow`.
// Shows a small "not available" stub otherwise so managers don't crash into
// promoter-only screens and vice versa.
export const RoleGuard = ({
    allow,
    fallbackMessage,
    children,
}: PropsWithChildren<RoleGuardProps>) => {
    const { profile, loading } = useAuth();
    if (loading) return null;
    if (!profile || !allow.includes(profile.role)) {
        return (
            <View style={{ flex: 1, padding: 24, justifyContent: "center" }}>
                <Text style={{ fontSize: 16, color: "#666", textAlign: "center" }}>
                    {fallbackMessage ?? "This screen is not available for your role."}
                </Text>
            </View>
        );
    }
    return <>{children}</>;
};
