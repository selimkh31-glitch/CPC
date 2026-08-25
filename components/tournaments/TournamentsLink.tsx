import { Pressable, Text } from "react-native";
import { router } from "expo-router";
import { Trophy } from "lucide-react-native";

/** Lien secondaire stack `/tournaments` — pas un onglet (Ligues reste `href: null`). */
export function TournamentsLink() {
  return (
    <Pressable
      onPress={() => router.push("/tournaments")}
      accessibilityRole="button"
      accessibilityLabel="Tournois"
      className="min-h-[44px] flex-row items-center justify-center gap-1.5 rounded-xl border border-border bg-bg-elevated px-3 active:opacity-80"
    >
      <Trophy size={16} color="#f4f5f7" />
      <Text className="font-bold text-fg">Tournois</Text>
    </Pressable>
  );
}
