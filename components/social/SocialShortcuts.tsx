import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Ban, MessageCircle, Users } from "lucide-react-native";

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
          className="min-h-[44px] flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border border-border bg-bg-elevated px-3 active:opacity-80"
        >
          <MessageCircle size={16} color="#f4f5f7" />
          <Text className="font-bold text-fg">Messages</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push("/groups")}
          accessibilityRole="button"
          accessibilityLabel="Groupes"
          className="min-h-[44px] flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border border-border bg-bg-elevated px-3 active:opacity-80"
        >
          <Users size={16} color="#f4f5f7" />
          <Text className="font-bold text-fg">Groupes</Text>
        </Pressable>
      </View>
      <Pressable
        onPress={() => router.push("/blocked")}
        accessibilityRole="button"
        accessibilityLabel="Joueurs bloqués"
        className="min-h-[44px] flex-row items-center justify-center gap-1.5 rounded-xl border border-border bg-bg-elevated px-3 active:opacity-80"
      >
        <Ban size={16} color="#f4f5f7" />
        <Text className="font-bold text-fg">Bloqués</Text>
      </Pressable>
    </View>
  );
}
