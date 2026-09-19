import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { MotiView } from "moti";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { PulseDot } from "@/components/ui/PulseDot";
import {
  CLUB_CARD_COPY,
  clubCardHeroNumber,
  formatClubMatchRecord,
  formatClubMemberCount,
  resolveClubCardDensity,
  type ClubCardData,
  type ClubCardState,
  type ClubCardVariant,
} from "@/lib/clubCard";
import { cn } from "@/lib/utils";
import { cpcHex } from "@/lib/design/cpc-native";

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
      <View className={cn("overflow-hidden border bg-bg-card px-2.5 py-1.5", stateBorderClass(state), className)}>
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
          <Text numberOfLines={1} className="font-display text-base text-fg" style={{ color: cpcHex.textPrimary }}>
            {data.name}
          </Text>
        </View>
        {data.identityLine ? (
          <Text numberOfLines={1} className="text-[11px] text-fg-subtle" style={{ color: cpcHex.disabled }}>
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
  const hero = clubCardHeroNumber(data);

  const body = (
    <View className="flex-row items-center gap-3">
      <Avatar username={data.name || "CP"} size="md" tone={data.live ? "accent" : "neutral"} />
      <View className="min-w-0 flex-1">
        <View className="flex-row items-center gap-1.5">
          {data.live ? <PulseDot /> : null}
          <Text numberOfLines={1} className="font-display text-lg text-fg" style={{ color: cpcHex.textPrimary }}>
            {data.name}
          </Text>
        </View>
        {needed ? (
          <Text numberOfLines={1} className="mt-0.5 text-sm font-semibold text-fg" style={{ color: cpcHex.textPrimary }}>
            {needed}
          </Text>
        ) : null}
        {data.identityLine ? (
          <Text numberOfLines={1} className="mt-0.5 text-xs text-fg-muted" style={{ color: cpcHex.textMuted }}>
            {data.identityLine}
          </Text>
        ) : null}
        {data.languagesLine ? (
          <Text numberOfLines={1} className="text-xs text-fg-subtle" style={{ color: cpcHex.disabled }}>
            {data.languagesLine}
          </Text>
        ) : null}
        {data.reason ? (
          <Text numberOfLines={1} className="mt-1 text-[11px] text-fg-subtle" style={{ color: cpcHex.disabled }}>
            {data.reason}
          </Text>
        ) : null}
        {record ? (
          <Text className="text-[11px] text-fg-subtle" style={{ color: cpcHex.disabled }}>
            {record}
          </Text>
        ) : null}
        {data.liveNote ? (
          <Text numberOfLines={1} className="mt-1 text-xs text-fg-muted" style={{ color: cpcHex.textMuted }}>
            {data.liveNote}
          </Text>
        ) : null}
      </View>
      {rightSlot || hero ? (
        <View className="items-end gap-1">
          {rightSlot}
          {hero ? (
            <View className="items-end">
              <Text className="font-display text-2xl text-accent" style={{ color: cpcHex.accent }}>
                {hero.value}
              </Text>
              <Text className="text-[9px] uppercase tracking-wide text-fg-subtle" style={{ color: cpcHex.disabled }}>
                {hero.label}
              </Text>
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
  const hero = clubCardHeroNumber(data);
  const surface = ["#1a1e24", "#0c0d10"] as [string, string];

  const inner = (
    <LinearGradient colors={surface} className="px-5 pb-5 pt-5">
      <View className="flex-row items-center gap-3">
        <Avatar username={data.name || "CP"} size="lg" tone={data.live ? "accent" : "neutral"} />
        <View className="min-w-0 flex-1">
          <View className="flex-row items-center gap-2">
            {data.live ? <PulseDot /> : null}
            <Text
              numberOfLines={1}
              className="min-w-0 flex-1 font-display text-2xl leading-7 text-fg"
              style={{ color: cpcHex.textPrimary }}
            >
              {data.name}
            </Text>
            {data.live ? (
              <Text
                className="text-[10px] font-bold uppercase tracking-wide text-accent"
                style={{ color: cpcHex.accent }}
              >
                {CLUB_CARD_COPY.live}
              </Text>
            ) : null}
          </View>
          {data.identityLine ? (
            <Text numberOfLines={1} className="mt-0.5 text-sm text-fg-muted" style={{ color: cpcHex.textMuted }}>
              {data.identityLine}
            </Text>
          ) : null}
          {members ? (
            <Text className="mt-0.5 text-xs text-fg-subtle" style={{ color: cpcHex.disabled }}>
              {members}
            </Text>
          ) : null}
        </View>
        {hero ? (
          <View className="items-end pl-2">
            <Text className="font-display text-3xl leading-8 text-accent" style={{ color: cpcHex.accent }}>
              {hero.value}
            </Text>
            <Text className="text-[9px] uppercase tracking-wide text-fg-subtle" style={{ color: cpcHex.disabled }}>
              {hero.label}
            </Text>
          </View>
        ) : null}
      </View>

      {needed ? (
        <Text className="mt-4 text-sm leading-5 text-fg-muted" style={{ color: cpcHex.textMuted }}>
          {needed}
        </Text>
      ) : null}
      {record ? (
        <Text className="mt-1 text-sm text-fg-muted" style={{ color: cpcHex.textMuted }}>
          {record}
        </Text>
      ) : null}
      {data.description ? (
        <Text className="mt-3 text-sm text-fg-muted" style={{ color: cpcHex.textMuted }}>
          {data.description}
        </Text>
      ) : null}
      {data.liveNote ? (
        <Text className="mt-2 text-sm text-fg-muted" style={{ color: cpcHex.textMuted }}>
          {data.liveNote}
        </Text>
      ) : null}

      {data.eaClubId ? (
        <Text className="mt-4 text-xs text-fg-subtle" style={{ color: cpcHex.disabled }}>
          {CLUB_CARD_COPY.eaLinked}
        </Text>
      ) : (
        <Text className="mt-4 text-xs text-fg-subtle" style={{ color: cpcHex.disabled }}>
          {CLUB_CARD_COPY.eaUnlinked}
        </Text>
      )}
    </LinearGradient>
  );

  return (
    <MotiView
      from={{ opacity: 0, translateY: 16, scale: 0.97 }}
      animate={{ opacity: 1, translateY: 0, scale: 1 }}
      transition={{ type: "timing", duration: 500 }}
      className={cn("w-full overflow-hidden rounded-[32px] border border-white/10", stateBorderClass(state), className)}
    >
      {onPress ? (
        <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${CLUB_CARD_COPY.viewClub} ${data.name}`}>
          {inner}
        </Pressable>
      ) : (
        inner
      )}
      {footer ? <View className="px-6 pb-6">{footer}</View> : null}
    </MotiView>
  );
}
