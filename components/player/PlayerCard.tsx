import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { MotiView } from "moti";
import { BadgeCheck, Crown, Flame, Trophy } from "lucide-react-native";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { RARITY_BORDER, RARITY_GRADIENT, RARITY_TEXT } from "@/lib/theme";
import { RARITY_LABEL } from "@/lib/ovr";
import type { PlayerCardData, PlayerCardState, PlayerCardVariant } from "@/lib/playerCard";
import { POSITION_LABELS, PLATFORM_LABELS } from "@/lib/constants";
import { eaIdentityBadge } from "@/lib/statsSource";
import { cn } from "@/lib/utils";

/**
 * PlayerCard — composant central (mission section 13-15). Une seule source
 * visuelle pour représenter un joueur, déclinée en 3 variantes et 5 états.
 * Ne duplique jamais son propre rendu — un nouveau contexte d'usage choisit
 * une variante existante plutôt que de redessiner une carte à la main.
 *
 * Consommé aujourd'hui par PlayerResultCard (recherche joueur, variant
 * "compact"). Prêt pour effectif / feuille de match / sélecteur MVP / chat /
 * groupes / ligues — intégrations non faites dans cette session pour ne pas
 * risquer de régression sur des parcours protégés (voir rapport de session,
 * section "Player Cards").
 */
export function PlayerCard({
  data,
  variant = "standard",
  state = "normal",
  onPress,
  footer,
  rightSlot,
  className,
}: {
  data: PlayerCardData;
  variant?: PlayerCardVariant;
  state?: PlayerCardState;
  onPress?: () => void;
  footer?: React.ReactNode;
  rightSlot?: React.ReactNode;
  className?: string;
}) {
  const handlePress = onPress ?? (() => router.push(`/profile/${data.userId}`));

  if (variant === "compact") {
    return (
      <View className={cn("rounded-2xl border bg-bg-card p-3", stateBorderClass(state, data.rarity), className)}>
        <CompactBody data={data} state={state} onPress={handlePress} rightSlot={rightSlot} />
        {footer}
      </View>
    );
  }

  if (variant === "hero") {
    return <HeroBody data={data} state={state} onPress={handlePress} footer={footer} className={className} />;
  }

  return (
    <Card className={cn(stateBorderClass(state, data.rarity), className)}>
      <StandardBody data={data} state={state} onPress={handlePress} rightSlot={rightSlot} />
      {footer}
    </Card>
  );
}

/** Bordure/anneau selon l'état (section 13 : normal/featured/MVP/winner/selected). */
function stateBorderClass(state: PlayerCardState, rarity: PlayerCardData["rarity"]): string {
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
      return RARITY_BORDER[rarity];
  }
}

function StateIcon({ state }: { state: PlayerCardState }) {
  if (state === "mvp") return <Crown size={13} color="#e8b84b" />;
  if (state === "winner") return <Trophy size={13} color="#39ff8a" />;
  return null;
}

function CompactBody({
  data,
  state,
  onPress,
  rightSlot,
}: {
  data: PlayerCardData;
  state: PlayerCardState;
  onPress: () => void;
  rightSlot?: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Ouvrir le profil de ${data.username}`}
      className="flex-row items-center gap-3 active:opacity-80"
    >
      <Avatar username={data.username} size="md" tone={state === "mvp" ? "mvp" : state === "selected" ? "accent" : "neutral"} />
      <View className="flex-1">
        <View className="flex-row items-center gap-1.5">
          <Text numberOfLines={1} className="font-display text-base text-fg">
            {data.username}
          </Text>
          <StateIcon state={state} />
        </View>
        <Text className="text-xs text-fg-subtle">
          {POSITION_LABELS[data.mainPosition]} · {PLATFORM_LABELS[data.platform]}
        </Text>
      </View>
      {rightSlot ?? (
        <View className="items-end">
          <Text className={cn("font-display text-xl", RARITY_TEXT[data.rarity])}>{data.ovr}</Text>
          <Text className="text-[9px] uppercase tracking-wide text-fg-subtle">OVR CPC</Text>
        </View>
      )}
    </Pressable>
  );
}

function StandardBody({
  data,
  state,
  onPress,
  rightSlot,
}: {
  data: PlayerCardData;
  state: PlayerCardState;
  onPress: () => void;
  rightSlot?: React.ReactNode;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Ouvrir le profil de ${data.username}`} className="active:opacity-80">
      <View className="flex-row items-start justify-between">
        <View className="flex-row items-center gap-3">
          <Avatar username={data.username} size="md" tone={state === "mvp" ? "mvp" : "neutral"} />
          <View>
            <View className="flex-row items-center gap-1.5">
              <Text className="font-display text-lg text-fg">{data.username}</Text>
              <StateIcon state={state} />
            </View>
            <Text className="text-xs text-fg-subtle">
              {PLATFORM_LABELS[data.platform]} · {POSITION_LABELS[data.mainPosition]}
            </Text>
            {data.clubName && <Text className="text-xs text-fg-subtle">{data.clubName}</Text>}
          </View>
        </View>
        {rightSlot ?? (
          <View className="items-end">
            <Text className={cn("font-display text-2xl", RARITY_TEXT[data.rarity])}>{data.ovr}</Text>
            <Text className="text-[10px] uppercase tracking-wide text-fg-subtle">OVR CPC · {RARITY_LABEL[data.rarity]}</Text>
          </View>
        )}
      </View>

      <View className="mt-3 flex-row items-center justify-between border-t border-border pt-3">
        <View className="flex-row items-center gap-3">
          {data.verified && (
            <View className="flex-row items-center gap-1">
              <BadgeCheck size={13} color="#39ff8a" />
              <Text className="text-[11px] font-bold text-accent">{eaIdentityBadge(data.eaIdentityKind).label || "Club EA lié"}</Text>
            </View>
          )}
          {data.currentStreak > 0 && (
            <View className="flex-row items-center gap-1">
              <Flame size={13} color="#39ff8a" />
              <Text className="text-[11px] font-bold text-accent">{data.currentStreak}</Text>
            </View>
          )}
        </View>
        <Text className="text-[11px] text-fg-muted">
          Fiabilité <Text className="font-extrabold text-fg">{Math.round(data.reliabilityScore)}</Text>
        </Text>
      </View>
    </Pressable>
  );
}

function HeroBody({
  data,
  state,
  onPress,
  footer,
  className,
}: {
  data: PlayerCardData;
  state: PlayerCardState;
  onPress: () => void;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <MotiView
      from={{ opacity: 0, translateY: 16, scale: 0.97 }}
      animate={{ opacity: 1, translateY: 0, scale: 1 }}
      transition={{ type: "timing", duration: 500 }}
      className={cn("w-full max-w-sm overflow-hidden rounded-3xl border-2", stateBorderClass(state, data.rarity), className)}
    >
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Ouvrir le profil de ${data.username}`}>
        <LinearGradient colors={RARITY_GRADIENT[data.rarity]} className="p-5">
          <View className="flex-row items-start justify-between">
            <View>
              <Text className="font-display text-6xl text-fg">{data.ovr}</Text>
              <Text className="font-display-semibold text-sm uppercase tracking-widest text-fg-muted">
                OVR CPC · {data.mainPosition}
              </Text>
            </View>
            <View className="items-end gap-1">
              <Badge tone={data.rarity}>{RARITY_LABEL[data.rarity]}</Badge>
              {data.plan === "PRO" && <Text className="text-[11px] font-extrabold uppercase tracking-wide text-pro-300">Pro</Text>}
              <StateIcon state={state} />
            </View>
          </View>

          <View className="mt-4 flex-row items-center justify-between border-t border-white/10 pt-4">
            <Text numberOfLines={1} className="font-display text-2xl text-fg">
              {data.username}
            </Text>
            <Text className="text-xs text-fg-muted">{PLATFORM_LABELS[data.platform]}</Text>
          </View>

          {data.verified && (
            <View className="mt-3 self-start rounded-lg border border-accent/30 bg-accent/10 px-2.5 py-1">
              <View className="flex-row items-center gap-1.5">
                <BadgeCheck size={14} color="#39ff8a" />
                <Text className="text-xs font-bold text-accent">{eaIdentityBadge(data.eaIdentityKind).label || "Stats club EA liées"}</Text>
              </View>
              <Text className="mt-0.5 text-[10px] text-fg-muted">{eaIdentityBadge(data.eaIdentityKind).hint}</Text>
            </View>
          )}

          {data.eaStats && (
            <View className="mt-4 flex-row gap-2">
              <StatBlock label="Buts EA" value={data.eaStats.goals ?? "—"} />
              <StatBlock label="Passes EA" value={data.eaStats.assists ?? "—"} />
              <StatBlock label="Matchs EA" value={data.eaStats.matchesPlayed ?? "—"} />
            </View>
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
      </Pressable>
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
