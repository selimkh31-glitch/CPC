import { View, type ViewProps } from "react-native";
import { cn } from "@/lib/utils";
import { cpcCardShadow } from "@/lib/design/cpc-native";
import { cpcTokens } from "@/lib/design/cpc-tokens";

export function SurfaceCard({ className, style, ...props }: ViewProps & { className?: string }) {
  return (
    <View
      className={cn("border border-border bg-bg-card", className)}
      style={[{ padding: cpcTokens.geometry.cardPadding, borderRadius: cpcTokens.radius.card }, cpcCardShadow, style]}
      {...props}
    />
  );
}
