import { type ReactNode } from "react";
import { ScrollView, View, type ScrollViewProps } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { cn } from "@/lib/utils";
import { cpcTokens } from "@/lib/design/cpc-tokens";

type AppShellProps = {
  children: ReactNode;
  scroll?: boolean;
  className?: string;
  contentClassName?: string;
  edges?: Edge[];
  padded?: boolean;
  contentContainerStyle?: ScrollViewProps["contentContainerStyle"];
} & Omit<ScrollViewProps, "children" | "contentContainerStyle" | "className">;

const PAD = cpcTokens.geometry.contentPadding;

/**
 * Coquille d'écran CPC — fond token, padding 16, une seule zone défilante.
 * `edges={[]}` par défaut sous le chrome global (header déjà safe-area).
 */
export function AppShell({
  children,
  scroll = true,
  className,
  contentClassName,
  edges = [],
  padded = true,
  contentContainerStyle,
  ...props
}: AppShellProps) {
  const padStyle = padded
    ? { paddingHorizontal: PAD, paddingTop: 8, paddingBottom: 40 }
    : undefined;

  if (!scroll) {
    return (
      <SafeAreaView edges={edges} className={cn("flex-1 bg-bg", className)}>
        <View className={cn("flex-1", contentClassName)} style={padStyle}>
          {children}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={edges} className={cn("flex-1 bg-bg", className)}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={[padStyle, contentContainerStyle]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        {...props}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}
