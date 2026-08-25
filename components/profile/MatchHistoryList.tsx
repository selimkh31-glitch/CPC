import { Text, View } from "react-native";
import { router } from "expo-router";
import { ErrorState } from "@/components/ui/Screen";
import { Skeleton } from "@/components/ui/Skeleton";
import { OutcomeBadge } from "@/components/ui/OutcomeBadge";
import { ClubCard } from "@/components/club/ClubCard";
import {
  MATCH_HISTORY_COPY,
  type MatchHistoryItem,
} from "@/lib/matchHistory";
import { buildClubCardData } from "@/lib/clubCard";
import { clubRankingRowHref } from "@/lib/rankings";
import { cn } from "@/lib/utils";

/**
 * Liste courte (date, club, score si réel, issue). Loading / vide / erreur.
 * Vide = copy honnête, jamais un faux 0-0.
 * Nom adverse : ClubCard MINI seulement si c'est un club hydraté.
 */
export function MatchHistoryList({
  items,
  loading = false,
  error = false,
  onRetry,
  variant = "card",
}: {
  items?: MatchHistoryItem[] | null;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  variant?: "card" | "embedded";
}) {
  const embedded = variant === "embedded";

  if (error) {
    return (
      <View className={embedded ? "mt-4" : undefined}>
        {!embedded ? (
          <Text className="mb-2 font-display text-lg text-fg">{MATCH_HISTORY_COPY.title}</Text>
        ) : (
          <Text className="mb-2 text-[11px] font-bold uppercase tracking-wide text-fg-subtle">
            {MATCH_HISTORY_COPY.title}
          </Text>
        )}
        <ErrorState message={MATCH_HISTORY_COPY.loadError} onRetry={onRetry} />
      </View>
    );
  }

  if (loading) {
    return (
      <View className={embedded ? "mt-4 gap-2" : "gap-2"}>
        <Text
          className={
            embedded
              ? "text-[11px] font-bold uppercase tracking-wide text-fg-subtle"
              : "mb-1 font-display text-lg text-fg"
          }
        >
          {MATCH_HISTORY_COPY.title}
        </Text>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </View>
    );
  }

  const rows = items ?? [];
  const empty = rows.length === 0;

  return (
    <View className={embedded ? "mt-4" : undefined}>
      <Text
        className={
          embedded
            ? "text-[11px] font-bold uppercase tracking-wide text-fg-subtle"
            : "mb-2 font-display text-lg text-fg"
        }
      >
        {MATCH_HISTORY_COPY.title}
      </Text>
      {empty ? (
        <Text className={cn("text-sm text-fg-muted", embedded && "mt-1")}>
          {MATCH_HISTORY_COPY.empty}
        </Text>
      ) : (
        <View className="mt-1 gap-1.5">
          {rows.map((row) => (
            <MatchHistoryRow key={row.id} item={row} embedded={embedded} />
          ))}
        </View>
      )}
    </View>
  );
}

function MatchHistoryRow({ item, embedded }: { item: MatchHistoryItem; embedded: boolean }) {
  const opponentName = item.opponentClubName;
  const opponentId = item.opponentClubId;
  const opponentHref =
    opponentId && opponentName ? clubRankingRowHref(opponentId, opponentName) : null;
  const meta = [item.dateLabel, item.scoreLine].filter(Boolean).join(" · ");

  return (
    <View
      className={cn(
        "min-h-[44px] flex-row items-center justify-between gap-2 rounded-xl px-2.5 py-2",
        embedded ? "bg-black/20" : "border border-border bg-bg-elevated"
      )}
    >
      <View className="min-w-0 flex-1">
        {opponentId && opponentName ? (
          <ClubCard
            data={buildClubCardData({ id: opponentId, name: opponentName })}
            variant="mini"
            interactive={Boolean(opponentHref)}
            onPress={opponentHref ? () => router.push(opponentHref) : undefined}
            className="border-0 bg-transparent px-0 py-0"
          />
        ) : (
          <Text numberOfLines={1} className="text-sm font-semibold text-fg">
            {item.clubName}
          </Text>
        )}
        {meta ? <Text className="text-[11px] text-fg-subtle">{meta}</Text> : null}
      </View>
      <OutcomeBadge outcome={item.outcome} />
    </View>
  );
}
