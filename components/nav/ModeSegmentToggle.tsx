import { Pressable, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/lib/providers/AuthProvider";
import { useAppMode } from "@/lib/providers/AppModeProvider";
import { useMyMemberships } from "@/lib/hooks/useClubs";
import { MODE_ACCENT } from "@/lib/theme";
import { splitMemberships } from "@/lib/monClubNav";
import type { AppMode } from "@/lib/appMode";

/**
 * Petite bascule Joueur | Club — hamburger seulement.
 * switchMode = overlay puis autre shell. Pas dans le header / tabs / LIVE.
 */
export function ModeSegmentToggle({ onPicked }: { onPicked?: () => void }) {
  const { session } = useAuth();
  const { mode, switchMode, setSelectedManagedClubId } = useAppMode();
  const { data: memberships } = useMyMemberships(session?.user.id ?? null);
  const active = mode === "CLUB" ? "CLUB" : "PLAYER";

  const pick = (next: AppMode) => {
    if (next !== active) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      if (next === "CLUB") {
        const { managed } = splitMemberships(memberships);
        if (managed.length === 1) setSelectedManagedClubId(managed[0].club.id);
      }
      switchMode(next);
    }
    onPicked?.();
  };

  return (
    <View>
      <Text className="mb-2 px-1 font-sans text-caption uppercase text-fg-subtle">Mode</Text>
      <View className="flex-row self-start rounded-full border border-white/10 bg-white/[0.03] p-0.5">
        {(["PLAYER", "CLUB"] as const).map((key) => {
          const selected = active === key;
          const label = key === "PLAYER" ? "Joueur" : "Club";
          const a11y = key === "PLAYER" ? "Mode joueur" : "Mode club";
          const accent = MODE_ACCENT[key];
          return (
            <Pressable
              key={key}
              onPress={() => pick(key)}
              accessibilityRole="button"
              accessibilityLabel={a11y}
              accessibilityState={{ selected }}
              className="min-h-[28px] items-center justify-center rounded-full px-3"
              style={selected ? { backgroundColor: accent } : undefined}
            >
              <Text className={`text-xs font-bold ${selected ? "text-accent-fg" : "text-fg-muted"}`}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
