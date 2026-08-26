import { useState } from "react";
import { InteractionManager, Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { Menu } from "lucide-react-native";
import { Avatar } from "@/components/ui/Avatar";
import { AppMenuSheet } from "@/components/nav/AppMenuSheet";
import { useAuth } from "@/lib/providers/AuthProvider";
import { useAppMode } from "@/lib/providers/AppModeProvider";

/**
 * Chrome authentifié : hamburger à gauche ouvre le menu,
 * avatar à droite ouvre /profile. Pas les deux collés à gauche.
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
    <View className="border-b border-white/[0.06] bg-bg px-3 py-1">
      <View className="flex-row items-center justify-between">
        <Pressable
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Ouvrir le menu"
          hitSlop={10}
          className="h-11 w-11 items-center justify-center"
        >
          <Menu size={22} color="#f4f5f7" />
        </Pressable>
        <Pressable
          onPress={goProfile}
          accessibilityRole="button"
          accessibilityLabel="Ouvrir mon profil"
          hitSlop={8}
          className="h-11 items-center justify-center"
        >
          <Avatar username={username} size="sm" />
        </Pressable>
      </View>
      <AppMenuSheet visible={open} onClose={() => setOpen(false)} />
    </View>
  );
}
