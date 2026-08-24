import { Pressable, Share, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MotiView } from "moti";
import * as Haptics from "expo-haptics";
import { BadgeCheck, Share2 } from "lucide-react-native";
import { POSITION_LABELS, PLATFORM_LABELS, type PositionCode } from "@/lib/constants";
import type { Platform } from "@/lib/types";
import type { EaIdentityKind } from "@/lib/statsSource";
import { eaIdentityBadge } from "@/lib/statsSource";
import { ErrorState } from "@/components/ui/Screen";
import { Skeleton } from "@/components/ui/Skeleton";

export interface ClubProCardData {
  username: string;
  platform: Platform;
  mainPosition: PositionCode;
  secondaryPositions?: PositionCode[];
  plan: "FREE" | "PRO";
  eaIdentityKind?: EaIdentityKind | null;
}

/**
 * ClubPro Card (profil joueur) — champs réels uniquement.
 * Pas d'OVR inventé, pas de rareté dérivée, pas de stats EA fabriquées.
 */
export function ClubProCard({
  data,
  loading = false,
  error = false,
  onRetry,
}: {
  data?: ClubProCardData | null;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
}) {
  if (error) {
    return (
      <View className="w-full max-w-sm">
        <ErrorState message="Impossible de charger la carte joueur." onRetry={onRetry} />
      </View>
    );
  }

  if (loading) {
    return <Skeleton className="h-64 w-full max-w-sm rounded-3xl" />;
  }

  if (!data?.username) {
    return (
      <View className="w-full max-w-sm items-center rounded-3xl border border-dashed border-border bg-bg-card px-5 py-10">
        <Text className="text-center font-display text-lg text-fg">Carte joueur</Text>
        <Text className="mt-2 text-center text-sm text-fg-muted">
          Profil incomplet — termine l&apos;onboarding pour afficher ta carte FC 27.
        </Text>
      </View>
    );
  }

  const identity = eaIdentityBadge(data.eaIdentityKind);
  const positions = [data.mainPosition, ...(data.secondaryPositions ?? [])].filter(
    (p, i, arr) => arr.indexOf(p) === i
  );
  const positionLine = positions.map((p) => `${p} · ${POSITION_LABELS[p]}`).join("  ·  ");

  const handleShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await Share.share({
      message: `${data.username} — ${POSITION_LABELS[data.mainPosition]} · ${PLATFORM_LABELS[data.platform]} sur ClubPro Connect (EA SPORTS FC 27 Pro Clubs)`,
    });
  };

  return (
    <MotiView
      from={{ opacity: 0, translateY: 16, scale: 0.97 }}
      animate={{ opacity: 1, translateY: 0, scale: 1 }}
      transition={{ type: "timing", duration: 500 }}
      className="w-full max-w-sm overflow-hidden rounded-3xl border-2 border-accent/35"
    >
      <LinearGradient colors={["#39ff8a26", "#131519"]} className="p-5">
        <Text className="text-[11px] font-extrabold uppercase tracking-widest text-accent">
          EA SPORTS FC 27 Pro Clubs
        </Text>
        <View className="mt-3 flex-row items-start justify-between gap-3">
          <View className="min-w-0 flex-1">
            <Text numberOfLines={1} className="font-display text-3xl text-fg">
              {data.username}
            </Text>
            <Text className="mt-1 text-sm text-fg-muted">{PLATFORM_LABELS[data.platform]}</Text>
          </View>
          <View className="items-end">
            {data.plan === "PRO" ? (
              <Text className="text-[11px] font-extrabold uppercase tracking-wide text-pro-300">Pro</Text>
            ) : (
              <Text className="text-[11px] font-bold uppercase tracking-wide text-fg-subtle">Free</Text>
            )}
            <Pressable
              onPress={handleShare}
              accessibilityLabel="Partager la carte"
              hitSlop={12}
              className="mt-2 min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-border bg-bg-elevated/70 active:scale-90"
            >
              <Share2 size={16} color="#9aa0a8" />
            </Pressable>
          </View>
        </View>

        <View className="mt-4 border-t border-white/10 pt-4">
          <Text className="text-[11px] font-bold uppercase tracking-wide text-fg-subtle">Postes</Text>
          <Text className="mt-1 text-sm font-semibold text-fg">{positionLine}</Text>
        </View>

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
      </LinearGradient>
    </MotiView>
  );
}
