import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useModeAccent } from "@/lib/theme";
import { cpcHex } from "@/lib/design/cpc-native";
import { cpcTokens } from "@/lib/design/cpc-tokens";

type TabRoute = { key: string; name: string; params?: object };
type TabBarProps = {
  state: { index: number; routes: TabRoute[] };
  descriptors: Record<string, { options: Record<string, unknown> }>;
  navigation: {
    emit: (e: { type: "tabPress"; target: string; canPreventDefault: true }) => { defaultPrevented: boolean };
    navigate: (name: string, params?: object) => void;
  };
};

export const CPC_TAB_BAR_STYLE = {
  backgroundColor: cpcHex.background,
  borderTopColor: cpcHex.borderSubtle,
  borderTopWidth: cpcTokens.border.hairline,
  height: cpcTokens.geometry.bottomNav,
  paddingBottom: 6,
  paddingTop: 6,
} as const;

/**
 * Barre basse CPC — destinations inchangées (Expo Router).
 * Cibles ≥ 44 px, hauteur 78, labels Inter.
 */
export function BottomNavigation({ state, descriptors, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const accent = useModeAccent();
  const visibleRoutes = state.routes.filter((route) => {
    const options = descriptors[route.key]?.options ?? {};
    return options.href !== null;
  });

  return (
    <View
      className="border-t border-border bg-bg"
      style={{ paddingBottom: Math.max(insets.bottom, 8), minHeight: cpcTokens.geometry.bottomNav }}
    >
      <View className="flex-row items-stretch">
        {visibleRoutes.map((route) => {
          const options = descriptors[route.key]?.options ?? {};
          const focused = state.routes[state.index]?.key === route.key;
          const color = focused ? accent : cpcHex.disabled;
          const label =
            typeof options.tabBarLabel === "string"
              ? options.tabBarLabel
              : typeof options.title === "string"
                ? options.title
                : route.name;
          const badge = options.tabBarBadge as number | string | undefined;
          const onPress = () => {
            Haptics.selectionAsync();
            const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };
          const tabBarIcon = options.tabBarIcon as
            | ((args: { focused: boolean; color: string; size: number }) => ReactNode)
            | undefined;
          const icon = tabBarIcon?.({ focused, color, size: cpcTokens.icon.md });

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={(options.tabBarAccessibilityLabel as string | undefined) ?? label}
              className="min-h-[44px] flex-1 items-center justify-center py-1"
            >
              <View className="items-center justify-center">
                {icon}
                {badge != null && badge !== 0 ? (
                  <View
                    className="absolute -right-2 -top-1 min-h-[16px] min-w-[16px] items-center justify-center rounded-full px-1"
                    style={{ backgroundColor: accent }}
                  >
                    <Text className="text-micro font-sans-bold" style={{ color: cpcHex.accentForeground }}>
                      {badge}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text numberOfLines={1} className="mt-0.5 font-sans-semibold text-caption" style={{ color }}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
