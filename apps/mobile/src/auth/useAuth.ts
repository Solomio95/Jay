import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../supabase";

export interface Profile {
    id: string;
    fullName: string;
    role: "promoter" | "area_manager" | "state_manager" | "hr_admin" | "super_admin";
}

export const useAuth = () => {
    const [session, setSession] = useState<Session | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => {
            setSession(data.session);
            setLoading(false);
        });
        const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
        return () => sub.subscription.unsubscribe();
    }, []);

    useEffect(() => {
        if (!session) {
            setProfile(null);
            return;
        }
        supabase
            .from("profiles")
            .select("id, full_name, role")
            .eq("id", session.user.id)
            .single()
            .then(({ data }) => {
                if (data) setProfile({ id: data.id, fullName: data.full_name, role: data.role });
            });
    }, [session]);

    return { session, profile, loading };
};
