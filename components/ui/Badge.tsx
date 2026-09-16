import { View, Text } from "react-native";
import { cn } from "@/lib/utils";
import { cpcTokens } from "@/lib/design/cpc-tokens";

type Tone = "neutral" | "accent" | "pro" | "danger" | "warn" | "bronze" | "silver" | "gold" | "icon" | "live";

const CONTAINER_CLASSES: Record<Tone, string> = {
  neutral: "bg-bg-elevated border-border",
  accent: "bg-accent/10 border-accent/30",
  live: "bg-live/10 border-live/40",
  pro: "bg-pro/10 border-pro/40",
  danger: "bg-danger/10 border-danger/30",
  warn: "bg-warn/10 border-warn/30",
  bronze: "bg-rarity-bronze/15 border-rarity-bronze/40",
  silver: "bg-rarity-silver/15 border-rarity-silver/40",
  gold: "bg-rarity-gold/15 border-rarity-gold/40",
  icon: "bg-rarity-icon/15 border-rarity-icon/40",
};

const TEXT_CLASSES: Record<Tone, string> = {
  neutral: "text-fg-muted",
  accent: "text-accent",
  live: "text-live",
  pro: "text-pro-200",
  danger: "text-danger",
  warn: "text-warn",
  bronze: "text-rarity-bronze",
  silver: "text-rarity-silver",
  gold: "text-rarity-gold",
  icon: "text-rarity-icon",
};

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: Tone;
  children: string;
  className?: string;
}) {
  return (
    <View className={cn("self-start border px-2.5 py-1", CONTAINER_CLASSES[tone], className)} style={{ borderRadius: cpcTokens.radius.badge }}>
      <Text className={cn("text-xs font-bold", TEXT_CLASSES[tone])}>{children}</Text>
    </View>
  );
}
