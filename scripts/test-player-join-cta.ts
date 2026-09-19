/**
 * CTA Rejoindre — visibilité + copy (sans réseau).
 * Lancer : npx tsx scripts/test-player-join-cta.ts
 */
// @ts-expect-error Expo tsconfig has no @types/node; tsx provides `fs` at runtime.
import { readFileSync } from "fs";
import {
  PLAYER_JOIN_COPY,
  freeApplicationsUsedToday,
  playableNeededPositions,
  resolvePlayerJoinCta,
} from "../lib/playerJoinCta";
import { clubPublicHref, resolveClubPreviewSession } from "../lib/clubProfile";
import { parseNumericEaClubId } from "../lib/eaClubClaim";

const assert = {
  equal(actual: unknown, expected: unknown, label: string) {
    if (actual !== expected) {
      throw new Error(`Assertion échouée (${label}).\n  reçu: ${JSON.stringify(actual)}\n  attendu: ${JSON.stringify(expected)}`);
    }
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

function read(rel: string) {
  return readFileSync(`${process.cwd()}/${rel}`, "utf8");
}

const NOW = Date.parse("2026-09-19T18:00:00.000Z");
const live = {
  id: "s1",
  is_live: true,
  expires_at: "2026-09-19T20:00:00.000Z",
};
const profile = {
  mainPosition: "ST",
  secondaryPositions: ["CAM"],
  plan: "FREE" as const,
  applicationsToday: 0,
  applicationsResetAt: "2026-09-19T08:00:00.000Z",
};

console.log("lib/playerJoinCta.ts — Voir → Rejoindre");

test("showJoin seulement si LIVE + poste compatible + pas déjà club", () => {
  const join = resolvePlayerJoinCta({
    signedIn: true,
    profile,
    session: live,
    neededPositions: ["ST", "CB"],
    nowMs: NOW,
    thisClubId: "c1",
    memberships: [],
    applications: [],
  });
  assert.equal(join.kind, "join", "kind");
  assert.true(join.showJoin, "cta");
});

test("Voir seulement si poste hors besoin", () => {
  const r = resolvePlayerJoinCta({
    signedIn: true,
    profile,
    session: live,
    neededPositions: ["GK"],
    nowMs: NOW,
    thisClubId: "c1",
  });
  assert.equal(r.kind, "incompatible", "kind");
  assert.false(r.showJoin, "no join");
  assert.equal(r.message, PLAYER_JOIN_COPY.incompatible, "copy");
});

test("pending / already member / already in club / quota / closed", () => {
  const pending = resolvePlayerJoinCta({
    signedIn: true,
    profile,
    session: live,
    neededPositions: ["ST"],
    nowMs: NOW,
    thisClubId: "c1",
    applications: [{ sessionId: "s1", clubId: "c1", status: "PENDING" }],
  });
  assert.equal(pending.kind, "pending", "pending");
  assert.false(pending.showJoin, "pending no cta");

  const member = resolvePlayerJoinCta({
    signedIn: true,
    profile,
    session: live,
    neededPositions: ["ST"],
    nowMs: NOW,
    thisClubId: "c1",
    memberships: [{ clubId: "c1", role: "MEMBER" }],
  });
  assert.equal(member.kind, "already_member", "member");

  const other = resolvePlayerJoinCta({
    signedIn: true,
    profile,
    session: live,
    neededPositions: ["ST"],
    nowMs: NOW,
    thisClubId: "c1",
    memberships: [{ clubId: "c2", role: "MEMBER" }],
  });
  assert.equal(other.kind, "already_in_club", "3-clubs / déjà un club");

  const quota = resolvePlayerJoinCta({
    signedIn: true,
    profile: { ...profile, applicationsToday: 3 },
    session: live,
    neededPositions: ["ST"],
    nowMs: NOW,
    thisClubId: "c1",
  });
  assert.equal(quota.kind, "quota", "3/jour");

  const closed = resolvePlayerJoinCta({
    signedIn: true,
    profile,
    session: { ...live, is_live: false },
    neededPositions: ["ST"],
    nowMs: NOW,
    thisClubId: "c1",
  });
  assert.equal(closed.kind, "closed", "closed");
});

test("playableNeededPositions + quota reset jour", () => {
  assert.equal(playableNeededPositions(profile, ["CB", "ST", "ST"]).join(","), "ST", "unique playable");
  assert.equal(freeApplicationsUsedToday({ ...profile, applicationsToday: 2 }, NOW), 2, "same day");
  assert.equal(
    freeApplicationsUsedToday({ ...profile, applicationsToday: 2, applicationsResetAt: "2026-09-18T08:00:00.000Z" }, NOW),
    0,
    "reset"
  );
});

test("clubPublicHref join + resolveClubPreviewSession préfère le session query", () => {
  assert.equal(clubPublicHref("c1", "s1"), "/club/c1?session=s1", "preview");
  assert.equal(clubPublicHref("c1", "s1", { join: true }), "/club/c1?session=s1&join=1", "join");
  const preferred = resolveClubPreviewSession(
    [
      { id: "old", is_live: true, expires_at: "2026-09-19T19:00:00.000Z" },
      { id: "s1", is_live: true, expires_at: "2026-09-19T20:00:00.000Z" },
    ],
    NOW,
    "s1"
  );
  assert.equal(preferred?.id, "s1", "preferred");
  const fallback = resolveClubPreviewSession(
    [{ id: "s1", is_live: true, expires_at: "2026-09-19T20:00:00.000Z" }],
    NOW,
    "gone"
  );
  assert.equal(fallback?.id, "s1", "fallback live");
});

test("source — LIVE card + preview : Voir et Rejoindre", () => {
  const card = read("components/live/LiveClubCard.tsx");
  const apply = read("components/club/ApplyForm.tsx");
  const page = read("app/club/[id].tsx");
  assert.true(card.includes("PLAYER_JOIN_COPY.rejoindre"), "card Rejoindre");
  assert.true(card.includes("PLAYER_JOIN_COPY.voir"), "card Voir");
  assert.true(card.includes("join: true"), "join href");
  assert.true(card.includes("formatNeededPositionsLine"), "needed on card");
  assert.true(apply.includes("PLAYER_JOIN_COPY.rejoindre"), "apply Rejoindre");
  assert.true(apply.includes("usePlayerJoinCta"), "apply uses helper");
  assert.true(page.includes("resolveClubPreviewSession"), "session query");
  assert.true(page.includes("autoOpen={joinIntent}"), "join=1 opens form");
  assert.false(card.includes("join-live-club"), "no auto-join");
});

test("EA club id normalize — digits only, jamais regionId", () => {
  assert.equal(parseNumericEaClubId("42450"), "42450", "clubId");
  assert.equal(parseNumericEaClubId("49552"), "49552", "digits ok");
  assert.equal(parseNumericEaClubId("not-an-id"), null, "texte");
  const form = read("components/profile/LinkEaClubForm.tsx");
  const edge = read("supabase/functions/link-ea-club/index.ts");
  assert.true(form.includes('target === "managed-club"') || form.includes('target?: "player" | "managed-club"'), "club target");
  assert.true(form.includes("link-club") || form.includes("useLinkManagedEaClub"), "managed hook");
  assert.true(edge.includes('"link-club"'), "edge link-club");
  assert.true(edge.includes("ea_club_id"), "writes clubs.ea_club_id");
  assert.true(read("app/create-club.tsx").includes('target="managed-club"'), "create offers link");
  assert.true(read("app/(club)/(tabs)/effectif.tsx").includes('target="managed-club"'), "mon club link");
});

console.log(`\n${passed} tests player join CTA OK`);
