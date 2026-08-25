import { ScrollView, Text, View } from "react-native";
import { Card } from "@/components/ui/Card";
import { CompetitionsLink } from "@/components/competitions/CompetitionsLink";
import { TournamentsLink } from "@/components/tournaments/TournamentsLink";
import { CpcClubRanking } from "@/components/rankings/CpcClubRanking";
import { canShowLiveLeagueRanking, LEAGUE_COPY } from "@/lib/leagues";
import { useCpcClubRankingResults } from "@/lib/hooks/useRankings";

/**
 * Ligues — stack partagé (`app/_layout.tsx`), pas un onglet.
 * Mode Club n'a pas `(player)` : Effectif → `/leagues` passe par cet écran.
 *
 * Surface principale : classement clubs CPC (`match_results` + `opponent_club_id`).
 * Classement saison (`season_stats`) : vide honnête, secondaire — pas un EmptyState
 * plein écran qui masque le tableau.
 */
export default function LeaguesScreen() {
  const ranking = useCpcClubRankingResults();

  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
      keyboardShouldPersistTaps="handled"
    >
      <Card>
        <CpcClubRanking
          results={ranking.data}
          isLoading={ranking.isLoading}
          isError={ranking.isError}
          onRetry={() => ranking.refetch()}
        />
      </Card>
      {!canShowLiveLeagueRanking() ? (
        <View className="mt-4 rounded-2xl border border-dashed border-border px-4 py-3">
          <Text className="text-xs text-fg-muted">{LEAGUE_COPY.empty}</Text>
          <Text className="mt-1 text-xs text-fg-subtle">{LEAGUE_COPY.emptyHint}</Text>
        </View>
      ) : null}
      <View className="mt-4">
        <CompetitionsLink />
      </View>
      <View className="mt-2">
        <TournamentsLink />
      </View>
    </ScrollView>
  );
}
