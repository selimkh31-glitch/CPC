import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { MotiView } from "moti";
import { BadgeCheck } from "lucide-react-native";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { PulseDot } from "@/components/ui/PulseDot";
import {
  CLUB_CARD_COPY,
  formatClubMatchRecord,
  formatClubMemberCount,
  resolveClubCardDensity,
  type ClubCardData,
  type ClubCardState,
  type ClubCardVariant,
} from "@/lib/clubCard";
import { CLUB_LEVEL_LABELS, PLATFORM_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";

/**
 * Carte club unique — 3 densités du même builder (`buildClubCardData`).
 * FULL = profil / effectif, COMPACT = LIVE / annuaire / recherche, MINI = listes.
 * N'affiche un champ que s'il est réel. Pas d'OVR club, pas de FUT clone.
 */
export function ClubCard({
  data,
  variant = "compact",
  state = "normal",
  onPress,
  interactive = true,
  footer,
  rightSlot,
  className,
}: {
  data: ClubCardData;
  variant?: ClubCardVariant;
  state?: ClubCardState;
  onPress?: () => void;
  interactive?: boolean;
  footer?: ReactNode;
  rightSlot?: ReactNode;
  className?: string;
}) {
  const density = resolveClubCardDensity(variant);
  const handlePress =
    onPress ??
    (() => {
      if (data.clubId) router.push(data.href);
    });
  const press = interactive ? handlePress : undefined;

  if (density === "mini") {
    return (
      <View className={cn("rounded-2xl border bg-bg-card px-3 py-2", stateBorderClass(state), className)}>
        <MiniBody data={data} onPress={press} rightSlot={rightSlot} />
        {footer}
      </View>
    );
  }

  if (density === "full") {
    return (
      <FullBody data={data} state={state} onPress={press} footer={footer} className={className} />
    );
  }

  return (
    <Card className={cn(stateBorderClass(state), className)}>
      <CompactBody data={data} onPress={press} rightSlot={rightSlot} />
      {footer}
    </Card>
  );
}

function stateBorderClass(state: ClubCardState): string {
  if (state === "selected") return "border-accent bg-accent/5";
  return "border-accent/30";
}

function MiniBody({
  data,
  onPress,
  rightSlot,
}: {
  data: ClubCardData;
  onPress?: () => void;
  rightSlot?: ReactNode;
}) {
  const identity = (
    <>
      <Avatar username={data.name || "CP"} size="sm" tone={data.live ? "accent" : "neutral"} />
      <View className="min-w-0 flex-1">
        <View className="flex-row items-center gap-1.5">
          {data.live ? <PulseDot /> : null}
          <Text numberOfLines={1} className="font-display text-base text-fg">
            {data.name}
          </Text>
        </View>
        {data.identityLine ? (
          <Text numberOfLines={1} className="text-xs text-fg-subtle">
            {data.identityLine}
          </Text>
        ) : null}
      </View>
    </>
  );

  return (
    <View className="min-h-[44px] flex-row items-center gap-2.5">
      {onPress ? (
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={`${CLUB_CARD_COPY.viewClub} ${data.name}`}
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
  onPress,
  rightSlot,
}: {
  data: ClubCardData;
  onPress?: () => void;
  rightSlot?: ReactNode;
}) {
  const needed = data.neededLine ? CLUB_CARD_COPY.seeking(data.neededLine) : null;
  const record = formatClubMatchRecord(data.matchRecord);

  const body = (
    <View className="flex-row items-center gap-3">
      <Avatar username={data.name || "CP"} size="md" tone={data.live ? "accent" : "neutral"} />
      <View className="min-w-0 flex-1">
        <View className="flex-row items-center gap-1.5">
          {data.live ? <PulseDot /> : null}
          <Text numberOfLines={1} className="font-display text-lg text-fg">
            {data.name}
          </Text>
        </View>
        {needed ? (
          <Text numberOfLines={1} className="mt-0.5 text-sm font-semibold text-fg">
            {needed}
          </Text>
        ) : null}
        {data.identityLine ? (
          <Text numberOfLines={1} className="mt-0.5 text-xs text-fg-muted">
            {data.identityLine}
          </Text>
        ) : null}
        {data.languagesLine ? (
          <Text numberOfLines={1} className="text-xs text-fg-subtle">
            {data.languagesLine}
          </Text>
        ) : null}
        {data.reason ? (
          <Text numberOfLines={1} className="mt-1 text-[11px] text-fg-subtle">
            {data.reason}
          </Text>
        ) : null}
        {record ? <Text className="text-[11px] text-fg-subtle">{record}</Text> : null}
        {data.liveNote ? (
          <Text numberOfLines={1} className="mt-1 text-xs text-fg-muted">
            {data.liveNote}
          </Text>
        ) : null}
      </View>
      {rightSlot ? <View className="items-end">{rightSlot}</View> : null}
    </View>
  );

  if (!onPress) return body;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${CLUB_CARD_COPY.viewClub} ${data.name}`}
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
  footer,
  className,
}: {
  data: ClubCardData;
  state: ClubCardState;
  onPress?: () => void;
  footer?: ReactNode;
  className?: string;
}) {
  const needed = data.neededLine ? CLUB_CARD_COPY.seeking(data.neededLine) : null;
  const record = formatClubMatchRecord(data.matchRecord);
  const members = formatClubMemberCount(data.memberCount);
  const gradient = ["#39ff8a26", "#131519"] as [string, string];

  const inner = (
    <LinearGradient colors={gradient} className="p-5">
      <Text className="text-[11px] font-extrabold uppercase tracking-widest text-accent">{CLUB_CARD_COPY.fc27}</Text>

      <View className="mt-3 flex-row items-start justify-between">
        <View className="min-w-0 flex-1 pr-3">
          <View className="flex-row items-center gap-2">
            {data.live ? <PulseDot /> : null}
            <Text className="font-display text-3xl leading-9 text-fg">{data.name}</Text>
          </View>
          {data.live ? (
            <Text className="mt-1 text-xs font-extrabold uppercase tracking-widest text-accent">{CLUB_CARD_COPY.live}</Text>
          ) : null}
          {needed ? <Text className="mt-1 text-sm font-semibold text-fg">{needed}</Text> : null}
        </View>
        <Avatar username={data.name || "CP"} size="xl" tone={data.live ? "accent" : "neutral"} />
      </View>

      <View className="mt-4 border-t border-white/10 pt-4">
        {data.identityLine ? <Text className="text-sm text-fg-muted">{data.identityLine}</Text> : null}
        {data.ownerUsername ? (
          <Text numberOfLines={1} className="mt-0.5 text-xs text-fg-subtle">
            Owner · {data.ownerUsername}
          </Text>
        ) : null}
        {data.ownerPlatform && !data.identityLine ? (
          <Text className="mt-0.5 text-xs text-fg-subtle">{PLATFORM_LABELS[data.ownerPlatform]}</Text>
        ) : null}
        {data.languagesLine ? <Text className="mt-0.5 text-xs text-fg-subtle">{data.languagesLine}</Text> : null}
        {members ? <Text className="mt-0.5 text-xs text-fg-subtle">{members}</Text> : null}
        {data.description ? <Text className="mt-2 text-sm text-fg-muted">{data.description}</Text> : null}
        {data.liveNote ? <Text className="mt-2 text-sm text-fg-muted">{data.liveNote}</Text> : null}
      </View>

      {record && data.matchRecord ? (
        <View className="mt-4 flex-row gap-2">
          <StatBlock label={CLUB_CARD_COPY.recordLabel} value={record} />
          <StatBlock label={CLUB_CARD_COPY.pointsLabel} value={data.matchRecord.points} />
        </View>
      ) : null}

      {data.level ? (
        <View className="mt-3 self-start">
          <Badge tone={data.level === "COMPETITIVE" ? "accent" : "neutral"}>{CLUB_LEVEL_LABELS[data.level]}</Badge>
        </View>
      ) : null}

      {data.eaClubId ? (
        <View className="mt-4 self-start rounded-lg border border-accent/30 bg-accent/10 px-2.5 py-1.5">
          <View className="flex-row items-center gap-1.5">
            <BadgeCheck size={14} color="#39ff8a" />
            <Text className="text-xs font-bold text-accent">{CLUB_CARD_COPY.eaLinked}</Text>
          </View>
          <Text className="mt-0.5 text-[10px] text-fg-muted">{CLUB_CARD_COPY.eaLinkedHint}</Text>
        </View>
      ) : null}
    </LinearGradient>
  );

  return (
    <MotiView
      from={{ opacity: 0, translateY: 16, scale: 0.97 }}
      animate={{ opacity: 1, translateY: 0, scale: 1 }}
      transition={{ type: "timing", duration: 500 }}
      className={cn("w-full overflow-hidden rounded-3xl border-2", stateBorderClass(state), className)}
    >
      {onPress ? (
        <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${CLUB_CARD_COPY.viewClub} ${data.name}`}>
          {inner}
        </Pressable>
      ) : (
        inner
      )}
      {footer ? <View className="px-5 pb-5">{footer}</View> : null}
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
