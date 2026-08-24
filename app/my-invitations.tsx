import { ScrollView } from "react-native";
import { MyInvitationsList } from "@/components/player/MyInvitationsList";

/** Route stack inchangée (header natif via app/_layout.tsx) — contenu dans MyInvitationsList. */
export default function MyInvitationsScreen() {
  return (
    <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
      <MyInvitationsList />
    </ScrollView>
  );
}
