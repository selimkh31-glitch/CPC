/**
 * Tests de lib/clubProfile.ts + hasVerifiedEaStatValues — identité club
 * et stats EA honnêtes, sans réseau.
 *
 * Lancer : npx tsx scripts/test-club-profile.ts
 */
import {
  clubActiveLiveSession,
  clubIdentityLine,
  clubLanguagesLine,
  clubOwnerPlatform,
  clubOwnerUsername,
  clubPublicHref,
  findClubOwner,
  sortClubRoster,
} from "../lib/clubProfile";
import { PRO_PURCHASE_UNAVAILABLE_REASON, pricingScreenCopy, profileProEntryCopy, proPurchaseCta } from "../lib/constants";
import { hasVerifiedEaStatValues, normalizeEaIdentityKind } from "../lib/statsSource";
import type { ClubMemberRow, ClubSessionRow, UserRow } from "../lib/types";

const assert = {
  equal(actual: unknown, expected: unknown, label: string) {
    if (actual !== expected) throw new Error(`Assertion échouée (${label}).\n  reçu: ${JSON.stringify(actual)}\n  attendu: ${JSON.stringify(expected)}`);
  },
  deepEqual(actual: unknown, expected: unknown, label: string) {
    const a = JSON.stringify(actual);
    const b = JSON.stringify(expected);
    if (a !== b) throw new Error(`Assertion échouée (${label}).\n  reçu: ${a}\n  attendu: ${b}`);
  },
};

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok — ${name}`);
}

function user(overrides: Partial<UserRow> = {}): UserRow {
  return {
    id: "u1",
    username: "OwnerPS",
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
    applications_reset_at: new Date().toISOString(),
    push_token: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function member(overrides: Partial<ClubMemberRow> & Pick<ClubMemberRow, "role" | "user_id">): ClubMemberRow {
  return {
    id: `m-${overrides.user_id}`,
    club_id: "c1",
    joined_at: "2026-01-01T00:00:00.000Z",
    matches_played_count: 0,
    strike_count: 0,
    active_departure_request_id: null,
    ...overrides,
  };
}

console.log("lib/clubProfile.ts — identité club (champs réels uniquement)");

test("owner platform/username lus sur le membership OWNER hydraté", () => {
  const members = [
    member({ user_id: "m1", role: "MEMBER", user: user({ id: "m1", username: "Joueur", platform: "PC" }) }),
    member({ user_id: "o1", role: "OWNER", user: user({ id: "o1", username: "OwnerPS", platform: "PS" }) }),
  ];
  assert.equal(findClubOwner(members)?.user_id, "o1", "owner id");
  assert.equal(clubOwnerPlatform(members), "PS", "platform");
  assert.equal(clubOwnerUsername(members), "OwnerPS", "username");
});

test("owner sans user hydraté -> platform/username null (jamais inventés)", () => {
  const members = [member({ user_id: "o1", role: "OWNER" })];
  assert.equal(clubOwnerPlatform(members), null, "platform");
  assert.equal(clubOwnerUsername(members), null, "username");
});

test("clubIdentityLine n'ajoute la plateforme que si elle est connue", () => {
  assert.equal(clubIdentityLine({ level: "CASUAL", ownerPlatform: null }), "Casual", "sans plateforme");
  assert.equal(clubIdentityLine({ level: "COMPETITIVE", ownerPlatform: "XBOX" }), "Compétitif · Xbox", "avec plateforme");
});

test("clubLanguagesLine — une ligne, pas un mur ; vide -> null", () => {
  assert.equal(clubLanguagesLine([]), null, "vide");
  assert.equal(clubLanguagesLine(["FR", "EN"]), "Français, Anglais", "labels");
});

test("clubActiveLiveSession — LIVE seulement si flag + expiry future (même règle que lib/live)", () => {
  const now = Date.parse("2026-08-24T12:00:00.000Z");
  const live: ClubSessionRow = {
    id: "s1",
    club_id: "c1",
    is_live: true,
    needed_positions: ["ST"],
    note: null,
    expires_at: "2026-08-24T13:00:00.000Z",
    created_at: "2026-08-24T11:00:00.000Z",
    updated_at: "2026-08-24T11:00:00.000Z",
  };
  const expired = { ...live, id: "s2", expires_at: "2026-08-24T11:00:00.000Z" };
  const orphan = { ...live, id: "s3", is_live: true, expires_at: null };
  assert.equal(clubActiveLiveSession([expired, orphan, live], now)?.id, "s1", "session active");
  assert.equal(clubActiveLiveSession([expired, orphan], now), null, "aucune session LIVE réelle");
});

test("sortClubRoster — affichage Owner / Manager / Membre, sans muter l'entrée", () => {
  const members = [
    member({ user_id: "m1", role: "MEMBER", joined_at: "2026-01-02T00:00:00.000Z" }),
    member({ user_id: "o1", role: "OWNER", joined_at: "2026-01-03T00:00:00.000Z" }),
    member({ user_id: "g1", role: "MANAGER", joined_at: "2026-01-01T00:00:00.000Z" }),
  ];
  const sorted = sortClubRoster(members);
  assert.deepEqual(
    sorted.map((m) => m.role),
    ["OWNER", "MANAGER", "MEMBER"],
    "ordre"
  );
  assert.equal(members[0].role, "MEMBER", "entrée non mutée");
});

test("clubPublicHref — page publique /club/[id], jamais /match-sheet", () => {
  assert.equal(clubPublicHref("c1"), "/club/c1", "base");
  assert.equal(clubPublicHref("c1", "s1"), "/club/c1?session=s1", "session");
  assert.equal(clubPublicHref("  c1  ", "  "), "/club/c1", "session vide ignorée");
  if (clubPublicHref("c1").includes("match-sheet")) {
    throw new Error("clubPublicHref ne doit pas pointer vers /match-sheet");
  }
});

test("proPurchaseCta — désactivé sans RevenueCat, pas de succès fictif", () => {
  const off = proPurchaseCta(false);
  assert.equal(off.canPurchase, false, "off");
  assert.equal(off.disabledReason, PRO_PURCHASE_UNAVAILABLE_REASON, "reason");
  const on = proPurchaseCta(true);
  assert.equal(on.canPurchase, true, "on");
  assert.equal(on.disabledReason, null, "no reason");
});

function livePricingText(revenueCatEnabled: boolean): string {
  const copy = pricingScreenCopy(revenueCatEnabled);
  return [copy.intro, copy.priceLabel ?? "", copy.ctaLabel, ...copy.liveFeatures].join("\n");
}

test("pricingScreenCopy — sans RevenueCat : pas d'euro, Scout Report IA pas live", () => {
  const copy = pricingScreenCopy(false);
  assert.equal(copy.priceLabel, null, "priceLabel");
  assert.equal(copy.liveFeatures.length, 0, "aucune feature live");
  const live = livePricingText(false);
  if (/€|\bEUR\b|\d+\s*€/i.test(live) || live.includes(String(5))) {
    throw new Error(`Copy live sans RevenueCat ne doit pas contenir de montant euro.\n  reçu: ${live}`);
  }
  if (copy.liveFeatures.includes("Scout Report IA") || /Scout Report IA/.test(live)) {
    throw new Error("Scout Report IA ne doit pas être listé comme feature live.");
  }
  if (!copy.laterFeatures.includes("Scout Report IA")) {
    throw new Error("Scout Report IA peut figurer en « plus tard », pas en live.");
  }
  if (!copy.intro.includes("gratuit") || !copy.intro.includes("pas encore en vente")) {
    throw new Error(`Intro honnête attendue (gratuit / pas encore en vente).\n  reçu: ${copy.intro}`);
  }
});

test("profileProEntryCopy — sans RevenueCat : entrée joignable, pas un store", () => {
  const off = profileProEntryCopy(false);
  assert.equal(off.looksLikeStore, false, "pas un store");
  assert.equal(off.title, "Pro", "title");
  assert.equal(off.subtitle, "Pas encore en vente", "subtitle");
  const on = profileProEntryCopy(true);
  assert.equal(on.looksLikeStore, true, "store si RC on");
});

console.log("lib/statsSource.ts — stats EA honnêtes");

test("hasVerifiedEaStatValues — null/vide = false ; un chiffre stocké = true", () => {
  assert.equal(hasVerifiedEaStatValues(null), false, "null");
  assert.equal(hasVerifiedEaStatValues({}), false, "objet vide");
  assert.equal(hasVerifiedEaStatValues({ goals: 3 }), true, "goals");
  assert.equal(hasVerifiedEaStatValues({ matchesPlayed: 0 }), true, "0 est un chiffre réel");
});

test("normalizeEaIdentityKind — tout sauf USERNAME_EQUALITY devient NONE", () => {
  assert.equal(normalizeEaIdentityKind("USERNAME_EQUALITY"), "USERNAME_EQUALITY", "eq");
  assert.equal(normalizeEaIdentityKind("NONE"), "NONE", "none");
  assert.equal(normalizeEaIdentityKind("VERIFIED"), "NONE", "inventé rejeté");
  assert.equal(normalizeEaIdentityKind(null), "NONE", "null");
});

console.log(`\n${passed} test(s) passés.`);
