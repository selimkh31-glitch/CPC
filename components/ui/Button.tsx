import { ActivityIndicator, Pressable, Text, type PressableProps } from "react-native";
import * as Haptics from "expo-haptics";
import { cn } from "@/lib/utils";

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
  primary: "text-bg",
  secondary: "text-fg",
  ghost: "text-fg-muted",
  danger: "text-danger",
  pro: "text-white",
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "h-9 px-3",
  md: "h-12 px-4",
  lg: "h-14 px-6",
};

const TEXT_SIZE_CLASSES: Record<Size, string> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
};

/** Bouton tactile générique — feedback haptique systématique, zones de touch généreuses. */
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
        "flex-row items-center justify-center gap-2 rounded-2xl active:scale-[0.98]",
        CONTAINER_CLASSES[variant],
        SIZE_CLASSES[size],
        (disabled || loading) && "opacity-50",
        className
      )}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? "#08090b" : "#f4f5f7"} />
      ) : (
        <>
          {icon}
          <Text className={cn("font-bold", TEXT_CLASSES[variant], TEXT_SIZE_CLASSES[size])}>{children}</Text>
        </>
      )}
    </Pressable>
  );
}
