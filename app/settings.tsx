import { Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/lib/providers/AuthProvider";

/**
 * Réglages — uniquement les actions déjà existantes.
 * Pas de nouveaux réglages inventés.
 */
export default function SettingsScreen() {
  const { signOut } = useAuth();

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <View className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03]">
        <SettingsRow label="Modifier le profil" onPress={() => router.push("/edit-profile")} />
        <SettingsRow last label="Joueurs bloqués" onPress={() => router.push("/blocked")} />
      </View>
      <View className="mt-6 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03]">
        <SettingsRow
          label="Déconnexion"
          danger
          last
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            signOut();
          }}
        />
      </View>
    </ScrollView>
  );
}

function SettingsRow({
  label,
  onPress,
  danger,
  last,
}: {
  label: string;
  onPress: () => void;
  danger?: boolean;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className={`min-h-[52px] justify-center px-4 py-3.5 ${last ? "" : "border-b border-white/[0.06]"}`}
    >
      <Text className={`text-[16px] ${danger ? "font-medium text-danger" : "font-medium text-fg"}`}>{label}</Text>
    </Pressable>
  );
}
