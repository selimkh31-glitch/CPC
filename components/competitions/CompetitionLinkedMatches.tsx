import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/Screen";
import { OutcomeBadge } from "@/components/ui/OutcomeBadge";
import {
  COMPETITION_COPY,
  competitionLinkedMatchNav,
  listCompetitionLinkedMatches,
} from "@/lib/competitions";
import { useAppMode } from "@/lib/providers/AppModeProvider";
import { rememberClubDisplayName } from "@/lib/tournaments";
import type { LinkedMatchResultRow } from "@/lib/hooks/useCompetitionResults";
import type { CompetitionRow } from "@/lib/types";

/**
 * Matchs réellement liés (`match_results.competition_id` + `opponent_club_id`).
 * Même rows que le classement. Score manquant → « Pas encore de score », jamais 0-0.
 */
export function CompetitionLinkedMatches({
  competition,
  results,
  isLoading,
  isError,
  onRetry,
  managedClubIds,
}: {
  competition: CompetitionRow;
  results: LinkedMatchResultRow[] | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  managedClubIds: readonly string[];
}) {
  const { mode, setMode, setSelectedManagedClubId } = useAppMode();
  const [pendingNav, setPendingNav] = useState<{ href: string; requireClubMode: boolean } | null>(null);

  const names = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of competition.clubs ?? []) {
      rememberClubDisplayName(map, row.club_id, row.club?.name);
    }
    for (const row of results ?? []) {
      rememberClubDisplayName(map, row.club_id, row.club?.name);
      rememberClubDisplayName(map, row.opponent_club_id, row.opponent_club?.name);
    }
    return map;
  }, [competition.clubs, results]);

  const items = useMemo(
    () => listCompetitionLinkedMatches(results ?? [], competition.id, names),
    [results, competition.id, names]
  );

  useEffect(() => {
    if (!pendingNav) return;
    if (pendingNav.requireClubMode && mode !== "CLUB") return;
    router.push(pendingNav.href as any);
    setPendingNav(null);
  }, [pendingNav, mode]);

  if (isLoading) {
    return (
      <View>
        <Text className="mb-2 text-xs font-bold uppercase tracking-wide text-fg-muted">
          {COMPETITION_COPY.linkedMatchesTitle}
        </Text>
        <Skeleton className="h-12" />
        <Skeleton className="mt-2 h-12" />
      </View>
    );
  }

  if (isError) {
    return (
      <View>
        <Text className="mb-2 text-xs font-bold uppercase tracking-wide text-fg-muted">
          {COMPETITION_COPY.linkedMatchesTitle}
        </Text>
        <ErrorState message={COMPETITION_COPY.linkedMatchesLoadError} onRetry={onRetry} />
      </View>
    );
  }

  return (
    <View>
      <Text className="mb-2 text-xs font-bold uppercase tracking-wide text-fg-muted">
        {COMPETITION_COPY.linkedMatchesTitle}
      </Text>
      {items.length === 0 ? (
        <>
          <Text className="text-xs text-fg-muted">{COMPETITION_COPY.linkedMatchesEmpty}</Text>
          <Text className="mt-0.5 text-xs text-fg-subtle">{COMPETITION_COPY.linkedMatchesEmptyHint}</Text>
        </>
      ) : (
        <View className="gap-1.5">
          {items.map((item) => {
            const nav = competitionLinkedMatchNav({
              recordingClubId: item.clubId,
              managedClubIds,
              competitionId: competition.id,
              kind: competition.kind,
            });
            const accessibility = [item.clubsLine, item.statusLabel, item.scoreLine]
              .filter(Boolean)
              .join(". ");
            return (
              <Pressable
                key={item.id}
                onPress={() => {
                  if (!nav) return;
                  Haptics.selectionAsync();
                  if (nav.requireClubMode) {
                    if (nav.selectClubId) setSelectedManagedClubId(nav.selectClubId);
                    setMode("CLUB");
                    setPendingNav({ href: nav.href, requireClubMode: true });
                    return;
                  }
                  router.push(nav.href as any);
                }}
                accessibilityRole="button"
                accessibilityLabel={accessibility}
                className="min-h-[44px] flex-row items-center justify-between gap-2 rounded-xl border border-border bg-bg-elevated px-3 py-2 active:opacity-80"
              >
                <View className="min-w-0 flex-1">
                  {item.clubsLine ? (
                    <Text numberOfLines={1} className="text-sm font-semibold text-fg">
                      {item.clubsLine}
                    </Text>
                  ) : null}
                  <Text className="text-[11px] text-fg-subtle">
                    {[item.statusLabel, item.scoreLine].filter(Boolean).join(" · ")}
                  </Text>
                </View>
                {item.outcome ? <OutcomeBadge outcome={item.outcome} /> : null}
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}
