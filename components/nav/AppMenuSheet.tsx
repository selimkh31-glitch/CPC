import { InteractionManager, Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, type Href } from "expo-router";
import { X } from "lucide-react-native";
import { useAuth } from "@/lib/providers/AuthProvider";
import { useAppMode } from "@/lib/providers/AppModeProvider";
import { useMyMemberships } from "@/lib/hooks/useClubs";
import { FEATURE_REVENUECAT, profileProEntryCopy } from "@/lib/constants";
import { playerInvitationAcceptHref } from "@/lib/recruitment";

/**
 * Menu unique — Profil, Réglages, Chat, les deux vues club, Pro.
 * Rien d'autre dans cette liste.
 */
export function AppMenuSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { session, profile } = useAuth();
  const { mode, setMode, setSelectedManagedClubId } = useAppMode();
  const { data: memberships } = useMyMemberships(session?.user.id ?? null);
  const proEntry = profileProEntryCopy(FEATURE_REVENUECAT);
  const showPro = profile?.plan !== "PRO";

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

  const openPlayerClub = () => {
    const member = memberships?.find((m) => m.role === "MEMBER") ?? memberships?.[0];
    if (!member?.club?.id) {
      go("/clubs", "PLAYER");
      return;
    }
    go(playerInvitationAcceptHref(member.club.id) as Href, "PLAYER");
  };

  const openManagerClub = () => {
    onClose();
    const managed = memberships?.filter((m) => m.role === "OWNER" || m.role === "MANAGER") ?? [];
    if (managed.length === 1) setSelectedManagedClubId(managed[0].club.id);
    if (mode !== "CLUB") {
      setMode("CLUB");
      return;
    }
    router.push("/(club)/(tabs)");
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View className="flex-1 flex-row bg-black/50">
        <View className="w-[84%] max-w-[320px] bg-bg-card" style={{ paddingTop: Math.max(insets.top, 12) }}>
          <View className="flex-row items-center justify-between px-4 pb-2">
            <Text className="font-display text-lg text-fg">Menu</Text>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              className="min-h-[44px] min-w-[44px] items-center justify-center"
              accessibilityRole="button"
              accessibilityLabel="Fermer"
            >
              <X size={20} color="#9aa0a8" />
            </Pressable>
          </View>
          <View className="px-2 pb-4">
            <MenuRow label="Profil" onPress={openProfile} />
            <MenuRow label="Réglages" onPress={() => go("/settings")} />
            <MenuRow label="Chat" onPress={() => go("/conversations")} />
            <MenuRow label="Mon club (joueur)" onPress={openPlayerClub} />
            <MenuRow label="Mon club (manager)" onPress={openManagerClub} />
            {showPro ? <MenuRow label={proEntry.title} onPress={() => go("/pricing")} /> : null}
          </View>
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
      className="min-h-[44px] justify-center rounded-xl px-3 py-2 active:bg-bg-elevated"
    >
      <Text className="text-base font-bold text-fg">{label}</Text>
    </Pressable>
  );
}
