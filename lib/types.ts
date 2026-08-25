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
  "id,username,platform,main_position,secondary_positions,play_style,languages,availability,reliability_score,verified_stats,ea_club_linked,ea_identity_kind,plan,current_streak,best_streak,badges,applications_today,applications_reset_at,created_at";

export type Platform = PlatformCode;
export type { PlayStyleCode, PositionCode };
export type ClubLevel = "CASUAL" | "COMPETITIVE";
export type ClubRole = "OWNER" | "MANAGER" | "MEMBER";
export type ApplicationStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "WITHDRAWN" | "DECLINED" | "CANCELLED" | "EXPIRED";
export type InvitationStatus = "PENDING" | "ACCEPTED" | "DECLINED" | "CANCELLED" | "RESERVED" | "EXPIRED";
export type Plan = "FREE" | "PRO";
export type EaIdentityKind = "NONE" | "USERNAME_EQUALITY";
export type ReportReason = "HARASSMENT" | "CHEATING" | "FAKE_IDENTITY" | "SPAM" | "OTHER";
export type ReportStatus = "OPEN" | "REVIEWED" | "DISMISSED";

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
  ea_identity_kind: EaIdentityKind;
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
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  club?: ClubRow & { owner?: { id?: string; platform: Platform; username?: string } | null };
}

/** P0 — LIVE joueur (recrutement), distinct de la présence Realtime. */
export interface PlayerSessionRow {
  id: string;
  user_id: string;
  is_live: boolean;
  note: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  user?: UserRow;
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
 *  finalize_match (0014 + 0027). `outcome` n'est jamais calculé côté
 *  client : reçu tel quel dans la réponse de l'Edge Function finalize-match.
 *  `opponent_club_id` / `competition_id` sont optionnels ; un classement
 *  compétition n'existe que si les deux sont posés sur au moins une ligne. */
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
  opponent_club_id: string | null;
  competition_id: string | null;
}

/** Snapshot check-in (launch-match-checkin) — pas le roster actuel. */
export type MatchParticipationStatus = "PRESENT" | "ABSENT";

export interface MatchParticipationRow {
  id: string;
  match_checkin_id: string;
  user_id: string;
  club_id: string;
  slot_id: string | null;
  status: MatchParticipationStatus;
}

/** Match Result Engine, Phase F.2 — joueur éligible au MVP, dérivé de
 *  match_participations (status = 'PRESENT') pour un check-in donné, jamais
 *  du roster actuel du club. */
export interface MatchParticipantRow {
  user_id: string;
  username: string;
}

/**
 * Social Foundations — Chat (mission "CHAT — VRAIE FONDATION", section 11).
 * Voir supabase/migrations/0017_chat_rls.sql pour les policies exactes.
 */
export type ConversationType = "DIRECT" | "GROUP" | "CLUB";
export type ConversationRole = "OWNER" | "ADMIN" | "MEMBER";

export interface ConversationRow {
  id: string;
  type: ConversationType;
  club_id: string | null;
  group_id: string | null;
  created_by: string;
  created_at: string;
  /** Embed optionnel — membres de la conversation, utilisé pour dériver
   *  "l'autre" utilisateur d'une conversation DIRECT côté client. */
  members?: ConversationMemberRow[];
}

export interface ConversationMemberRow {
  id: string;
  conversation_id: string;
  user_id: string;
  role: ConversationRole;
  joined_at: string;
  last_read_at: string | null;
  user?: UserRow;
}

export interface MessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  sender?: UserRow;
}

/**
 * Social Foundations — Groupes (mission section 12). Distinct d'un club.
 * Voir supabase/migrations/0018_group_rls.sql pour les policies exactes.
 */
export type GroupVisibility = "PUBLIC" | "PRIVATE";
export type GroupRole = "OWNER" | "ADMIN" | "MEMBER";

export interface GroupRow {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  owner_id: string;
  visibility: GroupVisibility;
  created_at: string;
}

export interface GroupMemberRow {
  id: string;
  group_id: string;
  user_id: string;
  role: GroupRole;
  joined_at: string;
  user?: UserRow;
}

export interface UserBlockRow {
  id: string;
  blocker_id: string;
  blocked_id: string;
  created_at: string;
  blocked?: UserRow;
}

export interface UserReportRow {
  id: string;
  reporter_id: string;
  reported_id: string;
  reason: ReportReason;
  details: string | null;
  status: ReportStatus;
  created_at: string;
  reported?: UserRow;
}

export interface NotificationRow {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
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

/** Compétitions virtuelles EA SPORTS FC 27 Pro Clubs — fondation (0026). */
export type CompetitionStatus = "DRAFT" | "OPEN" | "CLOSED";

export interface CompetitionRow {
  id: string;
  name: string;
  status: CompetitionStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
  clubs?: CompetitionClubRow[];
}

export interface CompetitionClubRow {
  id: string;
  competition_id: string;
  club_id: string;
  created_at: string;
  club?: Pick<ClubRow, "id" | "name">;
}
