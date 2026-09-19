import { Pressable, Text } from "react-native";
import * as Haptics from "expo-haptics";
import { useAppMode } from "@/lib/providers/AppModeProvider";

/**
 * DEV / retest — efface le mode persisté (SecureStore) pour réafficher
 * la porte Joueur / Manager. Invisible hors __DEV__.
 */
export function DevClearModeButton() {
  const { clearMode } = useAppMode();

  if (typeof __DEV__ === "undefined" || !__DEV__) return null;

  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        clearMode();
      }}
      accessibilityRole="button"
      accessibilityLabel="Revoir le choix Joueur ou Manager"
      className="mb-8 min-h-[44px] justify-center self-start"
    >
      <Text className="text-sm font-bold text-fg-subtle">DEV — revoir Joueur / Manager</Text>
    </Pressable>
  );
}
