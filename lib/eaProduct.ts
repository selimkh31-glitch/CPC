/**
 * Contrat lecture FC 27 (club / joueur / match) pour l'UX PR.
 * Miroir des vues Edge `supabase/functions/_shared/ea/display.ts`.
 * Pas d'import ingest : le client ne voit pas les lignes brutes ni les clés persona.
 * Listes vides = ledger produit vide (avant cutover 25 Sep 2026, ou club sans ingest fc27).
 */

/** Ledger produit CPC — toujours fc27, jamais un mix fc26. */
export const PRODUCT_EA_TITLE = "fc27";

export const EA_PRODUCT_HISTORY_QUERY_KEY = "ea-product-history" as const;

export interface EaProductClubView {
  eaClubId: string;
  name: string | null;
  crestId: string | null;
  wins: number | null;
  losses: number | null;
  draws: number | null;
  gamesPlayed: number | null;
}

export interface EaProductMemberView {
  playername: string;
  proPosition: string | null;
  proName: string | null;
  gamesPlayed: number | null;
  goals: number | null;
  assists: number | null;
  ratingAve: number | null;
  careerGamesPlayed: number | null;
  careerGoals: number | null;
  careerAssists: number | null;
}

export interface EaProductMatchPlayerView {
  name: string;
  goals: number;
  assists: number;
  rating: number | null;
}

export interface EaProductMatchView {
  eaMatchId: string;
  matchType: string;
  playedAt: string | null;
  players: EaProductMatchPlayerView[];
}

export interface EaProductPlayerView {
  member: EaProductMemberView | null;
  matches: EaProductMatchView[];
}

export interface EaProductDisplay {
  eaTitle: string;
  club: EaProductClubView | null;
  members: EaProductMemberView[];
  matches: EaProductMatchView[];
  player: EaProductPlayerView | null;
}

/** Payload `link-ea-club` action `history` (et champs display du `link`). */
export interface EaProductHistoryResult extends EaProductDisplay {
  liveTitle: string;
  productTitle: string;
}

export function emptyEaProductDisplay(): EaProductDisplay {
  return {
    eaTitle: PRODUCT_EA_TITLE,
    club: null,
    members: [],
    matches: [],
    player: null,
  };
}
