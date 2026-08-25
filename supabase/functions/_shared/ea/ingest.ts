import type { EAProvider } from "./provider.ts";
import type { EAClub, EAClubStats, EAMatch, EAPlayer, EAPlayerCareerStats } from "./types.ts";
import { getLiveEaTitle, PRODUCT_EA_TITLE } from "./title.ts";

export const EA_IMPORT_SOURCE = "unofficial_api_fc";

export interface EaImportedClubRow {
  ea_title: string;
  ea_club_id: string;
  platform: string;
  name: string | null;
  crest_id: string | null;
  wins: number | null;
  losses: number | null;
  draws: number | null;
  titles_won: number | null;
  games_played: number | null;
  source: string;
  unverified: boolean;
  imported_at: string;
  updated_at: string;
}

export interface EaImportedMemberRow {
  ea_title: string;
  ea_club_id: string;
  platform: string;
  playername: string;
  pro_position: string | null;
  pro_name: string | null;
  games_played: number | null;
  goals: number | null;
  assists: number | null;
  rating_ave: number | null;
  career_games_played: number | null;
  career_goals: number | null;
  career_assists: number | null;
  career_rating_ave: number | null;
  career_pro_overall: number | null;
  source: string;
  unverified: boolean;
  imported_at: string;
  updated_at: string;
}

export interface EaImportedMatchRow {
  ea_title: string;
  ea_club_id: string;
  ea_match_id: string;
  platform: string;
  match_type: string;
  played_at: string | null;
  players: Record<string, { name: string; goals: number; assists: number; cleanSheetsAny: number; rating: number | null }>;
  source: string;
  unverified: boolean;
  imported_at: string;
}

export interface IngestPlan {
  eaTitle: string;
  clubRow: EaImportedClubRow | null;
  memberRows: EaImportedMemberRow[];
  newMatches: EaImportedMatchRow[];
  skippedMatchCount: number;
}

/** Payload lecture UX (ledger produit fc27) — listes vides honnêtes, jamais un mix fc26. */
export interface ProductClubHistoryPayload {
  eaTitle: string;
  club: EaImportedClubRow | null;
  members: EaImportedMemberRow[];
  matches: EaImportedMatchRow[];
}

export function emptyProductClubHistory(): ProductClubHistoryPayload {
  return { eaTitle: PRODUCT_EA_TITLE, club: null, members: [], matches: [] };
}

function careerByName(career: EAPlayerCareerStats[] | null): Map<string, EAPlayerCareerStats> {
  const map = new Map<string, EAPlayerCareerStats>();
  for (const row of career ?? []) {
    map.set(row.externalId.trim().toLowerCase(), row);
  }
  return map;
}

/**
 * Plan d'écriture CPC : snapshot club + membres (stats + carrière) + matchs
 * nouveaux seulement. Liste EA vide → aucune ligne inventée.
 * Dedup matchs par ea_match_id déjà en table (pas le blob JSON utilisateur).
 */
export function buildIngestPlan(input: {
  clubId: string;
  platform: string;
  eaTitle: string;
  nowIso?: string;
  club: EAClub | null;
  clubStats: EAClubStats | null;
  members: EAPlayer[] | null;
  career: EAPlayerCareerStats[] | null;
  matches: EAMatch[] | null;
  existingMatchIds: readonly string[];
}): IngestPlan {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const known = new Set(input.existingMatchIds);
  const eaTitle = input.eaTitle;

  let clubRow: EaImportedClubRow | null = null;
  if (input.club || input.clubStats) {
    clubRow = {
      ea_title: eaTitle,
      ea_club_id: input.clubId,
      platform: input.platform,
      name: input.club?.name ?? null,
      crest_id: input.club?.crestId ?? null,
      wins: input.clubStats?.wins ?? null,
      losses: input.clubStats?.losses ?? null,
      draws: input.clubStats?.draws ?? null,
      titles_won: input.clubStats?.titlesWon ?? null,
      games_played: input.clubStats?.gamesPlayed ?? null,
      source: EA_IMPORT_SOURCE,
      unverified: true,
      imported_at: nowIso,
      updated_at: nowIso,
    };
  }

  const careers = careerByName(input.career);
  const memberRows: EaImportedMemberRow[] = [];
  const seenMembers = new Set<string>();

  for (const member of input.members ?? []) {
    const key = member.name.trim().toLowerCase();
    if (!key || seenMembers.has(key)) continue;
    seenMembers.add(key);
    const c = careers.get(key);
    memberRows.push({
      ea_title: eaTitle,
      ea_club_id: input.clubId,
      platform: input.platform,
      playername: member.name,
      pro_position: member.proPosition ?? c?.proPosition ?? null,
      pro_name: member.proName ?? c?.proName ?? null,
      games_played: member.gamesPlayed,
      goals: member.goals,
      assists: member.assists,
      rating_ave: member.ratingAve,
      career_games_played: c?.gamesPlayed ?? null,
      career_goals: c?.goals ?? null,
      career_assists: c?.assists ?? null,
      career_rating_ave: c?.ratingAve ?? null,
      career_pro_overall: c?.proOverall ?? null,
      source: EA_IMPORT_SOURCE,
      unverified: true,
      imported_at: nowIso,
      updated_at: nowIso,
    });
  }

  for (const c of input.career ?? []) {
    const key = c.externalId.trim().toLowerCase();
    if (!key || seenMembers.has(key)) continue;
    seenMembers.add(key);
    memberRows.push({
      ea_title: eaTitle,
      ea_club_id: input.clubId,
      platform: input.platform,
      playername: c.externalId,
      pro_position: c.proPosition,
      pro_name: c.proName,
      games_played: null,
      goals: null,
      assists: null,
      rating_ave: null,
      career_games_played: c.gamesPlayed,
      career_goals: c.goals,
      career_assists: c.assists,
      career_rating_ave: c.ratingAve,
      career_pro_overall: c.proOverall,
      source: EA_IMPORT_SOURCE,
      unverified: true,
      imported_at: nowIso,
      updated_at: nowIso,
    });
  }

  const newMatches: EaImportedMatchRow[] = [];
  let skippedMatchCount = 0;
  for (const match of input.matches ?? []) {
    if (!match.matchId) continue;
    if (known.has(match.matchId)) {
      skippedMatchCount += 1;
      continue;
    }
    known.add(match.matchId);
    newMatches.push({
      ea_title: eaTitle,
      ea_club_id: input.clubId,
      ea_match_id: match.matchId,
      platform: input.platform,
      match_type: match.matchType,
      played_at: match.timestamp,
      players: match.players,
      source: EA_IMPORT_SOURCE,
      unverified: true,
      imported_at: nowIso,
    });
  }

  return { eaTitle, clubRow, memberRows, newMatches, skippedMatchCount };
}

type AdminLike = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (col: string, val: string) => PromiseLike<{ data: unknown[] | null }>;
    };
    upsert: (row: unknown, opts?: { onConflict?: string }) => PromiseLike<unknown>;
  };
};

export async function loadImportedMatchIds(
  admin: AdminLike,
  eaClubId: string,
  eaTitle: string
): Promise<string[]> {
  const { data } = await admin.from("ea_imported_matches").select("ea_match_id,ea_title").eq("ea_club_id", eaClubId);
  const out: string[] = [];
  for (const row of data ?? []) {
    if (!row || typeof row !== "object") continue;
    const r = row as { ea_match_id?: unknown; ea_title?: unknown };
    if (typeof r.ea_title === "string" && r.ea_title !== eaTitle) continue;
    const id = r.ea_match_id;
    if (typeof id === "string" && id.trim()) out.push(id.trim());
  }
  return out;
}

function asRowList(data: unknown[] | null): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const row of data ?? []) {
    if (row && typeof row === "object" && !Array.isArray(row)) out.push(row as Record<string, unknown>);
  }
  return out;
}

export async function loadClubHistoryForTitle(
  admin: AdminLike,
  eaClubId: string,
  platform: string,
  eaTitle: string
): Promise<ProductClubHistoryPayload> {
  const empty: ProductClubHistoryPayload = { eaTitle, club: null, members: [], matches: [] };
  const [clubsRes, membersRes, matchesRes] = await Promise.all([
    admin.from("ea_imported_clubs").select("*").eq("ea_club_id", eaClubId),
    admin.from("ea_imported_members").select("*").eq("ea_club_id", eaClubId),
    admin.from("ea_imported_matches").select("*").eq("ea_club_id", eaClubId),
  ]);
  const club = asRowList(clubsRes.data).find(
    (r) => r.ea_title === eaTitle && r.platform === platform
  ) as unknown as EaImportedClubRow | undefined;
  const members = asRowList(membersRes.data).filter(
    (r) => r.ea_title === eaTitle && r.platform === platform
  ) as unknown as EaImportedMemberRow[];
  const matches = asRowList(matchesRes.data).filter(
    (r) => r.ea_title === eaTitle && r.platform === platform
  ) as unknown as EaImportedMatchRow[];
  if (!club && members.length === 0 && matches.length === 0) return empty;
  return { eaTitle, club: club ?? null, members, matches };
}

export function loadProductClubHistory(
  admin: AdminLike,
  eaClubId: string,
  platform: string = "common-gen5"
): Promise<ProductClubHistoryPayload> {
  return loadClubHistoryForTitle(admin, eaClubId, platform, PRODUCT_EA_TITLE);
}

export async function persistIngestPlan(admin: AdminLike, plan: IngestPlan): Promise<void> {
  if (plan.clubRow) {
    await admin.from("ea_imported_clubs").upsert(plan.clubRow, { onConflict: "ea_title,ea_club_id,platform" });
  }
  for (const member of plan.memberRows) {
    await admin.from("ea_imported_members").upsert(member, { onConflict: "ea_title,ea_club_id,platform,playername" });
  }
  if (plan.newMatches.length > 0) {
    await admin.from("ea_imported_matches").upsert(plan.newMatches, {
      onConflict: "ea_title,ea_club_id,platform,ea_match_id",
    });
  }
}

export async function fetchClubImportPayload(provider: EAProvider, eaClubId: string, platform: string = "common-gen5") {
  const [club, clubStats, members, career, matches] = await Promise.all([
    provider.getClub(eaClubId, platform),
    provider.getClubStats(eaClubId, platform),
    provider.getClubMembers(eaClubId, platform),
    provider.getClubCareerStats(eaClubId, platform),
    provider.getClubMatches(eaClubId, platform),
  ]);
  return { club, clubStats, members, career, matches };
}

/** Fetch adapter + écriture tables d'import. N'écrit pas users.* (appelant). */
export async function ingestEaClubFromProvider(
  admin: AdminLike,
  provider: EAProvider,
  eaClubId: string,
  platform: string = "common-gen5",
  eaTitle: string = getLiveEaTitle()
): Promise<{ plan: IngestPlan; matches: EAMatch[] | null }> {
  const payload = await fetchClubImportPayload(provider, eaClubId, platform);
  const existingMatchIds = await loadImportedMatchIds(admin, eaClubId, eaTitle);
  const plan = buildIngestPlan({
    clubId: eaClubId,
    platform,
    eaTitle,
    club: payload.club,
    clubStats: payload.clubStats,
    members: payload.members,
    career: payload.career,
    matches: payload.matches,
    existingMatchIds,
  });
  await persistIngestPlan(admin, plan);
  return { plan, matches: payload.matches };
}
