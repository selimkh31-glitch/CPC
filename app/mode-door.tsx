import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Logo } from "@/components/ui/Logo";
import { useAppMode } from "@/lib/providers/AppModeProvider";
import { MODE_DOOR_COPY, type AppMode } from "@/lib/appMode";
import { cpcTokens } from "@/lib/design/cpc-tokens";

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
      <View className="flex-1 justify-center px-4">
        <Logo size="sm" className="mb-8 items-start" />
        <Text className="mb-8 font-display text-displaySmall text-fg">{MODE_DOOR_COPY.title}</Text>

        <Pressable
          onPress={() => choose("PLAYER")}
          accessibilityRole="button"
          accessibilityLabel={MODE_DOOR_COPY.player}
          className="mb-4 min-h-[120px] justify-center border border-border bg-bg-card px-6 py-6 active:opacity-80"
          style={{ borderRadius: cpcTokens.radius.card }}
        >
          <Text className="font-display text-display text-fg">{MODE_DOOR_COPY.player}</Text>
          <Text className="mt-2 font-sans text-body text-fg-muted">{MODE_DOOR_COPY.playerHint}</Text>
        </Pressable>

        <Pressable
          onPress={() => choose("CLUB")}
          accessibilityRole="button"
          accessibilityLabel={MODE_DOOR_COPY.manager}
          className="min-h-[120px] justify-center border border-border bg-bg-card px-6 py-6 active:opacity-80"
          style={{ borderRadius: cpcTokens.radius.card }}
        >
          <Text className="font-display text-display text-fg">{MODE_DOOR_COPY.manager}</Text>
          <Text className="mt-2 font-sans text-body text-fg-muted">{MODE_DOOR_COPY.managerHint}</Text>
        </Pressable>
        {typeof __DEV__ !== "undefined" && __DEV__ ? (
          <Text className="mt-6 font-sans text-caption text-fg-subtle">
            DEV — ce choix est mémorisé. Pour le revoir : Profil ou Club → « DEV — revoir Joueur / Manager ».
          </Text>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
