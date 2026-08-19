import { useLocalSearchParams } from "expo-router";
import { ClubHome } from "@/components/club/ClubHome";

/**
 * Wrapper fin autour de ClubHome (source unique de l'expérience club) — garde
 * le header natif + retour du Stack racine (app/_layout.tsx) pour les entrées
 * externes : dashboard "Feuille de match", page publique d'un club, raccourci
 * "Mes clubs" du profil. Aucune logique ici : tout vit dans ClubHome.
 */
export default function MatchSheetScreen() {
  const { clubId } = useLocalSearchParams<{ clubId: string }>();
  return <ClubHome clubId={clubId ?? null} />;
}
