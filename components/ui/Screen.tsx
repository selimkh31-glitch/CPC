import { Pressable, ScrollView, Text, View, type ScrollViewProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { cn } from "@/lib/utils";
import { cpcTokens } from "@/lib/design/cpc-tokens";
import { Skeleton } from "@/components/ui/Skeleton";

interface ScreenProps extends ScrollViewProps {
  scroll?: boolean;
  className?: string;
}

/** Conteneur d'écran — safe areas, fond CPC, scroll optionnel. */
export function Screen({ children, scroll = true, className, contentContainerStyle, ...props }: ScreenProps) {
  const insets = useSafeAreaInsets();

  if (!scroll) {
    return (
      <View className={cn("flex-1 bg-bg px-4", className)} style={{ paddingTop: insets.top + 8 }}>
        {children}
      </View>
    );
  }

  return (
    <ScrollView
      className={cn("flex-1 bg-bg", className)}
      contentContainerStyle={[
        { paddingTop: insets.top + 8, paddingHorizontal: cpcTokens.geometry.contentPadding, paddingBottom: 32 },
        contentContainerStyle,
      ]}
      keyboardShouldPersistTaps="handled"
      {...props}
    >
      {children}
    </ScrollView>
  );
}

export function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View className="items-center border border-dashed border-border py-16">
      <Text className="px-6 text-center font-sans text-body text-fg-muted">{title}</Text>
      {subtitle && <Text className="mt-1 px-6 text-center font-sans text-caption text-fg-subtle">{subtitle}</Text>}
    </View>
  );
}

export function ErrorState({ message = "Une erreur est survenue.", onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <View className="items-center border border-danger/30 bg-danger/5 px-6 py-10">
      <Text className="text-center font-sans text-body text-fg">{message}</Text>
      {onRetry && (
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onRetry();
          }}
          className="mt-3 min-h-[44px] items-center justify-center border border-border bg-bg-elevated px-4 active:opacity-80"
          style={{ borderRadius: cpcTokens.radius.control }}
        >
          <Text className="text-sm font-bold text-fg">Réessayer</Text>
        </Pressable>
      )}
    </View>
  );
}

export function SkeletonList({ rows = 3 }: { rows?: number }) {
  return (
    <View className="gap-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-16" />
      ))}
    </View>
  );
}
