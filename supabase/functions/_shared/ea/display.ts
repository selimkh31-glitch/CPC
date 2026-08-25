import { PRODUCT_EA_TITLE } from "./title.ts";
import type { EaImportedClubRow, EaImportedMatchRow, EaImportedMemberRow, ProductClubHistoryPayload } from "./ingest.ts";

/**
 * Payloads lecture club / joueur / match — ledger produit fc27 seulement.
 * Listes vides honnêtes. Pas d'écrans ici : l'UX PR bind ces formes.
 * Lignes joueur d'un match = playername, jamais la clé persona.
 */

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

export function emptyEaProductDisplay(): EaProductDisplay {
  return {
    eaTitle: PRODUCT_EA_TITLE,
    club: null,
    members: [],
    matches: [],
    player: null,
  };
}

function toClubView(row: EaImportedClubRow | null): EaProductClubView | null {
  if (!row) return null;
  return {
    eaClubId: row.ea_club_id,
    name: row.name,
    crestId: row.crest_id,
    wins: row.wins,
    losses: row.losses,
    draws: row.draws,
    gamesPlayed: row.games_played,
  };
}

function toMemberView(row: EaImportedMemberRow): EaProductMemberView {
  return {
    playername: row.playername,
    proPosition: row.pro_position,
    proName: row.pro_name,
    gamesPlayed: row.games_played,
    goals: row.goals,
    assists: row.assists,
    ratingAve: row.rating_ave,
    careerGamesPlayed: row.career_games_played,
    careerGoals: row.career_goals,
    careerAssists: row.career_assists,
  };
}

function toMatchPlayers(
  players: EaImportedMatchRow["players"]
): EaProductMatchPlayerView[] {
  const out: EaProductMatchPlayerView[] = [];
  const seen = new Set<string>();
  for (const p of Object.values(players ?? {})) {
    const name = typeof p.name === "string" ? p.name.trim() : "";
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      name,
      goals: p.goals,
      assists: p.assists,
      rating: p.rating,
    });
  }
  return out;
}

function toMatchView(row: EaImportedMatchRow): EaProductMatchView {
  return {
    eaMatchId: row.ea_match_id,
    matchType: row.match_type,
    playedAt: row.played_at,
    players: toMatchPlayers(row.players),
  };
}

export function pickMemberView(
  members: EaProductMemberView[],
  playername: string
): EaProductMemberView | null {
  const key = playername.trim().toLowerCase();
  if (!key) return null;
  return members.find((m) => m.playername.trim().toLowerCase() === key) ?? null;
}

export function matchesForPlayer(matches: EaProductMatchView[], playername: string): EaProductMatchView[] {
  const key = playername.trim().toLowerCase();
  if (!key) return [];
  return matches.filter((m) => m.players.some((p) => p.name.trim().toLowerCase() === key));
}

function askedPlayerSlice(
  members: EaProductMemberView[],
  matches: EaProductMatchView[],
  playername?: string | null
): EaProductPlayerView | null {
  const asked = typeof playername === "string" ? playername.trim() : "";
  if (!asked) return null;
  return { member: pickMemberView(members, asked), matches: matchesForPlayer(matches, asked) };
}

/** Ledger fc27 → vues club / effectif / matchs / joueur optionnel. Titre autre → vide. */
export function buildEaProductDisplay(
  history: ProductClubHistoryPayload,
  playername?: string | null
): EaProductDisplay {
  if (history.eaTitle !== PRODUCT_EA_TITLE) {
    const empty = emptyEaProductDisplay();
    empty.player = askedPlayerSlice([], [], playername);
    return empty;
  }
  const members = history.members.map(toMemberView);
  const matches = history.matches.map(toMatchView);
  return {
    eaTitle: PRODUCT_EA_TITLE,
    club: toClubView(history.club),
    members,
    matches,
    player: askedPlayerSlice(members, matches, playername),
  };
}
