/**
 * Tests de lib/live.ts — expiry LIVE joueur/club (P0).
 * Logique pure, aucune dépendance réseau.
 *
 * Lancer : npx tsx scripts/test-live.ts
 */
import {
  computeLiveExpiresAt,
  DEFAULT_LIVE_DURATION_MS,
  findActiveLiveSession,
  formatLiveRemaining,
  isLiveActive,
  liveFeedEmptyCopy,
  LIVE_UX_COPY,
  parseLiveDurationMs,
  remainingLiveMs,
} from "../lib/live";

const assert = {
  equal(actual: unknown, expected: unknown, label: string) {
    if (actual !== expected) {
      throw new Error(`Assertion échouée (${label}).\n  reçu: ${actual}\n  attendu: ${expected}`);
    }
  },
};

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok — ${name}`);
}

console.log("lib/live.ts — LIVE expiry");

const NOW = Date.parse("2026-08-24T12:00:00.000Z");

test("isLiveActive — is_live false -> inactif même avec expiry future", () => {
  assert.equal(
    isLiveActive({ is_live: false, expires_at: "2026-08-24T14:00:00.000Z" }, NOW),
    false,
    "offline"
  );
});

test("isLiveActive — is_live true sans expires_at -> inactif (pas de LIVE éternel)", () => {
  assert.equal(isLiveActive({ is_live: true, expires_at: null }, NOW), false, "null expiry");
});

test("isLiveActive — is_live true et expiry passée -> inactif", () => {
  assert.equal(
    isLiveActive({ is_live: true, expires_at: "2026-08-24T11:59:00.000Z" }, NOW),
    false,
    "expired"
  );
});

test("isLiveActive — is_live true et expiry future -> actif", () => {
  assert.equal(
    isLiveActive({ is_live: true, expires_at: "2026-08-24T12:01:00.000Z" }, NOW),
    true,
    "active"
  );
});

test("findActiveLiveSession — ignore is_live sans expiry / expiré", () => {
  const sessions = [
    { is_live: true, expires_at: null },
    { is_live: true, expires_at: "2026-08-24T11:00:00.000Z" },
    { is_live: true, expires_at: "2026-08-24T13:00:00.000Z", id: "ok" },
  ];
  const found = findActiveLiveSession(sessions, NOW);
  assert.equal(found && "id" in found ? found.id : null, "ok", "picks unexpired");
});

test("remainingLiveMs — 90 s restantes -> 90000", () => {
  assert.equal(remainingLiveMs("2026-08-24T12:01:30.000Z", NOW), 90_000, "90s");
});

test("remainingLiveMs — déjà expiré -> 0 (jamais négatif)", () => {
  assert.equal(remainingLiveMs("2026-08-24T11:00:00.000Z", NOW), 0, "past");
});

test("remainingLiveMs — expires_at invalide -> 0", () => {
  assert.equal(remainingLiveMs("not-a-date", NOW), 0, "invalid");
});

test("computeLiveExpiresAt — défaut = 2 h", () => {
  const expires = computeLiveExpiresAt(NOW);
  assert.equal(expires.toISOString(), new Date(NOW + DEFAULT_LIVE_DURATION_MS).toISOString(), "default 2h");
});

test("computeLiveExpiresAt — durée 30 min respectée", () => {
  const expires = computeLiveExpiresAt(NOW, 30 * 60 * 1000);
  assert.equal(expires.toISOString(), "2026-08-24T12:30:00.000Z", "30min");
});

test("parseLiveDurationMs — valeur hors catalogue -> défaut 2 h", () => {
  assert.equal(parseLiveDurationMs("999"), DEFAULT_LIVE_DURATION_MS, "unknown");
  assert.equal(parseLiveDurationMs(undefined), DEFAULT_LIVE_DURATION_MS, "undefined");
  assert.equal(parseLiveDurationMs("1800000"), 1_800_000, "30min allowed");
});

test("formatLiveRemaining — moins d'une heure -> minutes ceil", () => {
  assert.equal(formatLiveRemaining("2026-08-24T12:10:00.000Z", NOW), "10 min", "10min");
});

test("formatLiveRemaining — exactement 2 h", () => {
  assert.equal(formatLiveRemaining("2026-08-24T14:00:00.000Z", NOW), "2 h", "2h");
});

test("formatLiveRemaining — expiré", () => {
  assert.equal(formatLiveRemaining("2026-08-24T11:00:00.000Z", NOW), "Expiré", "expired label");
});

test("empty LIVE — copy honnête, jamais un vide ni une session fake", () => {
  assert.equal(liveFeedEmptyCopy({ selfLive: false, liveClubCount: 0 }), LIVE_UX_COPY.emptyNoClubs, "no clubs");
  assert.equal(liveFeedEmptyCopy({ selfLive: true, liveClubCount: 0 }), LIVE_UX_COPY.emptySelfLive, "self live");
  assert.equal(liveFeedEmptyCopy({ selfLive: false, liveClubCount: 2 }), LIVE_UX_COPY.emptyNoPlayers, "players");
  assert.equal(LIVE_UX_COPY.goLive, "Passer LIVE", "cta");
  assert.equal(LIVE_UX_COPY.findClub, "Chercher un club", "find");
  assert.equal(LIVE_UX_COPY.emptyNoClubs.includes("invent"), false, "no fake");
});

console.log(`\n${passed} tests live OK`);
