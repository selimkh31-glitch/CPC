import { Pressable, Text } from "react-native";
import * as Haptics from "expo-haptics";
import { useAppMode } from "@/lib/providers/AppModeProvider";
import { MODE_DOOR_COPY, type AppMode } from "@/lib/appMode";
import { cn } from "@/lib/utils";
import type { ClubRole, ClubRow } from "@/lib/types";

/**
 * Unique bascule Joueur ↔ Manager — Profil (joueur) et onglet Club (manager).
 * Pas dans la tab bar / LIVE / Recrutement. Un tap, mode persisté.
 */
export function ModeLifeToggle({
  target,
  managedClubs,
  className,
}: {
  target: AppMode;
  managedClubs?: { role: ClubRole; club: ClubRow }[];
  className?: string;
}) {
  const { setMode, setSelectedManagedClubId } = useAppMode();
  const label = target === "CLUB" ? MODE_DOOR_COPY.toManager : MODE_DOOR_COPY.toPlayer;

  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        if (target === "CLUB" && managedClubs?.length === 1) {
          setSelectedManagedClubId(managedClubs[0].club.id);
        }
        setMode(target);
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      className={cn("min-h-[48px] justify-center self-start", className)}
    >
      <Text className="text-base font-bold text-accent">{label}</Text>
    </Pressable>
  );
}
