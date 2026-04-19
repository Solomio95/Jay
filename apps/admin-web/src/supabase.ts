import { createClient } from "@supabase/supabase-js";

// Web-only admin client. The Expo app.json `extra` block is exposed via
// process.env.EXPO_PUBLIC_* at build time; we fall back to obvious
// placeholders so the app boots locally without throwing.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "http://localhost:54321";
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "public-anon-key";

export const supabase = createClient(url, anonKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
    },
});
