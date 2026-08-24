import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Trophy } from "lucide-react-native";
import { EmptyState } from "@/components/ui/Screen";
import { CompetitionsLink } from "@/components/competitions/CompetitionsLink";
import { LEAGUE_COPY } from "@/lib/leagues";

/**
 * Ligues — hors tab bar (`href: LEAGUES_TAB_HREF` = null), deep link `/leagues`.
 * Pas de Classement général : `season_stats` n'est pas agrégé depuis
 * `match_results` (`canShowLiveLeagueRanking()` est false).
 */
export default function LeaguesScreen() {
  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
        <View className="mb-4 flex-row items-center gap-2">
          <Trophy size={22} color="#39ff8a" />
          <Text className="font-display text-3xl text-fg">{LEAGUE_COPY.title}</Text>
        </View>
        <EmptyState title={LEAGUE_COPY.empty} subtitle={LEAGUE_COPY.emptyHint} />
        <View className="mt-4">
          <CompetitionsLink />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
