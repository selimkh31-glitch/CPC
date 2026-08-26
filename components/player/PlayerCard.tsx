import { Pressable, Share, Text, View } from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { MotiView } from "moti";
import * as Haptics from "expo-haptics";
import { BadgeCheck, Flame, Share2 } from "lucide-react-native";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { PulseDot } from "@/components/ui/PulseDot";
import { RARITY_BORDER, RARITY_TEXT } from "@/lib/theme";
import { OVR_CPC_LABEL } from "@/lib/ovr";
import { Button } from "@/components/ui/Button";
import {
  PLAYER_CARD_COPY,
  formatCpcMatchCount,
  playerCardHeroNumber,
  resolvePlayerCardDensity,
  visibleEaStatBlocks,
  type PlayerCardData,
  type PlayerCardState,
  type PlayerCardVariant,
} from "@/lib/playerCard";
import { faceStatsCaption, visibleFaceStatCells } from "@/lib/cardFace";
import { PLATFORM_LABELS, PLAY_STYLE_LABELS, POSITION_LABELS } from "@/lib/constants";
import { eaIdentityBadge } from "@/lib/statsSource";
import { cn } from "@/lib/utils";

/**
 * Carte joueur unique — 3 densités du même builder (`buildPlayerCardData`).
 * FULL = profil, COMPACT = LIVE / recrutement / recherche, MINI = listes.
 * N'affiche un champ que s'il est réel. OVR toujours labellisé « OVR CPC ».
 */
export function PlayerCard({
  data,
  variant = "compact",
  state = "normal",
  onPress,
  interactive = true,
  shareEnabled = false,
  footer,
  rightSlot,
  onLinkEaClub,
  className,
}: {
  data: PlayerCardData;
  variant?: PlayerCardVariant;
  state?: PlayerCardState;
  onPress?: () => void;
  interactive?: boolean;
  shareEnabled?: boolean;
  footer?: React.ReactNode;
  rightSlot?: React.ReactNode;
  /** Profil perso, club EA pas lié — CTA sur la Card, pas dans les réglages. */
  onLinkEaClub?: () => void;
  className?: string;
}) {
  const density = resolvePlayerCardDensity(variant);
  const handlePress =
    onPress ??
    (() => {
      if (data.userId) router.push(`/profile/${data.userId}`);
    });
  const press = interactive ? handlePress : undefined;

  if (density === "mini") {
    return (
      <View className={cn("rounded-xl border bg-bg-card px-2.5 py-1.5", stateBorderClass(state, data), className)}>
        <MiniBody data={data} onPress={press} rightSlot={rightSlot} />
        {footer}
      </View>
    );
  }

  if (density === "full") {
    return (
      <FullBody
        data={data}
        state={state}
        onPress={press}
        shareEnabled={shareEnabled}
        footer={footer}
        onLinkEaClub={onLinkEaClub}
        className={className}
      />
    );
  }

  return (
    <Card className={cn(stateBorderClass(state, data), className)}>
      <CompactBody data={data} state={state} onPress={press} rightSlot={rightSlot} />
      {footer}
    </Card>
  );
}

function stateBorderClass(state: PlayerCardState, data: PlayerCardData): string {
  switch (state) {
    case "featured":
      return "border-accent/50";
    case "mvp":
      return "border-rarity-gold";
    case "winner":
      return "border-outcome-win/60";
    case "selected":
      return "border-accent bg-accent/5";
    default:
      return data.rarity ? RARITY_BORDER[data.rarity] : "border-accent/30";
  }
}

function MiniBody({
  data,
  onPress,
  rightSlot,
}: {
  data: PlayerCardData;
  onPress?: () => void;
  rightSlot?: React.ReactNode;
}) {
  const identity = (
    <>
      <Avatar username={data.username} size="sm" tone={data.live ? "accent" : "neutral"} />
      <View className="min-w-0 flex-1">
        <View className="flex-row items-center gap-1.5">
          {data.live ? <PulseDot /> : null}
          <Text numberOfLines={1} className="font-display text-base text-fg">
            {data.username}
          </Text>
        </View>
        <Text className="text-[11px] text-fg-subtle">
          {data.mainPosition} · {PLATFORM_LABELS[data.platform]}
          {data.clubName ? ` · ${data.clubName}` : ""}
        </Text>
      </View>
    </>
  );

  return (
    <View className="min-h-[44px] flex-row items-center gap-2.5">
      {onPress ? (
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={`${PLAYER_CARD_COPY.viewProfile} de ${data.username}`}
          className="min-h-[44px] min-w-0 flex-1 flex-row items-center gap-2.5 active:opacity-80"
        >
          {identity}
        </Pressable>
      ) : (
        <View className="min-w-0 flex-1 flex-row items-center gap-2.5">{identity}</View>
      )}
      {rightSlot}
    </View>
  );
}

function CompactBody({
  data,
  state,
  onPress,
  rightSlot,
}: {
  data: PlayerCardData;
  state: PlayerCardState;
  onPress?: () => void;
  rightSlot?: React.ReactNode;
}) {
  const matchLine = formatCpcMatchCount(data.cpcMatchesPlayed);
  const identity = eaIdentityBadge(data.eaIdentityKind);

  const body = (
    <View className="flex-row items-center gap-3">
      <Avatar username={data.username} size="md" tone={state === "mvp" ? "mvp" : data.live ? "accent" : "neutral"} />
      <View className="min-w-0 flex-1">
        <View className="flex-row items-center gap-1.5">
          {data.live ? <PulseDot /> : null}
          <Text numberOfLines={1} className="font-display text-lg text-fg">
            {data.username}
          </Text>
        </View>
        <Text className="mt-0.5 font-display text-2xl leading-7 text-accent">{data.mainPosition}</Text>
        <Text className="text-xs text-fg-subtle">
          {POSITION_LABELS[data.mainPosition]} · {PLATFORM_LABELS[data.platform]}
        </Text>
        {data.clubName ? (
          <Text numberOfLines={1} className="text-xs text-fg-muted">
            {data.clubName}
          </Text>
        ) : null}
        {data.needFitLabel ? <Text className="mt-0.5 text-[11px] font-bold text-accent">{data.needFitLabel}</Text> : null}
        {matchLine ? <Text className="text-[11px] text-fg-subtle">{matchLine}</Text> : null}
        {identity.show ? <Text className="text-[10px] text-fg-subtle">{identity.label}</Text> : null}
      </View>
      {rightSlot || data.ovr !== null ? (
        <View className="items-end gap-1">
          {rightSlot}
          {data.ovr !== null ? (
            <View className="items-end">
              <Text className={cn("font-display text-2xl", data.rarity ? RARITY_TEXT[data.rarity] : "text-fg")}>
                {data.ovr}
              </Text>
              <Text className="text-[9px] uppercase tracking-wide text-fg-subtle">{OVR_CPC_LABEL}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );

  if (!onPress) return body;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${PLAYER_CARD_COPY.viewProfile} de ${data.username}`}
      className="min-h-[44px] active:opacity-80"
    >
      {body}
    </Pressable>
  );
}

function FullBody({
  data,
  state,
  onPress,
  shareEnabled,
  footer,
  onLinkEaClub,
  className,
}: {
  data: PlayerCardData;
  state: PlayerCardState;
  onPress?: () => void;
  shareEnabled: boolean;
  footer?: React.ReactNode;
  onLinkEaClub?: () => void;
  className?: string;
}) {
  const identity = eaIdentityBadge(data.eaIdentityKind);
  const hero = playerCardHeroNumber(data);
  const faceCells = visibleFaceStatCells(data.faceStats);
  const careerBlocks = data.showEaStats ? visibleEaStatBlocks(data.eaStats) : [];
  const surface = ["#12151a", "#08090b"] as [string, string];
  const secondaryCodes = data.secondaryPositions.filter((p, i, arr) => arr.indexOf(p) === i);

  const handleShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const ovrBit = data.ovr !== null ? `${data.ovr} ${OVR_CPC_LABEL} · ` : "";
    await Share.share({
      message: `${data.username} — ${ovrBit}${PLATFORM_LABELS[data.platform]} sur ClubPro Connect (${PLAYER_CARD_COPY.fc27})`,
    });
  };

  const inner = (
    <LinearGradient colors={surface} className="relative px-5 pb-8 pt-5">
      <View className="min-h-[44px] flex-row items-start justify-between">
        <View>
          {hero ? (
            <>
              <Text className="font-display text-5xl leading-[48px] text-accent">{hero.value}</Text>
              <Text className="text-[9px] uppercase tracking-wide text-fg-subtle">{hero.label}</Text>
            </>
          ) : data.cpcMatchesPlayed === 0 && !footer ? (
            <Text className="text-xs text-fg-muted">{PLAYER_CARD_COPY.noMatch}</Text>
          ) : null}
          <Text className="mt-1 font-display text-2xl leading-7 text-accent">{data.mainPosition}</Text>
        </View>
        {shareEnabled ? (
          <Pressable
            onPress={handleShare}
            accessibilityLabel="Partager la carte"
            hitSlop={8}
            className="min-h-[44px] min-w-[44px] items-center justify-center active:opacity-70"
          >
            <Share2 size={16} color="#666c74" />
          </Pressable>
        ) : (
          <View className="min-h-[44px] min-w-[44px]" />
        )}
      </View>

      <View className="mt-3 items-center">
        <View className="items-center justify-center" style={{ width: 120, height: 120 }}>
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: -18,
              bottom: -18,
              left: -18,
              right: -18,
              borderRadius: 9999,
              backgroundColor: "#39ff8a",
              opacity: 0.18,
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: -8,
              bottom: -8,
              left: -8,
              right: -8,
              borderRadius: 9999,
              backgroundColor: "#39ff8a",
              opacity: 0.12,
            }}
          />
          <Avatar username={data.username} size="xl" tone="accent" />
        </View>
      </View>

      <View className="mt-4 flex-row flex-wrap items-center justify-center gap-1.5">
        {data.live ? (
          <View className="flex-row items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5">
            <PulseDot />
            <Text className="text-[10px] font-bold uppercase tracking-wide text-accent">{PLAYER_CARD_COPY.live}</Text>
          </View>
        ) : null}
        {secondaryCodes.map((code) => (
          <Text key={code} className="font-mono text-[11px] font-bold text-white/45">
            {code}
          </Text>
        ))}
      </View>

      <Text numberOfLines={1} className="mt-3 text-center font-display text-3xl leading-9 text-fg">
        {data.username}
      </Text>
      <Text numberOfLines={1} className="mt-0.5 text-center text-sm text-fg-muted">
        {data.clubName ?? PLAYER_CARD_COPY.sansClub}
      </Text>
      <Text className="mt-1 text-center text-[12px] text-fg-subtle">
        {PLATFORM_LABELS[data.platform]}
        {data.playStyle ? ` · ${PLAY_STYLE_LABELS[data.playStyle]}` : ""}
      </Text>

      {faceCells.length > 0 && data.faceStats ? (
        <View className="mt-5">
          <View className="flex-row flex-wrap">
            {faceCells.map((cell) => (
              <View key={cell.key} className="w-1/3 items-center py-1.5">
                <Text className="text-[10px] font-bold uppercase tracking-wide text-white/40">{cell.label}</Text>
                <Text className="font-display text-xl text-fg">{cell.value}</Text>
              </View>
            ))}
          </View>
          <Text className="mt-1.5 text-center text-[10px] text-fg-subtle">{faceStatsCaption(data.faceStats.source)}</Text>
        </View>
      ) : null}

      {careerBlocks.length > 0 ? (
        <View className="mt-4 flex-row flex-wrap gap-2">
          {careerBlocks.map((block) => (
            <StatBlock key={block.label} label={block.label} value={block.value} />
          ))}
        </View>
      ) : null}

      <EaSlot
        data={data}
        identity={identity}
        onLinkEaClub={onLinkEaClub}
        hasFaceEa={data.faceStats?.source === "EA"}
        hasCareer={careerBlocks.length > 0}
      />

      {data.badges.length > 0 ? (
        <View className="mt-4 flex-row flex-wrap justify-center gap-1.5">
          {data.badges.map((badge) => (
            <Badge key={badge.id} tone="accent">
              {badge.label}
            </Badge>
          ))}
        </View>
      ) : null}

      {data.currentStreak > 0 ? (
        <View className="mt-3 flex-row items-center justify-center gap-1">
          <Flame size={14} color="#39ff8a" />
          <Text className="text-xs font-bold text-accent">{data.currentStreak} de suite</Text>
        </View>
      ) : null}

      <Text className="absolute bottom-3 right-4 text-[9px] font-bold uppercase tracking-[3px] text-white/20">
        {PLAYER_CARD_COPY.watermark}
      </Text>
    </LinearGradient>
  );

  return (
    <MotiView
      from={{ opacity: 0, translateY: 16, scale: 0.97 }}
      animate={{ opacity: 1, translateY: 0, scale: 1 }}
      transition={{ type: "timing", duration: 500 }}
      className={cn(
        "w-full max-w-sm overflow-hidden rounded-[32px] border border-white/10",
        stateBorderClass(state, data),
        className
      )}
    >
      {onPress ? (
        <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${PLAYER_CARD_COPY.viewProfile} de ${data.username}`}>
          {inner}
        </Pressable>
      ) : (
        inner
      )}
      {footer}
    </MotiView>
  );
}

function EaSlot({
  data,
  identity,
  onLinkEaClub,
  hasFaceEa = false,
  hasCareer = false,
}: {
  data: PlayerCardData;
  identity: { show: boolean; label: string; hint: string };
  onLinkEaClub?: () => void;
  hasFaceEa?: boolean;
  hasCareer?: boolean;
}) {
  if (onLinkEaClub && !data.eaClubLinked) {
    return (
      <View className="mt-6">
        <Text className="text-sm text-fg-muted">{PLAYER_CARD_COPY.eaUnlinked}</Text>
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 min-h-[44px] self-start px-0"
          onPress={onLinkEaClub}
          accessibilityLabel={PLAYER_CARD_COPY.linkClub}
        >
          {PLAYER_CARD_COPY.linkClub}
        </Button>
      </View>
    );
  }

  if (identity.show) {
    return (
      <View className="mt-5">
        <View className="flex-row items-center gap-1.5">
          <BadgeCheck size={14} color="#666c74" />
          <Text className="text-xs text-fg-subtle">{identity.label}</Text>
        </View>
        <Text className="mt-0.5 text-[10px] text-fg-subtle">{identity.hint}</Text>
        {!hasCareer && !hasFaceEa && data.eaClubLinked ? (
          <Text className="mt-2 text-xs text-fg-subtle">{PLAYER_CARD_COPY.eaLinkedPending}</Text>
        ) : null}
      </View>
    );
  }

  if (data.eaClubLinked && !hasCareer && !hasFaceEa) {
    return (
      <View className="mt-4">
        <Text className="text-xs text-fg-subtle">{PLAYER_CARD_COPY.eaLinkedPending}</Text>
      </View>
    );
  }

  return null;
}

function StatBlock({ label, value }: { label: string; value: string | number }) {
  return (
    <View className="min-w-[28%] flex-1 items-center rounded-lg bg-black/20 py-2">
      <Text className="font-display text-lg text-fg">{String(value)}</Text>
      <Text className="text-[10px] uppercase tracking-wide text-fg-subtle">{label}</Text>
    </View>
  );
}
