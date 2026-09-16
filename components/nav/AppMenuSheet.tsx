import { InteractionManager, Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, type Href } from "expo-router";
import { X } from "lucide-react-native";
import { cpcHex } from "@/lib/design/cpc-native";
import { cpcTokens } from "@/lib/design/cpc-tokens";
import { useAuth } from "@/lib/providers/AuthProvider";
import { useAppMode } from "@/lib/providers/AppModeProvider";
import { FEATURE_REVENUECAT, profileProEntryCopy } from "@/lib/constants";
import { ModeSegmentToggle } from "@/components/nav/ModeSegmentToggle";
import { useOpenMonClub } from "@/lib/hooks/useOpenMonClub";

/**
 * Menu unique — Profil, Réglages, Chat, Mon club, Pro.
 * Bascule Joueur | Club en bas du tiroir. Pas deux lignes club.
 */
export function AppMenuSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const { mode, setMode } = useAppMode();
  const proEntry = profileProEntryCopy(FEATURE_REVENUECAT);
  const showPro = profile?.plan !== "PRO";
  const { openMonClub } = useOpenMonClub();

  const go = (href: Href, nextMode?: "PLAYER" | "CLUB") => {
    onClose();
    const push = () => router.push(href);
    if (nextMode && mode !== nextMode) {
      setMode(nextMode);
      InteractionManager.runAfterInteractions(push);
      return;
    }
    push();
  };

  const openProfile = () => go("/profile", "PLAYER");

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View className="flex-1 flex-row" style={{ backgroundColor: cpcHex.overlay }}>
        <View className="h-full w-[84%] max-w-[320px] bg-bg-card" style={{ paddingTop: Math.max(insets.top, 12) }}>
          <View className="flex-row items-center justify-between px-5 pb-4">
            <Text className="font-display text-titleSmall text-fg">Menu</Text>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              className="min-h-[44px] min-w-[44px] items-center justify-center"
              accessibilityRole="button"
              accessibilityLabel="Fermer"
            >
              <X size={20} color={cpcHex.textMuted} />
            </Pressable>
          </View>
          <View className="flex-1 px-3 pb-6 pt-2">
            <MenuRow label="Profil" onPress={openProfile} />
            <MenuRow label="Réglages" onPress={() => go("/settings")} />
            <MenuRow label="Chat" onPress={() => go("/conversations")} />
            <MenuRow
              label="Mon club"
              onPress={() => {
                onClose();
                openMonClub();
              }}
            />
            {showPro ? <MenuRow label={proEntry.title} onPress={() => go("/pricing")} /> : null}
          </View>
          <ModeSegmentToggle onPicked={onClose} bottomInset={insets.bottom} />
        </View>
        <Pressable className="flex-1" onPress={onClose} accessibilityRole="button" accessibilityLabel="Fermer" />
      </View>
    </Modal>
  );
}

function MenuRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="min-h-[48px] justify-center px-3 py-3 active:bg-white/[0.04]"
      style={{ minHeight: cpcTokens.geometry.buttonLarge, borderRadius: cpcTokens.radius.control }}
    >
      <Text className="font-sans-medium text-action text-fg">{label}</Text>
    </Pressable>
  );
}
