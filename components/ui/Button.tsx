import { ActivityIndicator, Pressable, Text, type PressableProps } from "react-native";
import * as Haptics from "expo-haptics";
import { cn } from "@/lib/utils";
import { cpcHex } from "@/lib/design/cpc-native";
import { cpcTokens } from "@/lib/design/cpc-tokens";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "pro";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends Omit<PressableProps, "children"> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children: string;
  icon?: React.ReactNode;
}

const CONTAINER_CLASSES: Record<Variant, string> = {
  primary: "bg-accent active:bg-accent-500",
  secondary: "bg-bg-elevated border border-border active:bg-bg-card",
  ghost: "bg-transparent active:bg-bg-elevated",
  danger: "bg-danger/10 border border-danger/30 active:bg-danger/20",
  pro: "bg-pro active:bg-pro-600",
};

const TEXT_CLASSES: Record<Variant, string> = {
  primary: "text-accent-fg",
  secondary: "text-fg",
  ghost: "text-fg-muted",
  danger: "text-danger",
  pro: "text-white",
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "h-11 px-3",
  md: "h-11 px-4",
  lg: "h-[52px] px-6",
};

const TEXT_SIZE_CLASSES: Record<Size, string> = {
  sm: "text-sm",
  md: "text-action",
  lg: "text-action",
};

/** Bouton CPC — cible ≥ 44 px, rayon contrôle 2 px. */
export function Button({
  variant = "primary",
  size = "md",
  loading,
  disabled,
  children,
  icon,
  className,
  onPress,
  ...props
}: ButtonProps & { className?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={(e) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.(e);
      }}
      className={cn(
        "flex-row items-center justify-center gap-2 active:opacity-90",
        CONTAINER_CLASSES[variant],
        SIZE_CLASSES[size],
        (disabled || loading) && "opacity-50",
        className
      )}
      style={{ borderRadius: cpcTokens.radius.control, minHeight: size === "lg" ? cpcTokens.geometry.buttonLarge : cpcTokens.geometry.button }}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? cpcHex.accentForeground : cpcHex.textPrimary} />
      ) : (
        <>
          {icon}
          <Text className={cn("font-sans-bold", TEXT_CLASSES[variant], TEXT_SIZE_CLASSES[size])}>{children}</Text>
        </>
      )}
    </Pressable>
  );
}
