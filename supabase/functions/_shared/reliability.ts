/**
 * Trust Engine — calcul du score de fiabilité (reliability_score).
 *
 * SOURCE DE VÉRITÉ UNIQUE : ce fichier est la seule implémentation. Les Edge
 * Functions l'importent directement (`../_shared/reliability.ts`, chemin
 * interne à `supabase/functions/`) ; l'app mobile l'importe indirectement via
 * `lib/reliability.ts`, qui ne fait que réexporter ce module (voir ce fichier
 * pour l'explication du choix d'emplacement). Ne jamais dupliquer cette
 * logique ailleurs — un seul endroit à modifier pour changer la formule.
 *
 * Formule de base (section 9 du brief) :
 *   base = (moyenne_behavior * 0.6) + (moyenne_skill * 0.4)
 *
 * Enrichissement hybride :
 *   - régularité : bonus/malus selon le streak de sessions honorées d'affilée
 *     (plafonné pour ne pas écraser le comportement/skill).
 *   - performance vérifiée EA (si stats liées) : bonus basé sur le ratio de
 *     matchs joués récemment vs. no-shows détectés côté EA, quand disponible.
 *
 * Le score final est ramené sur une échelle 0-100 pour l'affichage (ClubPro Card,
 * classement des candidatures) ; il reste dérivé à tout moment des reviews +
 * streak + stats EA, jamais saisi manuellement.
 */

export interface ReliabilityInputs {
  reviews: Array<{ ratingSkill: number; ratingBehavior: number; showedUp: boolean }>;
  currentStreak: number;
  verifiedStats?: { matchesPlayedRecent?: number; noShowsDetected?: number } | null;
}

const STREAK_BONUS_PER_SESSION = 0.4; // points de score par session de streak
const STREAK_BONUS_CAP = 8; // plafond du bonus de régularité
const EA_BONUS_CAP = 6; // plafond du bonus de performance vérifiée

export function computeReliabilityScore({
  reviews,
  currentStreak,
  verifiedStats,
}: ReliabilityInputs): number {
  if (reviews.length === 0 && currentStreak === 0 && !verifiedStats) {
    return 0;
  }

  const skillAvg =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.ratingSkill, 0) / reviews.length
      : 3; // valeur neutre si aucune review
  const behaviorAvg =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.ratingBehavior, 0) / reviews.length
      : 3;

  // Base sur 5 -> ramenée sur 100.
  const base = (behaviorAvg * 0.6 + skillAvg * 0.4) * 20;

  const streakBonus = Math.min(currentStreak * STREAK_BONUS_PER_SESSION, STREAK_BONUS_CAP);

  let eaBonus = 0;
  if (verifiedStats?.matchesPlayedRecent && verifiedStats.matchesPlayedRecent > 0) {
    const noShows = verifiedStats.noShowsDetected ?? 0;
    const showRatio = Math.max(
      0,
      1 - noShows / (verifiedStats.matchesPlayedRecent + noShows)
    );
    eaBonus = showRatio * EA_BONUS_CAP;
  }

  const score = base + streakBonus + eaBonus;
  return Math.max(0, Math.min(100, Math.round(score * 10) / 10));
}

/** Met à jour le streak après le check post-session ("présent / a lâché / bon esprit"). */
export function nextStreak(currentStreak: number, showedUp: boolean): number {
  return showedUp ? currentStreak + 1 : 0;
}

/** Seuils de badges de streak affichés sur la ClubPro Card. */
export const STREAK_BADGES = [
  { threshold: 5, id: "streak_5", label: "Fiable x5" },
  { threshold: 10, id: "streak_10", label: "Pilier x10" },
  { threshold: 25, id: "streak_25", label: "Légende x25" },
] as const;

export function streakBadgesEarned(streak: number): string[] {
  return STREAK_BADGES.filter((b) => streak >= b.threshold).map((b) => b.id);
}
