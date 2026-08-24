import { ScrollView } from "react-native";
import { MyApplicationsList } from "@/components/player/MyApplicationsList";

/** Route stack inchangée (header natif via app/_layout.tsx) — contenu dans MyApplicationsList. */
export default function MyApplicationsScreen() {
  return (
    <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
      <MyApplicationsList />
    </ScrollView>
  );
}
