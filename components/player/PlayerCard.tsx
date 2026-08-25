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
import { RARITY_BORDER, RARITY_GRADIENT, RARITY_TEXT } from "@/lib/theme";
import { OVR_CPC_LABEL, RARITY_LABEL } from "@/lib/ovr";
import {
  PLAYER_CARD_COPY,
  formatCpcMatchCount,
  formatPositionsLine,
  resolvePlayerCardDensity,
  type PlayerCardData,
  type PlayerCardState,
  type PlayerCardVariant,
} from "@/lib/playerCard";
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
      <View className={cn("rounded-2xl border bg-bg-card px-3 py-2", stateBorderClass(state, data), className)}>
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
        <Text className="text-xs text-fg-subtle">
          {data.mainPosition} · {PLATFORM_LABELS[data.platform]}
          {data.clubName ? ` · ${data.clubName}` : ""}
        </Text>
      </View>
      <Text className="font-display text-xl text-accent">{data.mainPosition}</Text>
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
  className,
}: {
  data: PlayerCardData;
  state: PlayerCardState;
  onPress?: () => void;
  shareEnabled: boolean;
  footer?: React.ReactNode;
  className?: string;
}) {
  const identity = eaIdentityBadge(data.eaIdentityKind);
  const matchLine = formatCpcMatchCount(data.cpcMatchesPlayed);
  const positionLine = formatPositionsLine(data.mainPosition, data.secondaryPositions);
  const gradient = data.rarity ? RARITY_GRADIENT[data.rarity] : (["#39ff8a26", "#131519"] as [string, string]);

  const handleShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const ovrBit = data.ovr !== null ? `${data.ovr} ${OVR_CPC_LABEL} · ` : "";
    await Share.share({
      message: `${data.username} — ${ovrBit}${PLATFORM_LABELS[data.platform]} sur ClubPro Connect (${PLAYER_CARD_COPY.fc27})`,
    });
  };

  const inner = (
    <LinearGradient colors={gradient} className="p-5">
      <Text className="text-[11px] font-extrabold uppercase tracking-widest text-accent">{PLAYER_CARD_COPY.fc27}</Text>

      <View className="mt-3 flex-row items-start justify-between">
        <View className="min-w-0 flex-1 pr-3">
          <Text className="font-display text-7xl leading-[72px] text-accent">{data.mainPosition}</Text>
          <Text className="font-display-semibold text-sm uppercase tracking-widest text-fg-muted">
            {POSITION_LABELS[data.mainPosition]}
          </Text>
        </View>
        <View className="items-end gap-2">
          <Avatar username={data.username} size="xl" tone={data.live ? "accent" : "neutral"} />
          {data.rarity ? <Badge tone={data.rarity}>{RARITY_LABEL[data.rarity]}</Badge> : null}
        </View>
      </View>

      <View className="mt-4 flex-row items-center justify-between border-t border-white/10 pt-4">
        <View className="min-w-0 flex-1 pr-3">
          <View className="flex-row items-center gap-1.5">
            {data.live ? <PulseDot /> : null}
            <Text numberOfLines={1} className="font-display text-2xl text-fg">
              {data.username}
            </Text>
          </View>
          <Text className="mt-0.5 text-xs text-fg-muted">
            {PLATFORM_LABELS[data.platform]}
            {data.playStyle ? ` · ${PLAY_STYLE_LABELS[data.playStyle]}` : ""}
            {data.clubName ? ` · ${data.clubName}` : ""}
          </Text>
          {data.eaUsername ? (
            <Text className="mt-1 text-[11px] text-fg-subtle">
              EA · {data.eaUsername}
            </Text>
          ) : null}
        </View>
        {shareEnabled ? (
          <Pressable
            onPress={handleShare}
            accessibilityLabel="Partager la carte"
            hitSlop={8}
            className="min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-border bg-bg-elevated/70 active:scale-90"
          >
            <Share2 size={16} color="#9aa0a8" />
          </Pressable>
        ) : null}
      </View>

      {data.secondaryPositions.length > 0 ? (
        <View className="mt-3">
          <Text className="text-[11px] font-bold uppercase tracking-wide text-fg-subtle">Postes</Text>
          <Text className="mt-1 text-sm font-semibold text-fg">{positionLine}</Text>
        </View>
      ) : null}

      <View className="mt-4 flex-row gap-2">
        {data.ovr !== null ? (
          <StatBlock label={OVR_CPC_LABEL} value={data.ovr} />
        ) : null}
        {matchLine ? <StatBlock label="Matchs CPC" value={data.cpcMatchesPlayed ?? 0} /> : null}
      </View>
      {data.cpcMatchesPlayed === 0 && !footer ? (
        <Text className="mt-3 text-sm text-fg-muted">{PLAYER_CARD_COPY.noMatch}</Text>
      ) : null}

      {identity.show ? (
        <View className="mt-4 self-start rounded-lg border border-accent/30 bg-accent/10 px-2.5 py-1.5">
          <View className="flex-row items-center gap-1.5">
            <BadgeCheck size={14} color="#39ff8a" />
            <Text className="text-xs font-bold text-accent">{identity.label}</Text>
          </View>
          <Text className="mt-0.5 text-[10px] text-fg-muted">{identity.hint}</Text>
        </View>
      ) : (
        <Text className="mt-4 text-xs text-fg-subtle">{identity.hint}</Text>
      )}

      {data.showEaStats && data.eaStats ? (
        <View className="mt-4 flex-row gap-2">
          {typeof data.eaStats.goals === "number" ? <StatBlock label="Buts EA" value={data.eaStats.goals} /> : null}
          {typeof data.eaStats.assists === "number" ? <StatBlock label="Passes EA" value={data.eaStats.assists} /> : null}
          {typeof data.eaStats.matchesPlayed === "number" ? (
            <StatBlock label="Matchs EA" value={data.eaStats.matchesPlayed} />
          ) : null}
        </View>
      ) : null}

      {data.badges.length > 0 ? (
        <View className="mt-4 flex-row flex-wrap gap-1.5">
          {data.badges.map((badge) => (
            <Badge key={badge.id} tone="accent">
              {badge.label}
            </Badge>
          ))}
        </View>
      ) : (
        <Text className="mt-4 text-xs text-fg-subtle">{PLAYER_CARD_COPY.noBadges}</Text>
      )}

      {data.currentStreak > 0 ? (
        <View className="mt-3 flex-row items-center gap-1">
          <Flame size={14} color="#39ff8a" />
          <Text className="text-xs font-bold text-accent">{data.currentStreak} de suite</Text>
        </View>
      ) : null}
    </LinearGradient>
  );

  return (
    <MotiView
      from={{ opacity: 0, translateY: 16, scale: 0.97 }}
      animate={{ opacity: 1, translateY: 0, scale: 1 }}
      transition={{ type: "timing", duration: 500 }}
      className={cn(
        "w-full max-w-sm overflow-hidden rounded-3xl border-2",
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

function StatBlock({ label, value }: { label: string; value: string | number }) {
  return (
    <View className="flex-1 items-center rounded-lg bg-black/20 py-2">
      <Text className="font-display text-lg text-fg">{String(value)}</Text>
      <Text className="text-[10px] uppercase tracking-wide text-fg-subtle">{label}</Text>
    </View>
  );
}
