/** Types des lignes telles que renvoyées par supabase-js (colonnes snake_case, cf. prisma/schema.prisma). */

import type { PlatformCode, PlayStyleCode, PositionCode } from "@/lib/constants";

/**
 * Colonnes de `users` sûres à lire depuis le client (anon/authenticated) —
 * exclut `push_token`, dont la lecture est révoquée en base pour ces rôles
 * (voir supabase/migrations/0002_rls_policies.sql). Utiliser CETTE liste au
 * lieu de `select("*")` partout où `users` est lu côté app : un `select("*")`
 * échouerait (permission denied) puisque push_token n'est plus lisible.
 */
export const USER_PUBLIC_COLUMNS =
  "id,username,platform,main_position,secondary_positions,play_style,languages,availability,reliability_score,verified_stats,ea_club_linked,plan,current_streak,best_streak,badges,applications_today,applications_reset_at,created_at";

export type Platform = PlatformCode;
export type { PlayStyleCode, PositionCode };
export type ClubLevel = "CASUAL" | "COMPETITIVE";
export type ClubRole = "OWNER" | "MANAGER" | "MEMBER";
export type ApplicationStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "WITHDRAWN";
export type InvitationStatus = "PENDING" | "ACCEPTED" | "DECLINED" | "CANCELLED" | "RESERVED";
export type Plan = "FREE" | "PRO";

/** Phase 5 — cycle de vie d'une sortie de club (demande joueur ou libération owner/manager). */
export type DepartureStatus =
  | "PENDING"
  | "ACCEPTED_NOW"
  | "ACCEPTED_NEXT_MATCH"
  | "REFUSED"
  | "EXPIRED"
  | "FORCE_EXIT"
  | "OWNER_RELEASED";
export type DepartureInitiator = "PLAYER" | "OWNER";

export interface VerifiedStats {
  goals?: number;
  assists?: number;
  cleanSheets?: number;
  matchesPlayed?: number;
  avgRating?: number;
  matchesPlayedRecent?: number;
  noShowsDetected?: number;
  lastSyncedAt?: string;
}

export interface UserRow {
  id: string;
  username: string;
  platform: Platform;
  main_position: PositionCode;
  secondary_positions: PositionCode[];
  play_style: PlayStyleCode;
  languages: string[];
  availability: Record<string, unknown>;
  reliability_score: number;
  verified_stats: VerifiedStats | null;
  ea_club_linked: string | null;
  plan: Plan;
  current_streak: number;
  best_streak: number;
  badges: string[];
  applications_today: number;
  applications_reset_at: string;
  push_token: string | null;
  created_at: string;
}

export interface ClubRow {
  id: string;
  name: string;
  owner_id: string;
  level: ClubLevel;
  description: string | null;
  languages: string[];
  ea_club_id: string | null;
  formation: string | null;
  voice_link: string | null;
  created_at: string;
}

/** "Ce membre occupe actuellement ce slot" — jamais une seconde source de
 *  vérité : le slot lui-même (position, label, coordonnées) vient toujours de
 *  lib/formations.ts, jamais de cette ligne. */
export interface SlotAssignmentRow {
  id: string;
  club_id: string;
  slot_id: string;
  user_id: string;
  assigned_at: string;
  user?: UserRow;
}

export interface ClubMemberRow {
  id: string;
  club_id: string;
  user_id: string;
  role: ClubRole;
  joined_at: string;
  /** Phase 5 — jamais modifiables directement par le client (revoke UPDATE
   *  posé en DB) : alimentées exclusivement par les Edge Functions
   *  request-departure/respond-departure/release-member/launch-match-checkin. */
  matches_played_count: number;
  strike_count: number;
  active_departure_request_id: string | null;
  user?: UserRow;
}

/** Phase 5 — journal des sorties de club (demandes joueur + libérations owner). */
export interface ClubDepartureRow {
  id: string;
  club_id: string;
  user_id: string;
  status: DepartureStatus;
  initiated_by: DepartureInitiator;
  requested_at: string;
  expires_at: string | null;
  responded_at: string | null;
  responded_by: string | null;
  release_match_checkin_id: string | null;
  transition_invitation_id: string | null;
  transition_target_club_id: string | null;
  user?: UserRow;
  /** Club cible d'une transition RESERVED — n'existe que si transition_target_club_id est posé. */
  transition_target_club?: { name: string } | null;
}

export interface ClubSessionRow {
  id: string;
  club_id: string;
  is_live: boolean;
  needed_positions: PositionCode[];
  note: string | null;
  created_at: string;
  updated_at: string;
  club?: ClubRow;
}

export interface ApplicationRow {
  id: string;
  user_id: string;
  club_id: string;
  session_id: string;
  position: PositionCode;
  slot_id: string | null;
  status: ApplicationStatus;
  message: string | null;
  created_at: string;
  user?: UserRow;
  club?: ClubRow;
}

/** Club -> joueur, distincte d'Application (joueur -> club) — jamais mélangées. */
export interface InvitationRow {
  id: string;
  club_id: string;
  slot_id: string | null;
  user_id: string;
  invited_by: string;
  status: InvitationStatus;
  created_at: string;
  /** Phase 5 — non nul uniquement pour une offre de transition (voir ClubDepartureRow). */
  departure_request_id: string | null;
  club?: ClubRow;
  /** Foundation #2.2 — joueur invité, embed utilisé par useClubInvitations (Match Center, lecture seule). */
  user?: UserRow;
}

export interface ReviewRow {
  id: string;
  reviewer_id: string;
  target_user_id: string;
  rating_skill: number;
  rating_behavior: number;
  showed_up: boolean;
  comment: string | null;
  created_at: string;
  reviewer?: UserRow;
}

export interface SeasonRow {
  id: string;
  name: string;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
}

/** Match Result Engine, Phase F.1 — lancement d'un check-in (match_checkins).
 *  `result` n'est jamais embarqué ici : la détermination "actif vs terminé"
 *  se fait via une requête séparée sur match_results (voir useActiveMatchCheckin). */
export interface MatchCheckinRow {
  id: string;
  club_id: string;
  session_id: string;
  formation_id: string | null;
  launched_at: string;
  launched_by: string | null;
  created_at: string;
}

/** Match Result Engine, Phase A — dérivé côté serveur uniquement (finalize_match). */
export type MatchOutcome = "WIN" | "DRAW" | "LOSS";

/** Résultat d'un match (match_results) — colonnes exactes retournées par
 *  finalize_match (voir supabase/migrations/0014_match_results.sql,
 *  `returns public.match_results`). `outcome` n'est jamais calculé côté
 *  client : reçu tel quel dans la réponse de l'Edge Function finalize-match. */
export interface MatchResultRow {
  id: string;
  match_checkin_id: string;
  club_id: string;
  our_score: number;
  opponent_score: number;
  outcome: MatchOutcome;
  mvp_user_id: string | null;
  recorded_by: string;
  created_at: string;
}

/** Match Result Engine, Phase F.2 — joueur éligible au MVP, dérivé de
 *  match_participations (status = 'PRESENT') pour un check-in donné, jamais
 *  du roster actuel du club. */
export interface MatchParticipantRow {
  user_id: string;
  username: string;
}

export interface SeasonStatRow {
  id: string;
  season_id: string;
  user_id: string;
  goals: number;
  assists: number;
  clean_sheets: number;
  matches_played: number;
  mvp_count: number;
  points: number;
  division: number;
  updated_at: string;
  user?: UserRow;
}
