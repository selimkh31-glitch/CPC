import { useState } from "react";
import { InteractionManager, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Menu } from "lucide-react-native";
import { Avatar } from "@/components/ui/Avatar";
import { AppMenuSheet } from "@/components/nav/AppMenuSheet";
import { useAuth } from "@/lib/providers/AuthProvider";
import { useAppMode } from "@/lib/providers/AppModeProvider";
import { cpcHex } from "@/lib/design/cpc-native";
import { cpcTokens } from "@/lib/design/cpc-tokens";

/**
 * Chrome authentifié CPC : hamburger, marque, avatar.
 * Hamburger à gauche ouvre le menu, avatar à droite ouvre /profile.
 */
export function AppMenuHeader() {
  const { profile } = useAuth();
  const { mode, setMode } = useAppMode();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const username = profile?.username?.trim() || "CPC";

  const goProfile = () => {
    if (mode === "CLUB") {
      setMode("PLAYER");
      InteractionManager.runAfterInteractions(() => {
        router.push("/profile");
      });
      return;
    }
    router.push("/profile");
  };

  return (
    <View
      className="border-b border-border bg-bg px-3"
      style={{ minHeight: cpcTokens.geometry.header, justifyContent: "center" }}
    >
      <View className="flex-row items-center justify-between">
        <Pressable
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Ouvrir le menu"
          hitSlop={10}
          className="h-11 w-11 items-center justify-center"
        >
          <Menu size={cpcTokens.icon.lg} color={cpcHex.textPrimary} />
        </Pressable>
        <Text
          className="font-display text-lg uppercase text-fg"
          style={{ letterSpacing: cpcTokens.font.letterSpacing.brand }}
        >
          Club<Text className="text-accent">Pro</Text>
        </Text>
        <Pressable
          onPress={goProfile}
          accessibilityRole="button"
          accessibilityLabel="Ouvrir mon profil"
          hitSlop={8}
          className="h-11 min-w-[44px] items-center justify-center"
        >
          <Avatar username={username} size="sm" />
        </Pressable>
      </View>
      <AppMenuSheet visible={open} onClose={() => setOpen(false)} />
    </View>
  );
}

export function AppHeader() {
  return <AppMenuHeader />;
}
