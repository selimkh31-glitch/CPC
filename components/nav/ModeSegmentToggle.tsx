import { Pressable, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/lib/providers/AuthProvider";
import { useAppMode } from "@/lib/providers/AppModeProvider";
import { useMyMemberships } from "@/lib/hooks/useClubs";
import { useModeAccent } from "@/lib/theme";
import { splitMemberships } from "@/lib/monClubNav";
import type { AppMode } from "@/lib/appMode";

/**
 * Bascule Joueur | Club — même setMode que le tiroir.
 * Sur Matchmaking (sous le titre / bas du scroll) et dans AppMenuSheet.
 */
export function ModeSegmentToggle({
  onPicked,
  bottomInset,
}: {
  onPicked?: () => void;
  bottomInset?: number;
}) {
  const { session } = useAuth();
  const { mode, setMode, setSelectedManagedClubId } = useAppMode();
  const { data: memberships } = useMyMemberships(session?.user.id ?? null);
  const accent = useModeAccent();
  const active = mode === "CLUB" ? "CLUB" : "PLAYER";

  const pick = (next: AppMode) => {
    Haptics.selectionAsync();
    if (next === "CLUB") {
      const { managed } = splitMemberships(memberships);
      if (managed.length === 1) setSelectedManagedClubId(managed[0].club.id);
    }
    setMode(next);
    onPicked?.();
  };

  return (
    <View
      className={bottomInset != null ? "border-t border-white/[0.06] px-4 pt-4" : undefined}
      style={bottomInset != null ? { paddingBottom: Math.max(bottomInset, 20) } : undefined}
    >
      <View className="flex-row rounded-full border border-white/10 bg-white/[0.03] p-1">
        {(["PLAYER", "CLUB"] as const).map((key) => {
          const selected = active === key;
          const label = key === "PLAYER" ? "Joueur" : "Club";
          return (
            <Pressable
              key={key}
              onPress={() => pick(key)}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={{ selected }}
              className="min-h-[44px] flex-1 items-center justify-center rounded-full"
              style={selected ? { backgroundColor: accent } : undefined}
            >
              <Text className={`text-sm font-bold ${selected ? "text-bg" : "text-fg-muted"}`}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
