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
    <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <SettingsRow label="Modifier le profil" onPress={() => router.push("/edit-profile")} />
      <SettingsRow label="Joueurs bloqués" onPress={() => router.push("/blocked")} />
      <SettingsRow
        label="Déconnexion"
        danger
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          signOut();
        }}
      />
    </ScrollView>
  );
}

function SettingsRow({ label, onPress, danger }: { label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="min-h-[44px] justify-center border-b border-border py-3"
    >
      <Text className={`text-base font-bold ${danger ? "text-danger" : "text-fg"}`}>{label}</Text>
    </Pressable>
  );
}
