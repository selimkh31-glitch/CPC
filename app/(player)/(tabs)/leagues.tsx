import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Trophy } from "lucide-react-native";
import { EmptyState } from "@/components/ui/Screen";
import { Card } from "@/components/ui/Card";
import { CompetitionsLink } from "@/components/competitions/CompetitionsLink";
import { TournamentsLink } from "@/components/tournaments/TournamentsLink";
import { CpcClubRanking } from "@/components/rankings/CpcClubRanking";
import { LEAGUE_COPY } from "@/lib/leagues";
import { useCpcClubRankingResults } from "@/lib/hooks/useRankings";

/**
 * Ligues — hors tab bar (`href: LEAGUES_TAB_HREF` = null), deep link `/leagues`.
 * Classement saison (`season_stats`) : vide honnête.
 * Classement clubs CPC : `match_results` avec `opponent_club_id` seulement.
 */
export default function LeaguesScreen() {
  const ranking = useCpcClubRankingResults();

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
        <View className="mb-4 flex-row items-center gap-2">
          <Trophy size={22} color="#39ff8a" />
          <Text className="font-display text-3xl text-fg">{LEAGUE_COPY.title}</Text>
        </View>
        <EmptyState title={LEAGUE_COPY.empty} subtitle={LEAGUE_COPY.emptyHint} />
        <Card className="mt-4">
          <CpcClubRanking
            results={ranking.data}
            isLoading={ranking.isLoading}
            isError={ranking.isError}
            onRetry={() => ranking.refetch()}
          />
        </Card>
        <View className="mt-4">
          <CompetitionsLink />
        </View>
        <View className="mt-2">
          <TournamentsLink />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
