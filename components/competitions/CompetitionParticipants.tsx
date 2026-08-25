import { Text, View } from "react-native";
import { COMPETITION_COPY } from "@/lib/competitions";
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
        <View className="gap-1">
          {rows.map((row) => (
            <Text key={row.id} className="text-sm text-fg">
              {row.club?.name?.trim() || "Club Pro Clubs"}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}
