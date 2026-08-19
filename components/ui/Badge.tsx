import { View, Text } from "react-native";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "accent" | "pro" | "danger" | "warn" | "bronze" | "silver" | "gold" | "icon";

const CONTAINER_CLASSES: Record<Tone, string> = {
  neutral: "bg-bg-elevated border-border",
  accent: "bg-accent/10 border-accent/30",
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
    <View className={cn("self-start rounded-full border px-2.5 py-1", CONTAINER_CLASSES[tone], className)}>
      <Text className={cn("text-xs font-bold", TEXT_CLASSES[tone])}>{children}</Text>
    </View>
  );
}
