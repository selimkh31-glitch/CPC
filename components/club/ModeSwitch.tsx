import { Pressable, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { useAppMode } from "@/lib/providers/AppModeProvider";
import type { ClubRole, ClubRow } from "@/lib/types";

/**
 * Switch explicite Mode Joueur <-> Mode Club (Foundation #1). Rendu par
 * l'appelant uniquement s'il a des données de memberships (jamais monté à
 * l'aveugle) — mais se masque lui-même si `managedClubs` est vide, pour ne
 * jamais l'afficher à un MEMBER pur, conformément à la règle produit.
 *
 * Change UNIQUEMENT l'état `mode`/`selectedManagedClubId` du AppModeProvider —
 * aucune navigation impérative (router.push/replace). Le Stack.Protected
 * racine (app/_layout.tsx) réagit seul au changement de mode, exactement
 * comme le fait déjà le guard d'authentification pour session/profile.
 *
 * Sélection du club en passant en CLUB : jamais un `[0]` implicite — 1 seul
 * club géré => sélection directe (non ambiguë) ; plusieurs => laissé `null`,
 * c'est app/(club)/_layout.tsx qui affichera alors le sélecteur explicite.
 */
export function ModeSwitch({ managedClubs }: { managedClubs: { role: ClubRole; club: ClubRow }[] }) {
  const { mode, setMode, setSelectedManagedClubId } = useAppMode();

  if (managedClubs.length === 0) return null;

  const switchTo = (next: "PLAYER" | "CLUB") => {
    if (next === mode) return;
    Haptics.selectionAsync();
    if (next === "CLUB" && managedClubs.length === 1) {
      setSelectedManagedClubId(managedClubs[0].club.id);
    }
    setMode(next);
  };

  return (
    <View className="flex-row self-start rounded-2xl border border-border bg-bg-elevated p-1">
      <Pressable
        onPress={() => switchTo("PLAYER")}
        className={`min-h-[44px] items-center justify-center rounded-xl px-4 ${mode === "PLAYER" ? "bg-accent" : ""}`}
      >
        <Text className={`text-sm font-bold ${mode === "PLAYER" ? "text-bg" : "text-fg-muted"}`}>Joueur</Text>
      </Pressable>
      <Pressable
        onPress={() => switchTo("CLUB")}
        className={`min-h-[44px] items-center justify-center rounded-xl px-4 ${mode === "CLUB" ? "bg-accent" : ""}`}
      >
        <Text className={`text-sm font-bold ${mode === "CLUB" ? "text-bg" : "text-fg-muted"}`}>Club</Text>
      </Pressable>
    </View>
  );
}
