import { useState } from "react";
import { Pressable, View } from "react-native";
import { Menu } from "lucide-react-native";
import { Avatar } from "@/components/ui/Avatar";
import { AppMenuSheet } from "@/components/nav/AppMenuSheet";
import { useAuth } from "@/lib/providers/AuthProvider";

/**
 * Chrome authentifié : hamburger puis avatar (initiales).
 * Un tap sur l'un ou l'autre ouvre le même menu.
 */
export function AppMenuHeader() {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const username = profile?.username?.trim() || "CPC";

  return (
    <View className="px-4 pb-1">
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Menu"
        className="min-h-[44px] flex-row items-center gap-2 self-start py-1"
      >
        <View className="min-h-[44px] min-w-[44px] items-center justify-center">
          <Menu size={22} color="#f4f5f7" />
        </View>
        <Avatar username={username} size="md" />
      </Pressable>
      <AppMenuSheet visible={open} onClose={() => setOpen(false)} />
    </View>
  );
}
