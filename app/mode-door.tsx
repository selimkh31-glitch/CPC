import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useAppMode } from "@/lib/providers/AppModeProvider";
import { MODE_DOOR_COPY, type AppMode } from "@/lib/appMode";

/**
 * Première ouverture — une porte, deux choix. Pas un wizard, pas de lien EA.
 * Un tap → LIVE de ce mode. Relance : mode persisté, cette porte est sautée.
 */
export default function ModeDoorScreen() {
  const { setMode } = useAppMode();

  const choose = (next: AppMode) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setMode(next);
  };

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top", "bottom"]}>
      <View className="flex-1 justify-center px-6">
        <Text className="mb-8 font-display text-3xl text-fg">{MODE_DOOR_COPY.title}</Text>

        <Pressable
          onPress={() => choose("PLAYER")}
          accessibilityRole="button"
          accessibilityLabel={MODE_DOOR_COPY.player}
          className="mb-4 min-h-[120px] justify-center rounded-[28px] border border-white/10 bg-bg-card px-6 py-6 active:opacity-80"
        >
          <Text className="font-display text-4xl text-fg">{MODE_DOOR_COPY.player}</Text>
          <Text className="mt-2 text-base text-fg-muted">{MODE_DOOR_COPY.playerHint}</Text>
        </Pressable>

        <Pressable
          onPress={() => choose("CLUB")}
          accessibilityRole="button"
          accessibilityLabel={MODE_DOOR_COPY.manager}
          className="min-h-[120px] justify-center rounded-[28px] border border-white/10 bg-bg-card px-6 py-6 active:opacity-80"
        >
          <Text className="font-display text-4xl text-fg">{MODE_DOOR_COPY.manager}</Text>
          <Text className="mt-2 text-base text-fg-muted">{MODE_DOOR_COPY.managerHint}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
