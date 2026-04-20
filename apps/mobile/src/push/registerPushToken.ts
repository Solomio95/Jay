// Ask for permission, grab the Expo push token, and hand it to the
// `register_push_token` RPC. Safe to call on every sign-in — the RPC is
// idempotent and we cache the last-registered token so we no-op on repeats.
//
// Web returns no token (Expo uses browser Push which needs a VAPID key we
// don't own yet); we silently skip in that case.

import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { supabase } from "../supabase";

// Show the banner even when the app is in the foreground; approvals
// and payroll notifications are worth interrupting for.
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
});

let lastRegistered: string | null = null;

export const registerPushToken = async (): Promise<string | null> => {
    if (Platform.OS === "web") return null;

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== "granted") {
        const asked = await Notifications.requestPermissionsAsync();
        status = asked.status;
    }
    if (status !== "granted") return null;

    const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ??
        Constants.easConfig?.projectId;
    if (!projectId) {
        console.warn("registerPushToken: no EAS projectId — skipping");
        return null;
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (!token) return null;
    if (token === lastRegistered) return token;

    const { error } = await supabase.rpc("register_push_token", {
        p_token: token,
        p_platform: Platform.OS === "ios" ? "ios" : "android",
    });
    if (error) {
        console.warn("register_push_token failed", error.message);
        return null;
    }
    lastRegistered = token;
    return token;
};

export const unregisterPushToken = async (): Promise<void> => {
    if (!lastRegistered) return;
    await supabase.rpc("unregister_push_token", { p_token: lastRegistered });
    lastRegistered = null;
};
