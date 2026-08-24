import { ScrollView } from "react-native";
import { NotificationsList } from "@/components/player/NotificationsList";

/** Route stack inchangée (header natif via app/_layout.tsx) — contenu dans NotificationsList. */
export default function NotificationsScreen() {
  return (
    <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
      <NotificationsList />
    </ScrollView>
  );
}
