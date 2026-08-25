import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Check } from "lucide-react-native";
import { Input, Label } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/Screen";
import { CLUB_NAME_SEARCH_MIN, useClubNameSearch } from "@/lib/hooks/useClubNameSearch";
import { useClubOpenCompetitions } from "@/lib/hooks/useCompetitionResults";
import { COMPETITION_COPY } from "@/lib/competitions";
import { FINALIZE_MATCH_COPY } from "@/lib/finalizeMatch";
import { TOURNAMENT_COPY } from "@/lib/tournaments";
import type { ClubRow, CompetitionRow } from "@/lib/types";

export function OpponentClubPicker({
  clubId,
  selected,
  onSelect,
}: {
  clubId: string;
  selected: Pick<ClubRow, "id" | "name"> | null;
  onSelect: (club: Pick<ClubRow, "id" | "name"> | null) => void;
}) {
  const [query, setQuery] = useState("");
  const search = useClubNameSearch(query, clubId);
  const tooShort = query.trim().length < CLUB_NAME_SEARCH_MIN;

  return (
    <View>
      <Label>{COMPETITION_COPY.opponentLabel}</Label>
      {selected ? (
        <Pressable
          onPress={() => onSelect(null)}
          accessibilityRole="button"
          accessibilityLabel={`Retirer ${selected.name}`}
          className="min-h-[44px] flex-row items-center justify-between rounded-xl border border-accent bg-accent/15 px-3"
        >
          <Text className="font-semibold text-accent">{selected.name}</Text>
          <Text className="text-xs text-fg-muted">Changer</Text>
        </Pressable>
      ) : (
        <>
          <Input
            value={query}
            onChangeText={setQuery}
            placeholder={COMPETITION_COPY.opponentSearchPlaceholder}
            autoCorrect={false}
            autoCapitalize="none"
            accessibilityLabel={COMPETITION_COPY.opponentLabel}
          />
          <Text className="mt-1 text-xs text-fg-subtle">{COMPETITION_COPY.opponentHint}</Text>
          {tooShort ? null : search.isLoading ? (
            <Skeleton className="mt-2 h-10" />
          ) : search.isError ? (
            <View className="mt-2">
              <ErrorState message={COMPETITION_COPY.opponentLoadError} onRetry={() => search.refetch()} />
            </View>
          ) : (search.data ?? []).length === 0 ? (
            <Text className="mt-2 text-sm text-fg-muted">{COMPETITION_COPY.opponentEmpty}</Text>
          ) : (
            <View className="mt-2 gap-1">
              {(search.data ?? []).map((club) => (
                <Pressable
                  key={club.id}
                  onPress={() => {
                    onSelect({ id: club.id, name: club.name });
                    setQuery("");
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={club.name}
                  className="min-h-[44px] justify-center rounded-xl bg-bg-elevated px-3"
                >
                  <Text className="font-semibold text-fg">{club.name}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </>
      )}
    </View>
  );
}

export function OptionalCompetitionPicker({
  clubId,
  opponentClubId,
  selectedId,
  onSelect,
}: {
  clubId: string;
  opponentClubId: string | null;
  selectedId: string | null;
  onSelect: (competitionId: string | null) => void;
}) {
  const { data, isLoading, isError, refetch } = useClubOpenCompetitions(
    opponentClubId ? clubId : null,
    opponentClubId
  );
  const competitions = data ?? [];

  useEffect(() => {
    if (!opponentClubId) {
      if (selectedId) onSelect(null);
      return;
    }
    if (isLoading || isError || !data) return;
    if (selectedId && !data.some((c) => c.id === selectedId)) {
      onSelect(null);
    }
  }, [isLoading, isError, selectedId, data, onSelect, opponentClubId]);

  return (
    <View>
      <Label>{COMPETITION_COPY.competitionOptionalLabel}</Label>
      {!opponentClubId ? (
        <Text className="text-sm text-fg-muted">{FINALIZE_MATCH_COPY.competitionNeedOpponent}</Text>
      ) : isLoading ? (
        <Skeleton className="h-10" />
      ) : isError ? (
        <ErrorState message={COMPETITION_COPY.competitionLoadError} onRetry={() => refetch()} />
      ) : competitions.length === 0 ? (
        <Text className="text-sm text-fg-muted">
          {opponentClubId ? COMPETITION_COPY.competitionEmptyShared : COMPETITION_COPY.competitionEmpty}
        </Text>
      ) : (
        <View className="gap-1">
          <CompetitionChoice
            label={COMPETITION_COPY.competitionNone}
            selected={selectedId === null}
            onPress={() => onSelect(null)}
          />
          {competitions.map((competition: CompetitionRow) => (
            <CompetitionChoice
              key={competition.id}
              label={
                competition.kind === "TOURNAMENT"
                  ? `${competition.name} · ${TOURNAMENT_COPY.kindLabel}`
                  : competition.name
              }
              selected={selectedId === competition.id}
              onPress={() => onSelect(competition.id)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function CompetitionChoice({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      className={`min-h-[44px] flex-row items-center justify-between rounded-xl px-3 ${
        selected ? "bg-accent/15" : "bg-bg-elevated"
      }`}
    >
      <Text className={`font-semibold ${selected ? "text-accent" : "text-fg"}`}>{label}</Text>
      {selected ? <Check size={18} color="#39ff8a" /> : null}
    </Pressable>
  );
}
