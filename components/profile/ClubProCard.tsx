import { Pressable, Share, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MotiView } from "moti";
import * as Haptics from "expo-haptics";
import { BadgeCheck, Flame, Share2 } from "lucide-react-native";
import { POSITION_LABELS, PLATFORM_LABELS, PLAY_STYLE_LABELS } from "@/lib/constants";
import { computeOvr, rarityForOvr, RARITY_LABEL, type Rarity } from "@/lib/ovr";
import type { Platform, PlayStyleCode, PositionCode, VerifiedStats } from "@/lib/types";
import type { EaIdentityKind } from "@/lib/statsSource";
import { eaIdentityBadge } from "@/lib/statsSource";
import { cn } from "@/lib/utils";

export interface ClubProCardData {
  username: string;
  platform: Platform;
  mainPosition: PositionCode;
  playStyle: PlayStyleCode;
  reliabilityScore: number;
  plan: "FREE" | "PRO";
  currentStreak: number;
  verifiedStats?: VerifiedStats | null;
  eaClubLinked?: string | null;
  eaIdentityKind?: EaIdentityKind | null;
}

const RARITY_GRADIENT: Record<Rarity, [string, string]> = {
  bronze: ["#a3673a33", "#131519"],
  silver: ["#c0c5cc33", "#131519"],
  gold: ["#e8b84b40", "#131519"],
  icon: ["#39e6ff40", "#8b5cf633"],
};

const RARITY_BORDER: Record<Rarity, string> = {
  bronze: "border-rarity-bronze/50",
  silver: "border-rarity-silver/50",
  gold: "border-rarity-gold/60",
  icon: "border-rarity-icon/60",
};

const RARITY_TEXT: Record<Rarity, string> = {
  bronze: "text-rarity-bronze",
  silver: "text-rarity-silver",
  gold: "text-rarity-gold",
  icon: "text-rarity-icon",
};

/**
 * ClubPro Card — le hook viral du produit (section 3.A). OVR CPC, rareté
 * visuelle, badge stats EA liées, streak. Pensée pour être belle en capture
 * d'écran et partageable nativement (Share API).
 */
export function ClubProCard({ data }: { data: ClubProCardData }) {
  const ovr = computeOvr({ reliabilityScore: data.reliabilityScore, verifiedStats: data.verifiedStats });
  const rarity = rarityForOvr(ovr);
  const identity = eaIdentityBadge(data.eaIdentityKind);
  const verified = Boolean(data.eaClubLinked) || identity.show;

  const handleShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await Share.share({
      message: `${data.username} — ${ovr} OVR CPC sur ClubPro Connect (EA SPORTS FC 27 Pro Clubs)`,
    });
  };

  return (
    <MotiView
      from={{ opacity: 0, translateY: 16, scale: 0.97 }}
      animate={{ opacity: 1, translateY: 0, scale: 1 }}
      transition={{ type: "timing", duration: 500 }}
      className={cn("w-full max-w-sm overflow-hidden rounded-3xl border-2", RARITY_BORDER[rarity])}
    >
      <LinearGradient colors={RARITY_GRADIENT[rarity]} className="p-5">
        <View className="flex-row items-start justify-between">
          <View>
            <Text className="font-display text-6xl text-fg">{ovr}</Text>
            <Text className="font-display-semibold text-sm uppercase tracking-widest text-fg-muted">
              OVR CPC · {data.mainPosition}
            </Text>
          </View>
          <View className="items-end">
            <View
              className={cn(
                "rounded-full border px-3 py-1",
                rarity === "icon" && "border-rarity-icon/60 bg-rarity-icon/10",
                rarity === "gold" && "border-rarity-gold/60 bg-rarity-gold/10",
                rarity === "silver" && "border-rarity-silver/60 bg-rarity-silver/10",
                rarity === "bronze" && "border-rarity-bronze/60 bg-rarity-bronze/10"
              )}
            >
              <Text className={cn("text-[11px] font-extrabold uppercase tracking-wide", RARITY_TEXT[rarity])}>
                {RARITY_LABEL[rarity]}
              </Text>
            </View>
            {data.plan === "PRO" && (
              <Text className="mt-1 text-[11px] font-extrabold uppercase tracking-wide text-pro-300">Pro</Text>
            )}
          </View>
        </View>

        <View className="mt-4 flex-row items-center justify-between border-t border-white/10 pt-4">
          <View className="shrink">
            <Text numberOfLines={1} className="font-display text-2xl text-fg">
              {data.username}
            </Text>
            <Text className="mt-0.5 text-xs text-fg-muted">
              {PLATFORM_LABELS[data.platform]} · {PLAY_STYLE_LABELS[data.playStyle]}
            </Text>
          </View>
          <Pressable
            onPress={handleShare}
            accessibilityLabel="Partager la carte"
            className="rounded-full border border-border bg-bg-elevated/70 p-2.5 active:scale-90"
          >
            <Share2 size={16} color="#9aa0a8" />
          </Pressable>
        </View>

        {verified && (
          <View className="mt-3 self-start rounded-lg border border-accent/30 bg-accent/10 px-2.5 py-1">
            <View className="flex-row items-center gap-1.5">
              <BadgeCheck size={14} color="#39ff8a" />
              <Text className="text-xs font-bold text-accent">{identity.label || "Stats club EA liées"}</Text>
            </View>
            <Text className="mt-0.5 text-[10px] text-fg-muted">
              {identity.hint || "Rapprochement par pseudo — pas un id joueur EA vérifié."}
            </Text>
          </View>
        )}

        {verified ? (
          <View className="mt-4 flex-row gap-2">
            <StatBlock label="Buts EA" value={data.verifiedStats?.goals ?? "—"} />
            <StatBlock label="Passes EA" value={data.verifiedStats?.assists ?? "—"} />
            <StatBlock label="Matchs EA" value={data.verifiedStats?.matchesPlayed ?? "—"} />
          </View>
        ) : (
          <Text className="mt-4 text-xs text-fg-subtle">Pas de stats EA liées — aucun chiffre inventé.</Text>
        )}

        <View className="mt-4 flex-row items-center justify-between">
          <Text className="text-xs text-fg-muted">
            Fiabilité <Text className="font-extrabold text-fg">{Math.round(data.reliabilityScore)}</Text>
          </Text>
          {data.currentStreak > 0 && (
            <View className="flex-row items-center gap-1">
              <Flame size={14} color="#39ff8a" />
              <Text className="text-xs font-bold text-accent">{data.currentStreak} de suite</Text>
            </View>
          )}
        </View>
      </LinearGradient>
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
