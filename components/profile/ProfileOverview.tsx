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
import { PLATFORM_LABELS, PLAY_STYLE_LABELS, POSITIONS, type PositionCode } from "@/lib/constants";
import {
  availabilitySlotsFromUser,
  nextPositionsOnTap,
  validateProfileIdentity,
} from "@/lib/profileIdentity";
import { useUpdateOwnProfile } from "@/lib/hooks/useProfile";
import { toast } from "@/lib/toast";
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

  return (
    <View className="w-full gap-5">
      <View className="flex-row items-start gap-3">
        <Avatar username={user.username} size="lg" tone="accent" />
        <View className="min-w-0 flex-1">
          <Text numberOfLines={1} className="font-display text-[28px] leading-8 text-fg">
            {user.username}
          </Text>
          <View className="mt-1.5 gap-1.5">
            <SelectedPositionChips
              main={user.main_position}
              secondary={user.secondary_positions ?? []}
            />
            {ovr !== null ? (
              <View className="self-start rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5">
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

          <ProfilePositionGrid user={user} isOwn={isOwn} />

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

function SelectedPositionChips({
  main,
  secondary,
}: {
  main: PositionCode | null | undefined;
  secondary: readonly PositionCode[] | null | undefined;
}) {
  if (!main) return null;
  const extras = [...new Set((secondary ?? []).filter((p) => p !== main))];
  return (
    <View>
      <Text className="text-[10px] font-bold uppercase tracking-wide text-fg-subtle">Poste</Text>
      <View className="mt-1 flex-row flex-wrap items-center gap-1.5">
        <View key={`main-${main}`} className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5">
          <Text className="text-[11px] font-bold tracking-wide text-accent">{main}</Text>
        </View>
        {extras.map((pos) => (
          <View key={`sec-${pos}`} className="rounded-full border border-white/15 bg-white/[0.04] px-2 py-0.5">
            <Text className="text-[11px] font-bold tracking-wide text-fg-muted">{pos}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function identityPatchForPositions(
  user: UserRow,
  positions: { main_position: PositionCode; secondary_positions: PositionCode[] }
): Record<string, unknown> {
  return {
    username: user.username,
    platform: user.platform,
    main_position: positions.main_position,
    secondary_positions: positions.secondary_positions,
    play_style: user.play_style,
    languages: user.languages ?? [],
    availability: { slots: availabilitySlotsFromUser(user.availability) },
  };
}

function positionCellLabel(code: PositionCode, isMain: boolean, isSecondary: boolean, isOwn: boolean): string {
  if (!isOwn) return `Poste ${code}`;
  if (isMain) return `Poste principal ${code}`;
  if (isSecondary) return `Poste secondaire ${code}, appui long pour retirer`;
  return `Ajouter ${code} comme poste secondaire`;
}

function ProfilePositionGrid({ user, isOwn }: { user: UserRow; isOwn: boolean }) {
  const update = useUpdateOwnProfile();
  const main = user.main_position;
  const secondary = [...new Set((user.secondary_positions ?? []).filter((p) => p !== main))];
  const secondarySet = new Set(secondary);

  const applyTap = (code: PositionCode, intent: "tap" | "long-press") => {
    if (!isOwn || update.isPending) return;
    const next = nextPositionsOnTap(
      { main_position: user.main_position, secondary_positions: user.secondary_positions ?? [] },
      code,
      intent
    );
    if (!next.ok) {
      if (next.reason === "max") toast.info("3 postes max.");
      return;
    }
    const payload = identityPatchForPositions(user, next);
    const validated = validateProfileIdentity(payload);
    if (!validated.ok) {
      toast.error(validated.message);
      return;
    }
    Haptics.selectionAsync();
    update.mutate(payload, {
      onError: (err: unknown) => {
        const message = err && typeof err === "object" && "message" in err && typeof err.message === "string"
          ? err.message
          : "Impossible d'enregistrer le poste.";
        toast.error(message);
      },
    });
  };

  return (
    <View className="flex-row flex-wrap gap-1.5">
      {POSITIONS.map((pos) => {
        const isMain = pos === main;
        const isSecondary = secondarySet.has(pos);
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
              {pos}
            </Text>
          </View>
        );
        if (!isOwn) {
          return (
            <View key={`grid-${pos}`} className="w-[31%]">
              {cell}
            </View>
          );
        }
        return (
          <Pressable
            key={`grid-${pos}`}
            className="w-[31%]"
            disabled={update.isPending}
            onPress={() => applyTap(pos, "tap")}
            onLongPress={() => applyTap(pos, "long-press")}
            delayLongPress={450}
            accessibilityRole="button"
            accessibilityLabel={positionCellLabel(pos, isMain, isSecondary, true)}
            accessibilityState={{ disabled: update.isPending, selected: isMain || isSecondary }}
          >
            {cell}
          </Pressable>
        );
      })}
    </View>
  );
}