import { Pressable, Text } from "react-native";
import { router } from "expo-router";
import { Trophy } from "lucide-react-native";
import { pushLeaguesScreen } from "@/lib/leagues";
import { RANKING_COPY } from "@/lib/rankings";

/** Lien secondaire stack `/leagues` — pas un onglet (Ligues reste `href: null`). */
export function LeaguesLink() {
  return (
    <Pressable
      onPress={() => pushLeaguesScreen(router.push)}
      accessibilityRole="button"
      accessibilityLabel={RANKING_COPY.clubTitle}
      accessibilityHint="Matchs CPC enregistrés avec un adversaire seulement"
      className="min-h-[44px] flex-row items-center justify-center gap-1.5 rounded-xl border border-border bg-bg-elevated px-3 active:opacity-80"
    >
      <Trophy size={16} color="#f4f5f7" />
      <Text className="font-bold text-fg">{RANKING_COPY.clubTitle}</Text>
    </Pressable>
  );
}
