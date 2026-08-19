import { useEffect, useState } from "react";

/**
 * Chrono UI pur (Phase G.3, section 5) — jamais une donnée métier : dérive
 * uniquement le temps écoulé depuis `launchedAt` (ISO, source de vérité =
 * match_checkins.launched_at, lu via useActiveMatchCheckin — hook inchangé)
 * pour l'affichage de l'écran LIVE. Recalculé à chaque montage/changement de
 * `launchedAt` à partir de l'horloge réelle, jamais d'un compteur local qui
 * repartirait de zéro — correct par construction après reload/navigation
 * (rien à restaurer, juste à recalculer). Nettoyé au unmount.
 */
export function useElapsedSeconds(launchedAt: string | null): number {
  const [elapsed, setElapsed] = useState(() => computeElapsed(launchedAt));

  useEffect(() => {
    setElapsed(computeElapsed(launchedAt));
    if (!launchedAt) return;
    const id = setInterval(() => setElapsed(computeElapsed(launchedAt)), 1000);
    return () => clearInterval(id);
  }, [launchedAt]);

  return elapsed;
}

function computeElapsed(launchedAt: string | null): number {
  if (!launchedAt) return 0;
  const seconds = Math.floor((Date.now() - new Date(launchedAt).getTime()) / 1000);
  return Math.max(0, seconds);
}

/** Format MM:SS — MM peut dépasser 59 sans jamais boucler (un match peut durer). */
export function formatElapsed(totalSeconds: number): string {
  const mm = Math.floor(totalSeconds / 60);
  const ss = totalSeconds % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

/**
 * Phase G.3.2 — formulation volontairement grossière (minutes entières, pas
 * MM:SS) et contextuelle : `launched_at` n'est PAS un coup d'envoi réel (voir
 * audit G.3.1 section B), donc jamais présenté avec la hiérarchie visuelle
 * d'un chrono de match. Un vrai chrono par mi-temps arrivera avec le Match
 * Clock Engine (G.3.4, kickoff_at) — cette fonction sera alors remplacée
 * (ou complétée), pas cette phase.
 */
export function formatSinceMinutes(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  if (minutes <= 0) return "Lancé à l'instant";
  if (minutes === 1) return "Depuis 1 min";
  return `Depuis ${minutes} min`;
}
