import { Redirect } from "expo-router";
import { useAuth } from "../src/auth/useAuth";

export default function Index() {
    const { session, loading } = useAuth();
    if (loading) return null;
    return session ? <Redirect href="/(tabs)/today" /> : <Redirect href="/(auth)/sign-in" />;
}
