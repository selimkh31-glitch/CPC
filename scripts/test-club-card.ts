/**
 * Tests de lib/clubCard.ts — builder unique, données honnêtes.
 * Lancer : npx tsx scripts/test-club-card.ts
 */
import {
  CLUB_CARD_COPY,
  buildClubCardData,
  buildClubCardDataFromHydratedClub,
  buildClubCardDataFromLiveSession,
  clubMatchRecordFromLinkedResults,
  clubCardHeroNumber,
  formatClubMatchRecord,
  formatClubMemberCount,
  honestClubReason,
  normalizeClubMatchRecord,
  resolveClubCardDensity,
  type ClubCardClubInput,
  type ClubCardData,
} from "../lib/clubCard";
import type { ClubSessionRow } from "../lib/types";
import type { LinkedMatchResultInput } from "../lib/competitions";
// @ts-expect-error Expo tsconfig has no @types/node; tsx provides `fs` at runtime.
import { readFileSync } from "fs";

const assert = {
  equal(actual: unknown, expected: unknown, label: string) {
    if (actual !== expected) {
      throw new Error(`Assertion échouée (${label}).\n  reçu: ${JSON.stringify(actual)}\n  attendu: ${JSON.stringify(expected)}`);
    }
  },
  deepEqual(actual: unknown, expected: unknown, label: string) {
    const a = JSON.stringify(actual);
    const b = JSON.stringify(expected);
    if (a !== b) throw new Error(`Assertion échouée (${label}).\n  reçu: ${a}\n  attendu: ${b}`);
  },
  true(actual: unknown, label: string) {
    if (actual !== true) throw new Error(`Assertion échouée (${label}) : attendu true, reçu ${actual}`);
  },
  false(actual: unknown, label: string) {
    if (actual !== false) throw new Error(`Assertion échouée (${label}) : attendu false, reçu ${actual}`);
  },
};

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok — ${name}`);
}

function baseClub(overrides: Partial<ClubCardClubInput> = {}): ClubCardClubInput {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Les Invincibles",
    level: "CASUAL",
    description: "Club Pro Clubs du mercredi",
    languages: ["FR", "EN"],
    ea_club_id: null,
    formation: "4-3-3",
    created_at: "2026-01-01T00:00:00.000Z",
    owner_id: "owner-1",
    ...overrides,
  };
}

function linkedResult(overrides: Partial<LinkedMatchResultInput> & Pick<LinkedMatchResultInput, "club_id">): LinkedMatchResultInput {
  return {
    opponent_club_id: "22222222-2222-4222-8222-222222222222",
    competition_id: null,
    outcome: "WIN",
    our_score: 2,
    opponent_score: 1,
    ...overrides,
  };
}

console.log("lib/clubCard.ts — buildClubCardData");

test("champs manquants -> null / vides, jamais de remplissage", () => {
  const data = buildClubCardData({ id: "c1", name: "Alpha" });
  assert.equal(data.level, null, "level");
  assert.equal(data.ownerPlatform, null, "platform");
  assert.equal(data.ownerUsername, null, "owner");
  assert.equal(data.languagesLine, null, "langs");
  assert.equal(data.description, null, "desc");
  assert.equal(data.eaClubId, null, "ea");
  assert.equal(data.memberCount, null, "members");
  assert.equal(data.matchRecord, null, "record");
  assert.equal(data.live, false, "live");
  assert.equal(data.neededLine, null, "needed");
  assert.equal(data.identityLine, null, "identity");
});

test("pas d'OVR club — le builder n'expose pas de champ ovr", () => {
  const data = buildClubCardData(baseClub()) as ClubCardData & { ovr?: unknown };
  assert.equal("ovr" in data, false, "no ovr key");
  assert.equal((data as { clubOvr?: unknown }).clubOvr, undefined, "no clubOvr");
  assert.equal((data as { overall?: unknown }).overall, undefined, "no overall");
});

test("plateforme = owner.users.platform ; clubs.platform ignoré", () => {
  const withOwner = buildClubCardData(baseClub(), { ownerPlatform: "PS" });
  assert.equal(withOwner.ownerPlatform, "PS", "owner PS");
  assert.equal(withOwner.identityLine, "Casual · PlayStation", "identity");

  const spoof = buildClubCardData(
    { ...baseClub(), ...( { platform: "XBOX" } as object ) } as ClubCardClubInput,
    { ownerPlatform: "PC" }
  );
  assert.equal(spoof.ownerPlatform, "PC", "owner wins");
  assert.equal(spoof.identityLine?.includes("Xbox"), false, "pas la plateforme inventée du club");
  assert.equal(spoof.identityLine, "Casual · PC", "PC owner");

  const noOwner = buildClubCardData(baseClub());
  assert.equal(noOwner.ownerPlatform, null, "sans owner");
  assert.equal(noOwner.identityLine, "Casual", "niveau seul");
});

test("W-D-L omis sans match_results opponent_club_id — pas de 0-0-0", () => {
  assert.equal(buildClubCardData(baseClub()).matchRecord, null, "default");
  assert.equal(formatClubMatchRecord(null), null, "format null");
  assert.equal(normalizeClubMatchRecord({ played: 0, wins: 0, draws: 0, losses: 0, points: 0 }), null, "zero hidden");

  const withoutOpponent: LinkedMatchResultInput[] = [
    linkedResult({ club_id: "c1", opponent_club_id: null, outcome: "WIN", our_score: 3, opponent_score: 0 }),
  ];
  assert.equal(clubMatchRecordFromLinkedResults("c1", withoutOpponent), null, "no opponent_club_id");
  assert.equal(clubMatchRecordFromLinkedResults("c1", []), null, "empty");
  assert.equal(clubMatchRecordFromLinkedResults("c1", null), null, "null results");
});

test("W-D-L réel seulement avec opponent_club_id — même scorer CPC", () => {
  const clubId = "11111111-1111-4111-8111-111111111111";
  const opp = "22222222-2222-4222-8222-222222222222";
  const results: LinkedMatchResultInput[] = [
    linkedResult({ club_id: clubId, opponent_club_id: opp, outcome: "WIN", our_score: 2, opponent_score: 1 }),
    linkedResult({ club_id: clubId, opponent_club_id: opp, outcome: "DRAW", our_score: 1, opponent_score: 1 }),
    linkedResult({ club_id: clubId, opponent_club_id: null, outcome: "WIN", our_score: 9, opponent_score: 0 }),
  ];
  const record = clubMatchRecordFromLinkedResults(clubId, results);
  assert.equal(record?.played, 2, "played ignores no-opponent");
  assert.equal(record?.wins, 1, "wins");
  assert.equal(record?.draws, 1, "draws");
  assert.equal(record?.losses, 0, "losses");
  assert.equal(record?.points, 4, "W=3 D=1");
  assert.equal(formatClubMatchRecord(record), "1V · 1N · 0D", "line");

  const data = buildClubCardData(baseClub({ id: clubId }), { matchRecord: record });
  assert.deepEqual(data.matchRecord, record, "passed through");
  assert.deepEqual(clubCardHeroNumber(data), { value: 4, label: CLUB_CARD_COPY.pointsLabel }, "hero points");
  assert.equal(clubCardHeroNumber({ matchRecord: null }), null, "no fake hero");
});

test("LIVE / needed / note viennent de la session, pas de la ligne Club", () => {
  const off = buildClubCardData({ ...baseClub(), ...( { needed_positions: ["ST"] } as object ) } as ClubCardClubInput);
  assert.equal(off.live, false, "club row n'active pas LIVE");
  assert.equal(off.neededLine, null, "needed ignoré hors opts");

  const on = buildClubCardData(baseClub(), {
    live: true,
    neededPositions: ["ST", "CAM"],
    liveNote: "Dispo 21h",
    liveExpiresAt: "2026-08-25T21:00:00.000Z",
  });
  assert.equal(on.live, true, "live");
  assert.equal(on.neededLine, "ST · CAM", "needed from session");
  assert.equal(on.liveNote, "Dispo 21h", "note");
  assert.equal(on.liveExpiresAt, "2026-08-25T21:00:00.000Z", "ttl");
});

test("reason déterministe : conservée ; un % est rejeté", () => {
  assert.equal(honestClubReason("poste recherché (ST) · même plateforme (PS)"), "poste recherché (ST) · même plateforme (PS)", "ok");
  assert.equal(honestClubReason("87% compatible"), null, "percent");
  assert.equal(honestClubReason("  "), null, "blank");
  const data = buildClubCardData(baseClub(), { reason: "compatibilité 40%" });
  assert.equal(data.reason, null, "builder drops %");
});

test("eaClubId = identité liée, jamais des stats EA", () => {
  const none = buildClubCardData(baseClub({ ea_club_id: null }));
  assert.equal(none.eaClubId, null, "absent");
  const linked = buildClubCardData(baseClub({ ea_club_id: "ea-999" }));
  assert.equal(linked.eaClubId, "ea-999", "id");
  assert.equal("eaStats" in linked, false, "pas de stats");
  assert.equal("goals" in linked, false, "pas de buts");
  assert.equal(CLUB_CARD_COPY.eaLinkedHint.includes("pas des stats"), true, "copy");
  assert.equal(CLUB_CARD_COPY.eaUnlinked.includes("inventées"), true, "unlinked honest");
  assert.equal(CLUB_CARD_COPY.eaUnlinked.includes("Lier"), false, "pas de CTA mort club");
});

test("memberCount omis si non fourni ; 0 chargé reste 0 (effectif réel vide)", () => {
  assert.equal(buildClubCardData(baseClub()).memberCount, null, "omit");
  assert.equal(buildClubCardData(baseClub(), { memberCount: 4 }).memberCount, 4, "loaded");
  assert.equal(buildClubCardData(baseClub(), { memberCount: 0 }).memberCount, 0, "zero réel");
  assert.equal(formatClubMemberCount(null), null, "format omit");
  assert.equal(formatClubMemberCount(1), "1 membre", "one");
  assert.equal(formatClubMemberCount(3), "3 membres", "many");
});

test("description / langues : présentes si hydratées, sinon null", () => {
  const full = buildClubCardData(baseClub());
  assert.equal(full.description, "Club Pro Clubs du mercredi", "desc");
  assert.equal(full.languagesLine, "Français, Anglais", "langs");
  const empty = buildClubCardData({ id: "c1", name: "B", languages: [], description: "  " });
  assert.equal(empty.description, null, "blank desc");
  assert.equal(empty.languagesLine, null, "empty langs");
});

test("densités : hero/standard aliases -> full/compact ; mini reste mini", () => {
  assert.equal(resolveClubCardDensity("hero"), "full", "hero");
  assert.equal(resolveClubCardDensity("full"), "full", "full");
  assert.equal(resolveClubCardDensity("standard"), "compact", "standard");
  assert.equal(resolveClubCardDensity("compact"), "compact", "compact");
  assert.equal(resolveClubCardDensity("mini"), "mini", "mini");
});

test("href public /club/[id] (+ session LIVE), pas /match-sheet", () => {
  const data = buildClubCardData(baseClub());
  assert.equal(data.href, `/club/${baseClub().id}`, "base");
  const live = buildClubCardData(baseClub(), { sessionId: "sess-1" });
  assert.equal(live.href.includes("session=sess-1"), true, "session");
  assert.equal(data.href.includes("match-sheet"), false, "pas match-sheet");
});

test("buildClubCardDataFromLiveSession — owner platform + needed session", () => {
  const item: ClubSessionRow = {
    id: "s1",
    club_id: baseClub().id,
    is_live: true,
    needed_positions: ["ST"],
    note: "21h",
    expires_at: "2026-08-25T21:00:00.000Z",
    created_at: "2026-08-25T18:00:00.000Z",
    updated_at: "2026-08-25T18:00:00.000Z",
    club: {
      id: baseClub().id,
      name: "Les Invincibles",
      owner_id: "owner-1",
      level: "CASUAL",
      description: "Club Pro Clubs du mercredi",
      languages: ["FR", "EN"],
      ea_club_id: null,
      formation: "4-3-3",
      voice_link: null,
      created_at: "2026-01-01T00:00:00.000Z",
      owner: { id: "o1", platform: "XBOX", username: "Patron" },
    },
  };
  const data = buildClubCardDataFromLiveSession(item, { reason: "poste recherché (ST)" });
  assert.equal(data?.live, true, "live");
  assert.equal(data?.ownerPlatform, "XBOX", "owner platform");
  assert.equal(data?.ownerUsername, "Patron", "owner name");
  assert.equal(data?.neededLine, "ST", "needed");
  assert.equal(data?.reason, "poste recherché (ST)", "reason");
  assert.equal(data?.href.includes("session=s1"), true, "session href");
  assert.equal(buildClubCardDataFromLiveSession({ ...item, club: undefined }), null, "no club");
});

test("copy FR — LIVE / Voir le club / pas de %", () => {
  assert.equal(CLUB_CARD_COPY.live, "LIVE", "live");
  assert.equal(CLUB_CARD_COPY.viewClub, "Voir le club", "cta");
  assert.equal(CLUB_CARD_COPY.seeking("ST").includes("%"), false, "seeking");
  assert.equal(CLUB_CARD_COPY.fc27.includes("FC 27"), true, "fc27");
});

test("hydraté : plateforme owner, LIVE session, effectif déjà chargé ; pas d'OVR", () => {
  const now = Date.parse("2026-08-25T12:00:00.000Z");
  const data = buildClubCardDataFromHydratedClub(baseClub(), {
    nowMs: now,
    members: [
      {
        id: "m1",
        club_id: baseClub().id,
        user_id: "o1",
        role: "OWNER",
        joined_at: "2026-01-01T00:00:00.000Z",
        matches_played_count: 0,
        strike_count: 0,
        active_departure_request_id: null,
        user: {
          id: "o1",
          username: "Patron",
          platform: "PS",
          main_position: "ST",
          secondary_positions: [],
          play_style: "ATTACKING",
          languages: ["FR"],
          availability: {},
          reliability_score: 50,
          verified_stats: null,
          ea_club_linked: null,
          ea_identity_kind: "NONE",
          plan: "FREE",
          current_streak: 0,
          best_streak: 0,
          badges: [],
          applications_today: 0,
          applications_reset_at: "2026-01-01T00:00:00.000Z",
          push_token: null,
          created_at: "2026-01-01T00:00:00.000Z",
        },
      },
    ],
    sessions: [
      {
        id: "s1",
        club_id: baseClub().id,
        is_live: true,
        needed_positions: ["GK"],
        note: "Ce soir",
        expires_at: "2026-08-25T13:00:00.000Z",
        created_at: "2026-08-25T11:00:00.000Z",
        updated_at: "2026-08-25T11:00:00.000Z",
      },
    ],
  });
  assert.equal(data.ownerPlatform, "PS", "platform owner");
  assert.equal(data.ownerUsername, "Patron", "username");
  assert.equal(data.memberCount, 1, "members loaded");
  assert.equal(data.live, true, "live session");
  assert.equal(data.neededLine, "GK", "needed from session");
  assert.equal("ovr" in data, false, "pas d'OVR");
  assert.equal(data.matchRecord, null, "pas de W-D-L sans results");
});

test("listes fondateur : candidatures / invitations n'inventent pas Club / Club Pro Clubs", () => {
  const apps = readFileSync(`${process.cwd()}/components/player/MyApplicationsList.tsx`, "utf8");
  const invs = readFileSync(`${process.cwd()}/components/player/MyInvitationsList.tsx`, "utf8");
  assert.true(apps.includes("tournamentClubDisplayName"), "apps helper");
  assert.true(apps.includes("buildClubCardData"), "apps ClubCard");
  assert.false(apps.includes('name: "Club"'), "apps no Club fallback");
  assert.false(apps.includes('"Club Pro Clubs"'), "apps no placeholder");
  assert.true(invs.includes("tournamentClubDisplayName"), "invs helper");
  assert.true(invs.includes("buildClubCardData"), "invs ClubCard");
  assert.false(invs.includes('name: "Club"'), "invs no Club fallback");
  assert.false(invs.includes('"Club Pro Clubs"'), "invs no placeholder");
});

test("spine UX — Recrutement invite ; Club pas un 2e LIVE ; Card a Lier mon club", () => {
  const rec = readFileSync(`${process.cwd()}/app/(club)/(tabs)/candidatures.tsx`, "utf8");
  const club = readFileSync(`${process.cwd()}/app/(club)/(tabs)/effectif.tsx`, "utf8");
  const liveClub = readFileSync(`${process.cwd()}/app/(club)/(tabs)/index.tsx`, "utf8");
  const livePlayer = readFileSync(`${process.cwd()}/app/(player)/(tabs)/index.tsx`, "utf8");
  const profile = readFileSync(`${process.cwd()}/components/profile/ProfileContent.tsx`, "utf8");
  const card = readFileSync(`${process.cwd()}/components/player/PlayerCard.tsx`, "utf8");
  assert.true(rec.includes("InviteToClubPanel"), "invite on recrutement");
  assert.true(rec.includes("ApplicationsPanel"), "accept");
  assert.false(club.includes("InviteToClubPanel"), "invite not on club tab");
  assert.false(club.includes("ClubSessionStatus"), "club not 2nd LIVE");
  assert.true(club.includes("MatchHistoryList"), "club stats");
  assert.true(liveClub.includes("ClubLiveFeuille"), "club LIVE is feuille");
  assert.false(liveClub.includes("LiveSessionPanel"), "no intern LIVE panel");
  assert.false(liveClub.includes("clubLiveLayout"), "no competing layout");
  assert.false(liveClub.includes('uiState === "ready"'), "ready does not replace screen");
  assert.false(liveClub.includes("ClubSessionStatus"), "no duplicate status");
  const feuille = readFileSync(`${process.cwd()}/components/club/ClubLiveFeuille.tsx`, "utf8");
  assert.true(feuille.includes("ClubDiscoveryToggle"), "discovery toggle");
  assert.true(feuille.includes("FormationPitch"), "pitch on LIVE");
  assert.false(feuille.includes("flag + durée"), "no intern flag copy");
  assert.true(livePlayer.includes("LiveClubCard"), "clubs on matchmaking");
  assert.true(livePlayer.includes("MatchmakingFilters"), "filters");
  assert.false(livePlayer.includes("LivePlayerCard"), "no other players");
  assert.false(livePlayer.includes("liveFeedEmptyCopy"), "not liveFeedEmptyCopy");
  assert.true(profile.includes("onLinkEaClub"), "EA CTA wired");
  assert.true(card.includes("PLAYER_CARD_COPY.linkClub"), "cta on card");
});

console.log(`\n${passed} test(s) passés.`);
