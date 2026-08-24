/**
 * Matching LIVE déterministe (P1) — PAS l'égalité username EA.
 * Source unique app + Edge (réexport `lib/liveMatch.ts`).
 *
 * Critères tous obligatoires pour `eligible` :
 *   1. LIVE club actif (is_live + expires_at > now)
 *   2. Club need : needed_positions non vide
 *   3. Poste joueur ∈ besoin (principal > secondaire)
 *   4. Plateforme owner du club === plateforme joueur
 */
export interface LiveMatchPlayer {
  mainPosition: string;
  secondaryPositions: string[];
  platform: string;
}

export interface LiveMatchClub {
  clubId: string;
  sessionId: string;
  neededPositions: string[];
  platform: string | null;
  is_live: boolean;
  expires_at: string | null;
}

export interface LiveMatchResult {
  clubId: string;
  sessionId: string;
  score: number;
  eligible: boolean;
  reasons: string[];
  blockers: string[];
  reason: string;
}

function isClubLive(club: LiveMatchClub, nowMs: number): boolean {
  if (!club.is_live || !club.expires_at) return false;
  const t = new Date(club.expires_at).getTime();
  return Number.isFinite(t) && t > nowMs;
}

export function matchLivePlayerToClub(
  player: LiveMatchPlayer,
  club: LiveMatchClub,
  nowMs: number
): LiveMatchResult {
  const reasons: string[] = [];
  const blockers: string[] = [];
  let score = 0;

  if (!isClubLive(club, nowMs)) {
    blockers.push("LIVE club expiré");
  }

  const needed = club.neededPositions ?? [];
  if (needed.length === 0) {
    blockers.push("aucun poste recherché");
  }

  const mainHit = needed.includes(player.mainPosition);
  const secondaryHit = (player.secondaryPositions ?? []).some((p) => needed.includes(p));
  if (mainHit) {
    score += 50;
    reasons.push(`poste recherché (${player.mainPosition})`);
  } else if (secondaryHit) {
    score += 30;
    reasons.push("poste secondaire recherché");
  } else if (needed.length > 0) {
    blockers.push("poste hors besoin du club");
  }

  if (!club.platform) {
    blockers.push("plateforme du club inconnue");
  } else if (club.platform !== player.platform) {
    blockers.push(`plateforme différente (${club.platform})`);
  } else {
    score += 50;
    reasons.push(`même plateforme (${player.platform})`);
  }

  const eligible = blockers.length === 0;
  return {
    clubId: club.clubId,
    sessionId: club.sessionId,
    score: eligible ? Math.min(100, score) : 0,
    eligible,
    reasons,
    blockers,
    reason: eligible ? reasons.join(" · ") : blockers.join(" · "),
  };
}

export function rankLiveClubsForPlayer(
  player: LiveMatchPlayer,
  clubs: LiveMatchClub[],
  nowMs: number
): LiveMatchResult[] {
  return clubs
    .map((club) => matchLivePlayerToClub(player, club, nowMs))
    .filter((row) => row.eligible)
    .sort((a, b) => b.score - a.score);
}

export function isPlayerCompatibleWithClubNeed(
  player: LiveMatchPlayer,
  club: Pick<LiveMatchClub, "neededPositions" | "platform" | "is_live" | "expires_at">,
  nowMs: number
): boolean {
  return matchLivePlayerToClub(player, { ...club, clubId: "", sessionId: "" }, nowMs).eligible;
}
