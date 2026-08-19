import * as Haptics from "expo-haptics";
import type { MatchOutcome } from "@/lib/types";

/**
 * Conventions haptiques Cinematic (audit G.1 section I, spec G.2 section 6) —
 * un point d'appel unique par intention plutôt que des choix de style
 * dispersés et incohérents écran par écran. Les hooks/écrans existants
 * (lib/hooks/useMatchCheckin.ts, components/club/MatchCheckinPanel.tsx)
 * continuent d'appeler expo-haptics directement — NON modifiés dans cette
 * phase (parcours actuel intouché) ; ces helpers sont destinés aux futurs
 * écrans Cinematic (G.3+).
 */
export const cinematicHaptics = {
  /** Pression d'une action neutre/secondaire — léger, cohérent partout. */
  press: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  /** Action confirmée avec succès (hors résultat de match, voir `outcome`). */
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  /** Erreur/échec d'une action. */
  error: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
  /** Bascule en LIVE — un impact net et unique ; jamais de vibration en
   *  boucle (le pulse de LiveIndicator porte la continuité visuelle seul). */
  live: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  /**
   * Résultat révélé — différencié par issue (audit G.1 section I) : WIN net
   * et affirmé, DRAW neutre, LOSS sobre et retenu. Jamais d'effet
   * infantilisant sur une défaite (consigne explicite G.2 section 6).
   */
  outcome: (outcome: MatchOutcome) => {
    if (outcome === "WIN") return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (outcome === "LOSS") return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  },
};
