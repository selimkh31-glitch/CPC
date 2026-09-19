import { ActivityIndicator, Modal, Text, View } from "react-native";
import { modeSwitchCopy } from "@/lib/appMode";
import { useAppMode } from "@/lib/providers/AppModeProvider";
import { cpcHex } from "@/lib/design/cpc-native";

const SWITCH_ACCENT = { PLAYER: "#4DA3FF", CLUB: cpcHex.accent } as const;

/**
 * Passage Joueur ↔ Club — overlay plein écran, comme changer d'app.
 * Accent = destination (bleu joueur / vert club). Non dismissible.
 */
export function ModeSwitchOverlay() {
  const { transitioningTo: target } = useAppMode();
  if (!target) return null;

  const accent = SWITCH_ACCENT[target];

  return (
    <Modal
      visible
      animationType="fade"
      transparent
      statusBarTranslucent
      presentationStyle="overFullScreen"
      onRequestClose={() => {}}
    >
      <View
        className="flex-1 items-center justify-center px-8"
        style={{ backgroundColor: cpcHex.background }}
        accessibilityRole="progressbar"
        accessibilityLabel={modeSwitchCopy(target)}
      >
        <View
          className="mb-6 h-14 w-14 items-center justify-center rounded-full"
          style={{ backgroundColor: `${accent}22` }}
        >
          <ActivityIndicator size="large" color={accent} />
        </View>
        <Text
          className="text-center font-display text-titleSmall uppercase"
          style={{ color: accent, letterSpacing: 1.2 }}
        >
          {modeSwitchCopy(target)}
        </Text>
      </View>
    </Modal>
  );
}
