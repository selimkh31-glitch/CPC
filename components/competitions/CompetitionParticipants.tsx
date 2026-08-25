import { Text, View } from "react-native";
import { router } from "expo-router";
import { ClubCard } from "@/components/club/ClubCard";
import { COMPETITION_COPY } from "@/lib/competitions";
import { buildClubCardData } from "@/lib/clubCard";
import { clubRankingRowHref } from "@/lib/rankings";
import type { CompetitionClubRow } from "@/lib/types";

/** Clubs inscrits = lignes réelles `competition_clubs` + nom du club, jamais inventés. */
export function CompetitionParticipants({ clubs }: { clubs: CompetitionClubRow[] | undefined }) {
  const rows = clubs ?? [];
  return (
    <View>
      <Text className="mb-1 text-xs font-bold uppercase tracking-wide text-fg-muted">
        {COMPETITION_COPY.participantsTitle}
      </Text>
      {rows.length === 0 ? (
        <Text className="text-xs text-fg-muted">{COMPETITION_COPY.participantsEmpty}</Text>
      ) : (
        <View className="gap-1.5">
          {rows.map((row) => {
            const name = row.club?.name?.trim() || "Club Pro Clubs";
            const href = clubRankingRowHref(row.club_id, row.club?.name);
            return (
              <ClubCard
                key={row.id}
                data={buildClubCardData({ id: row.club_id, name })}
                variant="mini"
                interactive={Boolean(href)}
                onPress={href ? () => router.push(href) : undefined}
              />
            );
          })}
        </View>
      )}
    </View>
  );
}
