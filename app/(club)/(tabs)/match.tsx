import { ClubLiveFeuille } from "@/components/club/ClubLiveFeuille";

/**
 * Deep link `/match` — même feuille que l'onglet LIVE (pas une 2e UI).
 * Hors tab bar (`href: null`).
 */
export default function MatchTab() {
  return <ClubLiveFeuille />;
}
