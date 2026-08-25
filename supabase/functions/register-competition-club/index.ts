import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { getAdminClient, getCallingUser } from "../_shared/supabase.ts";
import { requireUuid, ValidationError } from "../_shared/validate.ts";
import { notifyUser } from "../_shared/notify.ts";
import {
  canRegisterCompetitionClub,
  COMPETITION_COPY,
  registerBlockHttpStatus,
  registerBlockMessage,
  uniqueViolationHttpStatus,
} from "../_shared/competitions.ts";
import { TOURNAMENT_COPY, TOURNAMENT_KIND } from "../_shared/tournaments.ts";
import {
  competitionClubRegisteredCopy,
  competitionClubRegisteredNotificationData,
  competitionClubRegisteredRecipientIds,
} from "../_shared/safety.ts";

/**
 * Inscrit un club géré (OWNER/MANAGER) à une compétition OPEN.
 * Unique (competition_id, club_id) : doublon → 409, jamais un 2e row.
 *
 * Après INSERT réussi : notif in-app COMPETITION_CLUB_REGISTERED
 * (create_notification via notifyUser) au created_by de la compétition
 * et aux OWNER/MANAGER du club inscrit (dédupliqués). Échec notify : log
 * seulement, jamais de rollback de competition_clubs. Realtime = canal
 * existant notifications-${userId} ; pas de second canal. Pas de notif
 * COMPETITION_CREATED (le créateur voit déjà l'écran).
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const user = await getCallingUser(req);
  if (!user) return jsonResponse({ error: "Non authentifié" }, 401);

  let competitionId: string;
  let clubId: string;
  try {
    const body = await req.json();
    competitionId = requireUuid(body.competitionId, "competitionId");
    clubId = requireUuid(body.clubId, "clubId");
  } catch (err) {
    if (err instanceof ValidationError) return jsonResponse({ error: err.message }, 400);
    return jsonResponse({ error: "Corps de requête invalide." }, 400);
  }

  const admin = getAdminClient();

  const { data: competition, error: competitionError } = await admin
    .from("competitions")
    .select("id, status, name, created_by, kind")
    .eq("id", competitionId)
    .maybeSingle();
  if (competitionError) return jsonResponse({ error: competitionError.message }, 500);
  if (!competition) return jsonResponse({ error: COMPETITION_COPY.competitionNotFound }, 404);

  const { data: membership, error: membershipError } = await admin
    .from("club_members")
    .select("role")
    .eq("club_id", clubId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (membershipError) return jsonResponse({ error: membershipError.message }, 500);

  const gate = canRegisterCompetitionClub({
    competitionStatus: competition.status,
    actorRole: membership?.role ?? null,
    alreadyRegistered: false,
  });
  if (!gate.ok) {
    const tournamentCopy = competition.kind === TOURNAMENT_KIND;
    const message = tournamentCopy
      ? gate.reason === "already_registered"
        ? TOURNAMENT_COPY.registerConflict
        : gate.reason === "not_manager"
          ? TOURNAMENT_COPY.notManager
          : TOURNAMENT_COPY.notOpen
      : registerBlockMessage(gate.reason);
    return jsonResponse({ error: message }, registerBlockHttpStatus(gate.reason));
  }

  const { data, error } = await admin
    .from("competition_clubs")
    .insert({ competition_id: competitionId, club_id: clubId })
    .select()
    .single();

  const registerConflictCopy =
    competition.kind === TOURNAMENT_KIND ? TOURNAMENT_COPY.registerConflict : COMPETITION_COPY.registerConflict;

  if (error) {
    const conflict = uniqueViolationHttpStatus(error.code);
    if (conflict) return jsonResponse({ error: registerConflictCopy }, conflict);
    return jsonResponse({ error: error.message }, 500);
  }

  try {
    await notifyCompetitionClubRegistered(admin, {
      registration: data,
      competitionId,
      clubId,
      competitionName: typeof competition.name === "string" ? competition.name : "",
      createdBy: typeof competition.created_by === "string" ? competition.created_by : null,
      kind: typeof competition.kind === "string" ? competition.kind : null,
    });
  } catch (err) {
    console.warn("[register-competition-club] notify exception:", err);
  }

  return jsonResponse({ registration: data });
});

function asRegistrationRow(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== "object") return null;
  return data as Record<string, unknown>;
}

async function notifyCompetitionClubRegistered(
  admin: ReturnType<typeof getAdminClient>,
  input: {
    registration: unknown;
    competitionId: string;
    clubId: string;
    competitionName: string;
    createdBy: string | null;
    kind: string | null;
  }
): Promise<void> {
  const registration = asRegistrationRow(input.registration);
  const registrationId = typeof registration?.id === "string" ? registration.id : "";

  const { data: club, error: clubError } = await admin
    .from("clubs")
    .select("id, name")
    .eq("id", input.clubId)
    .maybeSingle();
  if (clubError) console.warn("[register-competition-club] notify club:", clubError.message);

  const copy = competitionClubRegisteredCopy({
    clubName: typeof club?.name === "string" ? club.name : "",
    competitionName: input.competitionName,
  });
  const data = competitionClubRegisteredNotificationData({
    clubId: input.clubId,
    competitionId: input.competitionId,
    registrationId,
    kind: input.kind,
  });

  const { data: members, error: membersError } = await admin
    .from("club_members")
    .select("user_id, role, user:users(id, push_token)")
    .eq("club_id", input.clubId)
    .in("role", ["OWNER", "MANAGER"]);
  if (membersError) {
    console.warn("[register-competition-club] notify members:", membersError.message);
  }

  const rows = members ?? [];
  const recipientIds = competitionClubRegisteredRecipientIds({
    createdBy: input.createdBy,
    clubMembers: rows.map((row) => ({ userId: row.user_id, role: row.role })),
  });
  if (recipientIds.length === 0) return;

  const tokenByUser = new Map<string, string | null>();
  for (const row of rows) {
    if (tokenByUser.has(row.user_id)) continue;
    tokenByUser.set(
      row.user_id,
      (row.user as { push_token?: string | null } | null)?.push_token ?? null
    );
  }

  const missing = recipientIds.filter((id) => !tokenByUser.has(id));
  if (missing.length > 0) {
    const { data: users, error: usersError } = await admin
      .from("users")
      .select("id, push_token")
      .in("id", missing);
    if (usersError) {
      console.warn("[register-competition-club] notify creator token:", usersError.message);
    } else {
      for (const row of users ?? []) {
        if (typeof row.id === "string") tokenByUser.set(row.id, row.push_token ?? null);
      }
    }
  }

  for (const userId of recipientIds) {
    await notifyUser(admin, {
      userId,
      type: copy.type,
      title: copy.title,
      body: copy.body,
      data,
      pushToken: tokenByUser.get(userId),
    });
  }
}
