import {
    createContext,
    type PropsWithChildren,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../supabase";
import { registerPushToken, unregisterPushToken } from "../push/registerPushToken";

export type AppRole =
    | "promoter"
    | "area_manager"
    | "state_manager"
    | "hr_admin"
    | "super_admin";

export interface Profile {
    id: string;
    fullName: string;
    role: AppRole;
}

interface AuthState {
    session: Session | null;
    profile: Profile | null;
    loading: boolean;
    signOut: () => Promise<void>;
}

const AuthCtx = createContext<AuthState | null>(null);

export const AuthProvider = ({ children }: PropsWithChildren) => {
    const [session, setSession] = useState<Session | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;
        supabase.auth.getSession().then(({ data }) => {
            if (!active) return;
            setSession(data.session);
            setLoading(false);
        });
        const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
            if (!active) return;
            setSession(s);
        });
        return () => {
            active = false;
            sub.subscription.unsubscribe();
        };
    }, []);

    useEffect(() => {
        if (!session) {
            setProfile(null);
            return;
        }
        let active = true;
        supabase
            .from("profiles")
            .select("id, full_name, role")
            .eq("id", session.user.id)
            .single()
            .then(({ data }) => {
                if (!active || !data) return;
                setProfile({
                    id: data.id,
                    fullName: data.full_name,
                    role: data.role as AppRole,
                });
                registerPushToken().catch((e) => {
                    console.warn("push registration failed", e);
                });
            });
        return () => {
            active = false;
        };
    }, [session]);

    const value = useMemo<AuthState>(
        () => ({
            session,
            profile,
            loading,
            signOut: async () => {
                await unregisterPushToken().catch(() => undefined);
                await supabase.auth.signOut();
            },
        }),
        [session, profile, loading],
    );

    return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
};

export const useAuth = (): AuthState => {
    const ctx = useContext(AuthCtx);
    if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
    return ctx;
};

// Convenience role predicates.
export const isManager = (role: AppRole | undefined): boolean =>
    role === "area_manager" || role === "state_manager";

export const isHrAdmin = (role: AppRole | undefined): boolean =>
    role === "hr_admin" || role === "super_admin";
