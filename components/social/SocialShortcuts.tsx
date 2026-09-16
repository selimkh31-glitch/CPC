import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Ban, MessageCircle, Users } from "lucide-react-native";
import { cpcHex } from "@/lib/design/cpc-native";
import { cpcTokens } from "@/lib/design/cpc-tokens";

/**
 * Raccourcis stack (pas un 4e onglet) : Messages, Groupes, Bloqués.
 * Réutilisé profil Joueur et onglet Club.
 */
export function SocialShortcuts() {
  return (
    <View className="gap-2">
      <View className="flex-row gap-2">
        <Pressable
          onPress={() => router.push("/conversations")}
          accessibilityRole="button"
          accessibilityLabel="Messages"
          className="min-h-[44px] flex-1 flex-row items-center justify-center gap-1.5 border border-border bg-bg-elevated px-3 active:opacity-80"
          style={{ borderRadius: cpcTokens.radius.control }}
        >
          <MessageCircle size={cpcTokens.icon.sm} color={cpcHex.textPrimary} />
          <Text className="font-sans-bold text-body text-fg">Messages</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push("/groups")}
          accessibilityRole="button"
          accessibilityLabel="Groupes"
          className="min-h-[44px] flex-1 flex-row items-center justify-center gap-1.5 border border-border bg-bg-elevated px-3 active:opacity-80"
          style={{ borderRadius: cpcTokens.radius.control }}
        >
          <Users size={cpcTokens.icon.sm} color={cpcHex.textPrimary} />
          <Text className="font-sans-bold text-body text-fg">Groupes</Text>
        </Pressable>
      </View>
      <Pressable
        onPress={() => router.push("/blocked")}
        accessibilityRole="button"
        accessibilityLabel="Joueurs bloqués"
        className="min-h-[44px] flex-row items-center justify-center gap-1.5 border border-border bg-bg-elevated px-3 active:opacity-80"
        style={{ borderRadius: cpcTokens.radius.control }}
      >
        <Ban size={cpcTokens.icon.sm} color={cpcHex.textPrimary} />
        <Text className="font-sans-bold text-body text-fg">Bloqués</Text>
      </Pressable>
    </View>
  );
}
