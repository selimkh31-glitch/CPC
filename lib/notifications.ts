import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { supabase } from "@/lib/supabase/client";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/**
 * Demande la permission notifications, récupère le push token Expo et le
 * sauvegarde sur le profil (`users.push_token`) pour les notifs candidatures/
 * réponses/sessions live (section 8 / 11).
 */
export async function registerForPushNotificationsAsync(userId: string): Promise<string | null> {
  if (!Device.isDevice) {
    console.warn("[notifications] Les push ne fonctionnent que sur device réel (pas simulateur/émulateur).");
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") return null;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: "#39ff8a",
    });
  }

  const tokenResponse = await Notifications.getExpoPushTokenAsync();
  const token = tokenResponse.data;

  await supabase.from("users").update({ push_token: token }).eq("id", userId);

  return token;
}
