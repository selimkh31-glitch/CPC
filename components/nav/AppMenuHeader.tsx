import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Menu } from "lucide-react-native";
import { Avatar } from "@/components/ui/Avatar";
import { AppMenuSheet } from "@/components/nav/AppMenuSheet";
import { ModeSegmentToggle } from "@/components/nav/ModeSegmentToggle";
import { useAuth } from "@/lib/providers/AuthProvider";
import { useAppMode } from "@/lib/providers/AppModeProvider";
import { cpcHex } from "@/lib/design/cpc-native";
import { cpcTokens } from "@/lib/design/cpc-tokens";

/**
 * Chrome authentifié : hamburger, marque, avatar, bascule Joueur | Club.
 * La bascule est le seul switch de mode (pas un setMode caché dans un CTA).
 */
export function AppMenuHeader() {
  const { profile } = useAuth();
  const { mode } = useAppMode();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const username = profile?.username?.trim() || "CPC";

  const goIdentity = () => {
    if (mode === "CLUB") {
      router.push("/effectif");
      return;
    }
    router.push("/profile");
  };

  return (
    <View
      className="border-b border-border bg-bg px-3 pt-1"
      style={{ justifyContent: "center" }}
    >
      <View
        className="flex-row items-center justify-between"
        style={{ minHeight: cpcTokens.geometry.header }}
      >
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
          onPress={goIdentity}
          accessibilityRole="button"
          accessibilityLabel={mode === "CLUB" ? "Ouvrir l'identité du club" : "Ouvrir mon profil"}
          hitSlop={8}
          className="h-11 min-w-[44px] items-center justify-center"
        >
          <Avatar username={username} size="sm" />
        </Pressable>
      </View>
      <View className="pb-2">
        <ModeSegmentToggle compact />
      </View>
      <AppMenuSheet visible={open} onClose={() => setOpen(false)} />
    </View>
  );
}

export function AppHeader() {
  return <AppMenuHeader />;
}
