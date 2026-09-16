import { View, Text, type ViewProps } from "react-native";
import { cn } from "@/lib/utils";
import { cpcCardShadow } from "@/lib/design/cpc-native";
import { cpcTokens } from "@/lib/design/cpc-tokens";

export function Card({ className, style, ...props }: ViewProps & { className?: string }) {
  return (
    <View
      className={cn("border border-border bg-bg-card p-4", className)}
      style={[{ borderRadius: cpcTokens.radius.card }, cpcCardShadow, style]}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: ViewProps & { className?: string }) {
  return <View className={cn("mb-3 flex-row items-center justify-between", className)} {...props} />;
}

export function CardTitle({
  className,
  icon,
  children,
}: {
  className?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  if (icon) {
    return (
      <View className="flex-row items-center gap-2">
        {icon}
        <Text className={cn("font-display text-lg uppercase tracking-wide text-fg", className)}>{children}</Text>
      </View>
    );
  }
  return (
    <Text className={cn("font-display text-lg uppercase tracking-wide text-fg", className)}>
      {children}
    </Text>
  );
}
