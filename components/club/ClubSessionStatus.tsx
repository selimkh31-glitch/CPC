import { Text, View } from "react-native";
import { PulseDot } from "@/components/ui/PulseDot";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/Screen";
import { LiveCountdown } from "@/components/live/LiveCountdown";
import {
  formatNeededPositionsLine,
  liveRecruitmentTitle,
  matchSheetTitle,
  type ClubSessionSnapshot,
} from "@/lib/sessionState";

/**
 * État session club lu sur les champs réels : LIVE (is_live + expires_at)
 * vs match lancé (match_checkins sans résultat). Pas d'enum OPEN/FULL.
 */
export function ClubSessionStatus({
  snapshot,
  checkinLoading = false,
  checkinError = false,
  onRetryCheckin,
  matchSheetCta,
}: {
  snapshot: ClubSessionSnapshot;
  checkinLoading?: boolean;
  checkinError?: boolean;
  onRetryCheckin?: () => void;
  matchSheetCta?: { label: string; onPress: () => void };
}) {
  const needed = snapshot.live.active ? formatNeededPositionsLine(snapshot.live.neededPositions) : null;

  return (
    <View className="gap-3 rounded-2xl border border-border bg-bg-card p-4">
      <View className="gap-1">
        <View className="flex-row items-center gap-2">
          {snapshot.live.active ? <PulseDot /> : null}
          <Text className={`text-sm font-extrabold uppercase tracking-wide ${snapshot.live.active ? "text-accent" : "text-fg-muted"}`}>
            {liveRecruitmentTitle(snapshot.live)}
          </Text>
          {snapshot.live.active ? <LiveCountdown expiresAt={snapshot.live.expiresAt} /> : null}
        </View>
        {snapshot.live.active ? (
          <>
            {needed ? <Text className="text-sm text-fg">Cherche {needed}</Text> : null}
            {snapshot.live.note ? <Text className="text-sm text-fg-muted">{snapshot.live.note}</Text> : null}
            <Text className="text-xs text-fg-subtle">Visible dans le feed EA SPORTS FC 27 Pro Clubs.</Text>
          </>
        ) : (
          <Text className="text-sm text-fg-subtle">Aucun recrutement LIVE (flag + durée d&apos;expiry).</Text>
        )}
      </View>

      <View className="h-px bg-border" />

      {checkinError ? (
        <ErrorState message="Impossible de lire l'état du match." onRetry={onRetryCheckin} />
      ) : checkinLoading ? (
        <Skeleton className="h-10" />
      ) : (
        <View className="gap-1">
          <Text
            className={`text-sm font-extrabold uppercase tracking-wide ${snapshot.match.active ? "text-fg" : "text-fg-muted"}`}
          >
            {matchSheetTitle(snapshot.match)}
          </Text>
          {snapshot.match.active ? (
            <Text className="text-xs text-fg-subtle">Check-in actif — la feuille de match porte l&apos;effectif et le résultat.</Text>
          ) : (
            <Text className="text-xs text-fg-subtle">Aucun check-in en cours. Lancer un match se fait depuis la feuille.</Text>
          )}
        </View>
      )}

      {matchSheetCta ? (
        <Button variant={snapshot.match.active ? "primary" : "secondary"} onPress={matchSheetCta.onPress}>
          {matchSheetCta.label}
        </Button>
      ) : null}
    </View>
  );
}
