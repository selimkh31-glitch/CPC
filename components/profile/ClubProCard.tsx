import { Pressable, Share, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MotiView } from "moti";
import * as Haptics from "expo-haptics";
import { BadgeCheck, Flame, Share2 } from "lucide-react-native";
import { PLATFORM_LABELS, PLAY_STYLE_LABELS } from "@/lib/constants";
import { computeOvr, rarityForOvr, RARITY_LABEL } from "@/lib/ovr";
import { RARITY_BORDER, RARITY_GRADIENT, RARITY_TEXT } from "@/lib/theme";
import { formatPositionsLine } from "@/lib/playerCard";
import type { Platform, PlayStyleCode, PositionCode, VerifiedStats } from "@/lib/types";
import type { EaIdentityKind } from "@/lib/statsSource";
import { eaIdentityBadge, hasVerifiedEaStatValues, normalizeEaIdentityKind } from "@/lib/statsSource";
import { ErrorState } from "@/components/ui/Screen";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";

export interface ClubProCardData {
  username: string;
  platform: Platform;
  mainPosition: PositionCode;
  secondaryPositions?: PositionCode[];
  playStyle?: PlayStyleCode;
  reliabilityScore?: number | null;
  plan: "FREE" | "PRO";
  currentStreak?: number;
  verifiedStats?: VerifiedStats | null;
  eaIdentityKind?: EaIdentityKind | null;
}

/**
 * ClubPro Card (profil joueur) — champs réels + OVR CPC calculé.
 *
 * OVR = `computeOvr(reliability_score, verified_stats)` : score produit CPC,
 * jamais une note EA. Labellisé « OVR CPC ». Stats EA seulement si
 * `ea_identity_kind === USERNAME_EQUALITY` et qu'un chiffre est stocké.
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
    return <Skeleton className="h-72 w-full max-w-sm rounded-3xl" />;
  }

  if (!data?.username) {
    return (
      <View className="w-full max-w-sm items-center rounded-3xl border border-dashed border-border bg-bg-card px-5 py-10">
        <Text className="text-center font-display text-lg text-fg">Carte joueur FC 27</Text>
        <Text className="mt-2 text-center text-sm text-fg-muted">
          Profil incomplet — termine l&apos;onboarding pour afficher ta carte EA SPORTS FC 27 Pro Clubs.
        </Text>
      </View>
    );
  }

  const reliabilityStored = typeof data.reliabilityScore === "number" && Number.isFinite(data.reliabilityScore);
  const ovr = reliabilityStored
    ? computeOvr({ reliabilityScore: data.reliabilityScore!, verifiedStats: data.verifiedStats })
    : null;
  const rarity = ovr !== null ? rarityForOvr(ovr) : null;
  const identityKind = normalizeEaIdentityKind(data.eaIdentityKind);
  const identity = eaIdentityBadge(identityKind);
  const showEaStats = identityKind === "USERNAME_EQUALITY" && hasVerifiedEaStatValues(data.verifiedStats);
  const positionLine = formatPositionsLine(data.mainPosition, data.secondaryPositions ?? []);

  const handleShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await Share.share({
      message:
        ovr !== null
          ? `${data.username} — ${ovr} OVR CPC · ${PLATFORM_LABELS[data.platform]} sur ClubPro Connect (EA SPORTS FC 27 Pro Clubs)`
          : `${data.username} — ${PLATFORM_LABELS[data.platform]} sur ClubPro Connect (EA SPORTS FC 27 Pro Clubs)`,
    });
  };

  return (
    <MotiView
      from={{ opacity: 0, translateY: 16, scale: 0.97 }}
      animate={{ opacity: 1, translateY: 0, scale: 1 }}
      transition={{ type: "timing", duration: 500 }}
      className={cn("w-full max-w-sm overflow-hidden rounded-3xl border-2", rarity ? RARITY_BORDER[rarity] : "border-accent/35")}
    >
      <LinearGradient colors={rarity ? RARITY_GRADIENT[rarity] : (["#39ff8a26", "#131519"] as [string, string])} className="p-5">
        <Text className="text-[11px] font-extrabold uppercase tracking-widest text-accent">
          EA SPORTS FC 27 Pro Clubs
        </Text>

        <View className="mt-3 flex-row items-start justify-between">
          <View>
            {ovr !== null ? (
              <>
                <Text className="font-display text-6xl text-fg">{ovr}</Text>
                <Text className="font-display-semibold text-sm uppercase tracking-widest text-fg-muted">
                  OVR CPC · {data.mainPosition}
                </Text>
              </>
            ) : (
              <Text className="font-display-semibold text-sm uppercase tracking-widest text-fg-muted">
                {data.mainPosition}
              </Text>
            )}
          </View>
          <View className="items-end">
            {rarity ? (
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
            ) : null}
            {data.plan === "PRO" ? (
              <Text className="mt-1 text-[11px] font-extrabold uppercase tracking-wide text-pro-300">Pro</Text>
            ) : (
              <Text className="mt-1 text-[11px] font-bold uppercase tracking-wide text-fg-subtle">Free</Text>
            )}
          </View>
        </View>

        <View className="mt-4 flex-row items-center justify-between border-t border-white/10 pt-4">
          <View className="min-w-0 flex-1 pr-3">
            <Text numberOfLines={1} className="font-display text-2xl text-fg">
              {data.username}
            </Text>
            <Text className="mt-0.5 text-xs text-fg-muted">
              {PLATFORM_LABELS[data.platform]}
              {data.playStyle ? ` · ${PLAY_STYLE_LABELS[data.playStyle]}` : ""}
            </Text>
          </View>
          <Pressable
            onPress={handleShare}
            accessibilityLabel="Partager la carte"
            hitSlop={8}
            className="min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-border bg-bg-elevated/70 active:scale-90"
          >
            <Share2 size={16} color="#9aa0a8" />
          </Pressable>
        </View>

        <View className="mt-4">
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

        {showEaStats && data.verifiedStats ? (
          <View className="mt-4 flex-row gap-2">
            {typeof data.verifiedStats.goals === "number" && <StatBlock label="Buts EA" value={data.verifiedStats.goals} />}
            {typeof data.verifiedStats.assists === "number" && <StatBlock label="Passes EA" value={data.verifiedStats.assists} />}
            {typeof data.verifiedStats.matchesPlayed === "number" && (
              <StatBlock label="Matchs EA" value={data.verifiedStats.matchesPlayed} />
            )}
          </View>
        ) : null}

        <View className="mt-4 flex-row items-center justify-between">
          {reliabilityStored ? (
            <Text className="text-xs text-fg-muted">
              Fiabilité CPC <Text className="font-extrabold text-fg">{Math.round(data.reliabilityScore!)}</Text>
            </Text>
          ) : (
            <Text className="text-xs text-fg-subtle">Fiabilité CPC non renseignée</Text>
          )}
          {(data.currentStreak ?? 0) > 0 && (
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
