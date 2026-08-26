import { useState, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { Avatar } from "@/components/ui/Avatar";
import { ClubProCard } from "@/components/profile/ClubProCard";
import { MatchHistoryList } from "@/components/profile/MatchHistoryList";
import { careerTilesCaption, resolveCareerTiles, type CareerTile } from "@/lib/profileCareer";
import { PLAYER_CARD_COPY } from "@/lib/playerCard";
import { computeOvr, OVR_CPC_LABEL } from "@/lib/ovr";
import { PLATFORM_LABELS, PLAY_STYLE_LABELS, POSITIONS } from "@/lib/constants";
import type { UserRow } from "@/lib/types";
import type { MatchHistoryItem } from "@/lib/matchHistory";
import { cn } from "@/lib/utils";

type ProfileTab = "overview" | "history" | "reviews";

const TABS: { key: ProfileTab; label: string }[] = [
  { key: "overview", label: "Aperçu" },
  { key: "history", label: "Historique" },
  { key: "reviews", label: "Avis" },
];

/**
 * Profil joueur — densité type page FIFA (layout only).
 * Card FULL existante, tuiles carrière honnêtes, grille de postes.
 * Pas de clone d'un site tiers, pas de valeur marché, pas d'appel EA client.
 */
export function ProfileOverview({
  user,
  isOwn,
  clubName,
  clubId,
  cpcMatchesPlayed,
  matchHistory,
  matchHistoryLoading = false,
  matchHistoryError = false,
  onRetryMatchHistory,
  onLinkEaClub,
  actionsSlot,
  reviewsSlot,
}: {
  user: UserRow;
  isOwn: boolean;
  clubName?: string | null;
  clubId?: string | null;
  cpcMatchesPlayed?: number | null;
  matchHistory?: MatchHistoryItem[] | null;
  matchHistoryLoading?: boolean;
  matchHistoryError?: boolean;
  onRetryMatchHistory?: () => void;
  onLinkEaClub?: () => void;
  actionsSlot?: ReactNode;
  reviewsSlot?: ReactNode;
}) {
  const [tab, setTab] = useState<ProfileTab>("overview");
  const tiles = resolveCareerTiles({
    verified: user.verified_stats,
    identityKind: user.ea_identity_kind,
    cpcMatchesPlayed,
    seed: user.id || user.username,
  });
  const caption = careerTilesCaption(tiles);
  const ovr = computeOvr({ reliabilityScore: user.reliability_score });
  const resolvedClubId = clubId?.trim() ? clubId.trim() : null;
  const clubLine = clubName?.trim() ? clubName.trim() : PLAYER_CARD_COPY.sansClub;
  const platform = PLATFORM_LABELS[user.platform] ?? user.platform;
  const playStyle = PLAY_STYLE_LABELS[user.play_style] ?? user.play_style;
  const secondary = new Set(user.secondary_positions ?? []);

  return (
    <View className="w-full gap-5">
      <View className="flex-row items-start gap-3">
        <Avatar username={user.username} size="lg" tone="accent" />
        <View className="min-w-0 flex-1">
          <Text numberOfLines={1} className="font-display text-[28px] leading-8 text-fg">
            {user.username}
          </Text>
          <View className="mt-1.5 flex-row flex-wrap items-center gap-1.5">
            {user.main_position ? (
              <View className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5">
                <Text className="text-[11px] font-bold tracking-wide text-accent">{user.main_position}</Text>
              </View>
            ) : null}
            {ovr !== null ? (
              <View className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5">
                <Text className="text-[11px] font-bold tracking-wide text-fg">
                  {ovr} {OVR_CPC_LABEL}
                </Text>
              </View>
            ) : null}
          </View>
          <Text numberOfLines={1} className="mt-1.5 text-sm text-fg-muted">
            {clubLine}
          </Text>
          <Text numberOfLines={1} className="text-[12px] text-fg-subtle">
            {platform} · {playStyle}
          </Text>
          <View className="mt-1 flex-row flex-wrap items-center gap-3">
            {resolvedClubId ? (
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  router.push(`/club/${resolvedClubId}`);
                }}
                className="min-h-[44px] justify-center"
                accessibilityRole="button"
                accessibilityLabel="Voir le club"
              >
                <Text className="text-sm font-bold text-accent">Voir le club</Text>
              </Pressable>
            ) : null}
            {isOwn ? (
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  router.push("/edit-profile");
                }}
                className="min-h-[44px] justify-center"
                accessibilityRole="button"
                accessibilityLabel="Modifier le profil"
              >
                <Text className="text-sm text-fg-subtle">Modifier le profil</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>

      {actionsSlot}

      <View className="flex-row rounded-full border border-white/10 bg-white/[0.03] p-0.5">
        {TABS.map((s) => (
          <Pressable
            key={s.key}
            onPress={() => {
              Haptics.selectionAsync();
              setTab(s.key);
            }}
            className={`min-h-[40px] flex-1 justify-center rounded-full px-2 py-2 ${tab === s.key ? "bg-accent" : ""}`}
            accessibilityRole="button"
            accessibilityState={{ selected: tab === s.key }}
            accessibilityLabel={s.label}
          >
            <Text
              numberOfLines={1}
              className={`text-center text-[11px] font-semibold ${tab === s.key ? "text-bg" : "text-fg-muted"}`}
            >
              {s.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === "overview" ? (
        <View className="gap-5">
          {tiles.length > 0 ? (
            <View className="gap-1.5">
              <View className="flex-row gap-2">
                {tiles.map((tile) => (
                  <CareerTileBox key={tile.key} tile={tile} />
                ))}
              </View>
              {caption ? <Text className="text-[10px] text-fg-subtle">{caption}</Text> : null}
            </View>
          ) : null}

          <View className="flex-row flex-wrap gap-1.5">
            {POSITIONS.map((code) => {
              const isMain = code === user.main_position;
              const isSecondary = secondary.has(code);
              const cell = (
                <View
                  className={cn(
                    "items-center justify-center rounded-lg border py-2",
                    isMain
                      ? "border-accent/50 bg-accent/15"
                      : isSecondary
                        ? "border-white/15 bg-white/[0.04]"
                        : "border-white/5 bg-transparent"
                  )}
                >
                  <Text
                    className={cn(
                      "text-[11px] font-bold tracking-wide",
                      isMain ? "text-accent" : isSecondary ? "text-fg-muted" : "text-fg-subtle/50"
                    )}
                  >
                    {code}
                  </Text>
                </View>
              );
              if (!isOwn) {
                return (
                  <View key={code} className="w-[31%]">
                    {cell}
                  </View>
                );
              }
              return (
                <Pressable
                  key={code}
                  className="w-[31%]"
                  onPress={() => {
                    Haptics.selectionAsync();
                    router.push("/edit-profile");
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Poste ${code}, modifier le profil`}
                >
                  {cell}
                </Pressable>
              );
            })}
          </View>

          <View className="items-center">
            <ClubProCard
              user={user}
              clubName={clubName ?? null}
              clubId={resolvedClubId}
              cpcMatchesPlayed={cpcMatchesPlayed}
              onLinkEaClub={onLinkEaClub}
            />
          </View>
        </View>
      ) : null}

      {tab === "history" ? (
        <MatchHistoryList
          variant="embedded"
          items={matchHistory}
          loading={matchHistoryLoading}
          error={matchHistoryError}
          onRetry={onRetryMatchHistory}
        />
      ) : null}

      {tab === "reviews" ? <View className="w-full">{reviewsSlot}</View> : null}
    </View>
  );
}

function CareerTileBox({ tile }: { tile: CareerTile }) {
  return (
    <View
      className={cn(
        "min-w-0 flex-1 items-center rounded-xl border px-1.5 py-2.5",
        tile.highlight ? "border-accent/50 bg-accent/10" : "border-border bg-bg-card"
      )}
    >
      <Text className="text-[10px] font-bold uppercase tracking-wide text-fg-muted">{tile.label}</Text>
      <Text className={cn("font-display text-2xl", tile.highlight ? "text-accent" : "text-fg")}>{tile.value}</Text>
    </View>
  );
}