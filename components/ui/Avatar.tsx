import { Text, View } from "react-native";
import { cn } from "@/lib/utils";

type AvatarSize = "sm" | "md" | "lg" | "xl";
type AvatarTone = "neutral" | "accent" | "mvp";

const SIZE_PX: Record<AvatarSize, number> = { sm: 32, md: 44, lg: 64, xl: 88 };
const SIZE_TEXT: Record<AvatarSize, string> = { sm: "text-[10px]", md: "text-sm", lg: "text-xl", xl: "text-2xl" };
const TONE_BORDER: Record<AvatarTone, string> = {
  neutral: "border-border",
  accent: "border-accent",
  mvp: "border-rarity-gold",
};
const TONE_TEXT: Record<AvatarTone, string> = {
  neutral: "text-fg",
  accent: "text-accent",
  mvp: "text-rarity-gold",
};

/**
 * Avatar joueur générique par initiales (Phase G.2 section 4) — formalise le
 * pattern déjà dessiné à la main dans components/club/FormationPitch.tsx
 * (cercle + initiales + bordure accent si occupé) pour le rendre réutilisable
 * ailleurs : sélecteur MVP (G.5), mini roster LIVE (G.3), liste MATCH HISTORY
 * (G.7). FormationPitch n'est PAS modifié dans cette phase — ce composant est
 * neuf, à adopter dans les phases suivantes si jugé pertinent, jamais
 * rétrofitté ici (pas de changement du parcours actuel).
 */
export function Avatar({
  username,
  size = "md",
  tone = "neutral",
  className,
}: {
  username: string;
  size?: AvatarSize;
  tone?: AvatarTone;
  className?: string;
}) {
  const px = SIZE_PX[size];
  const initials = username.slice(0, 2).toUpperCase();

  return (
    <View
      className={cn("items-center justify-center rounded-full border-2 bg-bg-elevated", TONE_BORDER[tone], className)}
      style={{ width: px, height: px }}
    >
      <Text className={cn("font-display", SIZE_TEXT[size], TONE_TEXT[tone])}>{initials}</Text>
    </View>
  );
}
