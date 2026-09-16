import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { AppShell } from "@/components/nav/AppShell";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { useAuth } from "@/lib/providers/AuthProvider";
import { cpcTokens } from "@/lib/design/cpc-tokens";

/**
 * Réglages — uniquement les actions déjà existantes.
 * Pas de nouveaux réglages inventés.
 */
export default function SettingsScreen() {
  const { signOut } = useAuth();

  return (
    <AppShell contentContainerStyle={{ gap: 24 }}>
      <SurfaceCard style={{ padding: 0 }}>
        <SettingsRow label="Modifier le profil" onPress={() => router.push("/edit-profile")} />
        <SettingsRow last label="Joueurs bloqués" onPress={() => router.push("/blocked")} />
      </SurfaceCard>
      <SurfaceCard style={{ padding: 0 }}>
        <SettingsRow
          label="Déconnexion"
          danger
          last
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            signOut();
          }}
        />
      </SurfaceCard>
    </AppShell>
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
      className={`min-h-[52px] justify-center px-4 py-3.5 ${last ? "" : "border-b border-border"}`}
      style={{ minHeight: cpcTokens.geometry.buttonLarge }}
    >
      <Text className={`font-sans-medium text-action ${danger ? "text-danger" : "text-fg"}`}>{label}</Text>
    </Pressable>
  );
}
