import { Text, View } from "react-native";
import { cn } from "@/lib/utils";
import { cpcTokens } from "@/lib/design/cpc-tokens";

type AvatarSize = "sm" | "md" | "lg" | "xl";
type AvatarTone = "neutral" | "accent" | "mvp";

const SIZE_PX: Record<AvatarSize, number> = {
  sm: cpcTokens.avatar.sm,
  md: cpcTokens.avatar.md,
  lg: cpcTokens.avatar.lg,
  xl: 88,
};
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
