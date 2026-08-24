import { Pressable, ScrollView, Text, View, type ScrollViewProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { cn } from "@/lib/utils";

interface ScreenProps extends ScrollViewProps {
  scroll?: boolean;
  className?: string;
}

/** Conteneur d'écran standard — safe areas gérées, fond dark e-sport, scroll optionnel. */
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
      contentContainerStyle={[{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 32 }, contentContainerStyle]}
      keyboardShouldPersistTaps="handled"
      {...props}
    >
      {children}
    </ScrollView>
  );
}

export function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View className="items-center rounded-2xl border border-dashed border-border py-16">
      <Text className="text-fg-muted text-center px-6">{title}</Text>
      {subtitle && <Text className="text-fg-subtle text-center text-xs mt-1 px-6">{subtitle}</Text>}
    </View>
  );
}

/**
 * État d'erreur explicite pour une query React Query en échec (réseau, RLS,
 * Edge Function down...) — jamais laisser un écran bloqué indéfiniment sur un
 * skeleton. `onRetry` doit être la fonction `refetch()` de la query concernée.
 */
export function ErrorState({ message = "Une erreur est survenue.", onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <View className="items-center rounded-2xl border border-danger/30 bg-danger/5 py-10 px-6">
      <Text className="text-center text-fg">{message}</Text>
      {onRetry && (
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onRetry();
          }}
          className="mt-3 min-h-[44px] items-center justify-center rounded-xl border border-border bg-bg-elevated px-4 active:opacity-80"
        >
          <Text className="text-sm font-bold text-fg">Réessayer</Text>
        </Pressable>
      )}
    </View>
  );
}
